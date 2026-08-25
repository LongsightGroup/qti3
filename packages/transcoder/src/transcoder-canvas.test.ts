import { describe, expect, it } from "vitest";

import { transcodeQti3Item, transcodeQti3Package } from "./index.js";
import { choiceAuthoringPackage, fixtureXml } from "./transcoder.test-helpers.js";

describe("Canvas transcoder profiles", () => {
  it("emits the shared Canvas QTI package boundary for New Quizzes", async () => {
    const result = await transcodeQti3Package(
      { kind: "authoringPackage", package: choiceAuthoringPackage },
      { profile: "canvas-new-quizzes@1" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const manifest = result.files.find((file) => file.path === "imsmanifest.xml")?.data;
    const assessment = result.files.find((file) => file.path === "assessment_qti.xml")?.data;
    expect(manifest).toEqual(expect.any(String));
    expect(manifest).toContain('type="imsqti_xmlv1p2"');
    expect(manifest).toContain('dependency identifierref="ASSESSMENT_META"');
    expect(assessment).toEqual(expect.any(String));
    expect(assessment).toContain("<fieldentry>multiple_choice_question</fieldentry>");
    expect(assessment).toContain('<response_lid ident="response1"');
    expect(assessment).toContain('<setvar action="Set" varname="SCORE">100</setvar>');
  });

  it("preserves Canvas HTML stems and rich choices instead of flattening them", () => {
    const result = transcodeQti3Item(
      {
        kind: "xml",
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="rich" title="Rich" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"><qti-correct-response><qti-value>A</qti-value></qti-correct-response></qti-response-declaration>
  <qti-item-body>
    <p>Read <strong>carefully</strong>. <img src="media/chart.png" alt="Growth chart"/></p>
    <qti-choice-interaction response-identifier="RESPONSE">
      <qti-prompt>Pick the <strong>best</strong> answer.</qti-prompt>
      <qti-simple-choice identifier="A"><em>Alpha</em></qti-simple-choice>
      <qti-simple-choice identifier="B">Beta</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>`,
      },
      { profile: "canvas-classic-quizzes@1" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.xml).toContain(
      '&lt;p&gt;Read &lt;strong&gt;carefully&lt;/strong&gt;. &lt;img src="media/chart.png" alt="Growth chart"&gt;&lt;/img&gt;&lt;/p&gt;',
    );
    expect(result.xml).toContain("&lt;p&gt;Pick the best answer.&lt;/p&gt;");
    expect(result.xml).toContain("&lt;em&gt;Alpha&lt;/em&gt;");
    expect(result.xml).toContain('<response_lid ident="response1"');
  });

  it("emits executable region scoring for a Canvas Classic hotspot", () => {
    const result = transcodeQti3Item(
      { kind: "xml", xml: fixtureXml("hotspot") },
      { profile: "canvas-classic-quizzes@1" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.xml).toContain(
      '<varinside respident="response1" areatype="Rectangle">184,52,296,124</varinside>',
    );
    expect(result.xml).toContain('<setvar action="Set" varname="SCORE">100</setvar>');
    expect(result.report.mappings[0]?.scoring).toBe("automatic");
  });

  it("degrades multi-region Canvas hotspots to an exactly scored multiple-answer question", () => {
    const xml = fixtureXml("hotspot")
      .replace('cardinality="single"', 'cardinality="multiple"')
      .replace("<qti-value>A</qti-value>", "<qti-value>A</qti-value><qti-value>B</qti-value>")
      .replace(
        /<qti-hotspot-choice identifier="([A-D])"/g,
        '<qti-hotspot-choice identifier="$1" hotspot-label="Region $1"',
      );
    const result = transcodeQti3Item({ kind: "xml", xml }, { profile: "canvas-classic-quizzes@1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.xml).toContain("<fieldentry>multiple_answers_question</fieldentry>");
    expect(result.xml).toContain('<response_lid ident="response1" rcardinality="Multiple">');
    expect(result.xml).not.toContain("<response_xy");
    expect(result.xml).toContain("<not><varequal");
    expect(result.report.mappings[0]).toMatchObject({
      emittedInteraction: "response_lid",
      scoring: "automatic",
      fidelity: "lossy",
      fallback: "choice",
    });
  });

  it("uses manual grading when a multi-region hotspot lacks accessible region labels", () => {
    const xml = fixtureXml("hotspot")
      .replace('cardinality="single"', 'cardinality="multiple"')
      .replace("<qti-value>A</qti-value>", "<qti-value>A</qti-value><qti-value>B</qti-value>");
    const result = transcodeQti3Item({ kind: "xml", xml }, { profile: "canvas-classic-quizzes@1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.xml).toContain("<fieldentry>essay_question</fieldentry>");
    expect(result.xml).toContain("Describe all regions that satisfy the question.");
    expect(result.report.mappings[0]).toMatchObject({
      emittedInteraction: "response_str",
      scoring: "manual",
      fidelity: "lossy",
      fallback: "extended-text",
    });
  });

  it("maps Canvas sequencing tasks to matching questions with partial credit", () => {
    const result = transcodeQti3Item(
      { kind: "xml", xml: fixtureXml("order") },
      { profile: "canvas-classic-quizzes@1" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.xml).toContain("<fieldentry>matching_question</fieldentry>");
    expect(result.xml).toContain('ident="response_POS_1"');
    expect(result.xml).toContain("Set up identical trays");
    expect(result.xml).toContain('<respcondition continue="Yes">');
    expect(result.report.mappings[0]).toMatchObject({
      emittedInteraction: "response_lid",
      scoring: "automatic",
      fidelity: "lossy",
      sourceInteraction: "order",
    });
    expect(result.report.diagnosticCodes).toContain("profile.canvas.classic.sequence_matching");
  });

  it("preserves ordering as a native New Quizzes ordered response", () => {
    const result = transcodeQti3Item(
      { kind: "xml", xml: fixtureXml("order") },
      { profile: "canvas-new-quizzes@1" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.xml).toContain("<fieldentry>ordering_question</fieldentry>");
    expect(result.xml).toContain('<response_lid ident="response1" rcardinality="Ordered">');
    expect(result.xml).toContain('<varequal respident="response1" index="1">');
    expect(result.xml).not.toContain("profile.canvas.classic.sequence_matching");
    expect(result.report.mappings[0]).toMatchObject({
      emittedInteraction: "response_lid",
      scoring: "automatic",
      fidelity: "exact",
      sourceInteraction: "order",
    });
  });

  it("keeps graphic ordering as an explicitly diagnosed New Quizzes matching fallback", () => {
    const result = transcodeQti3Item(
      { kind: "xml", xml: fixtureXml("graphicOrder") },
      { profile: "canvas-new-quizzes@1" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.xml).toContain("<fieldentry>matching_question</fieldentry>");
    expect(result.report.mappings[0]).toMatchObject({
      emittedInteraction: "response_lid",
      scoring: "automatic",
      fidelity: "lossy",
      sourceInteraction: "graphicOrder",
    });
    expect(result.report.diagnosticCodes).toContain(
      "profile.canvas.new_quizzes.graphic_sequence_matching",
    );
    expect(result.report.diagnosticCodes).not.toContain("profile.canvas.classic.sequence_matching");
  });

  it("uses Canvas matching identifiers, a shared target pool, and additive partial credit", () => {
    const result = transcodeQti3Item(
      { kind: "xml", xml: fixtureXml("match") },
      { profile: "canvas-classic-quizzes@1" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.xml).toContain("<fieldentry>matching_question</fieldentry>");
    expect(result.xml).toMatch(/<response_lid ident="response_[^"]+"/);
    expect(result.xml.match(/<response_label ident="[^"]+">/g)?.length).toBeGreaterThan(4);
    expect(result.xml).toContain('<respcondition continue="Yes">');
    expect(result.xml).toMatch(/<setvar action="Add" varname="SCORE">\d+(?:\.\d+)?<\/setvar>/);
  });

  it("maps upload to Canvas file-upload metadata without a fake text response", () => {
    const result = transcodeQti3Item(
      { kind: "xml", xml: fixtureXml("upload") },
      { profile: "canvas-classic-quizzes@1" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.xml).toContain("<fieldentry>file_upload_question</fieldentry>");
    expect(result.xml).not.toContain("<response_str");
    expect(result.report.mappings[0]).toMatchObject({
      emittedInteraction: "presentation",
      scoring: "manual",
      fidelity: "normalized",
    });
  });

  it("reports New Quizzes file-upload mapping without Classic compatibility claims", () => {
    const result = transcodeQti3Item(
      { kind: "xml", xml: fixtureXml("upload") },
      { profile: "canvas-new-quizzes@1" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.xml).toContain("<fieldentry>file_upload_question</fieldentry>");
    expect(result.xml).not.toContain("<response_str");
    expect(result.report.diagnosticCodes).toContain("profile.canvas.new_quizzes.upload");
    expect(result.report.diagnosticCodes).not.toContain("profile.canvas.classic.upload");
  });
});
