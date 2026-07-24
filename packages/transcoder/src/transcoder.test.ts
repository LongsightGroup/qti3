import { readFileSync } from "node:fs";

import {
  deprecatedInteractionSupport,
  interactionSupport,
  type QtiInteractionType,
} from "@longsightgroup/qti3-core";
import {
  qti3TrustedXmlFragment,
  type Qti3PackageAuthoringInput,
  writeQti3AssessmentItem,
  writeQti3PackageZip,
} from "@longsightgroup/qti3-writer";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import {
  qtiTranscodeProfiles,
  transcodeQti3Item,
  transcodeQti3Package,
  type QtiTranscodeProfileId,
} from "./index.js";

const profiles = Object.keys(qtiTranscodeProfiles) as QtiTranscodeProfileId[];
const interactions = [...interactionSupport, ...deprecatedInteractionSupport];

describe("qti3 transcoder evidence matrix", () => {
  it("declares the standards and Canvas Classic profiles with all registry interactions", () => {
    expect(profiles).toEqual([
      "canvas-classic-quizzes@1",
      "qti12-standard@1",
      "qti21-standard@1",
      "qti22-standard@1",
    ]);
    expect(interactions).toHaveLength(22);
    for (const profile of Object.values(qtiTranscodeProfiles)) {
      expect(Object.keys(profile.interactions).toSorted()).toEqual(
        interactions.map((entry) => entry.interactionType).toSorted(),
      );
    }
  });

  describe.each(profiles)("%s", (profile) => {
    for (const interaction of interactions) {
      it(`transcodes ${interaction.interactionType}`, () => {
        const xml = fixtureXml(interaction.interactionType);
        const result = transcodeQti3Item(
          { kind: "xml", xml, sourcePath: `${interaction.interactionType}.xml` },
          { profile },
        );
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.report.mappings.length).toBeGreaterThanOrEqual(1);
        expect(
          result.report.mappings.every(
            (mapping) => mapping.sourceInteraction === interaction.interactionType,
          ),
        ).toBe(true);
        expect(result.assets).toEqual([]);
        expect(result.xml).not.toContain("qti-portable-custom-interaction");
        expect(result.diagnostics.some((entry) => entry.severity === "error")).toBe(false);
        if (profile === "qti12-standard@1" || profile === "canvas-classic-quizzes@1") {
          expect(result.xml).toContain("<questestinterop");
        } else {
          expect(result.xml).toContain("<assessmentItem");
        }
        expect({
          diagnostics: result.diagnostics,
          report: result.report,
          xml: result.xml,
        }).toMatchSnapshot();
      });
    }
  });
});

describe("qti3 transcoder package output", () => {
  const sourcePackage: Qti3PackageAuthoringInput = {
    identifier: "PACKAGE",
    title: "Transcoder package",
    items: [
      {
        kind: "authoringItem",
        path: "items/choice.xml",
        item: {
          interactionType: "choice",
          identifier: "CHOICE",
          title: "Choice",
          responseCardinality: "single",
          choices: [
            { identifier: "A", text: "Alpha" },
            { identifier: "B", text: "Beta" },
          ],
          correctResponse: ["A"],
        },
        assets: [{ path: "media/source.txt", data: "source" }],
      },
    ],
  };

  it("preserves safe source paths, content-addresses its report, and emits deterministic ZIPs", async () => {
    const first = await transcodeQti3Package(
      { kind: "authoringPackage", package: sourcePackage },
      { profile: "qti21-standard@1" },
    );
    const second = await transcodeQti3Package(
      { kind: "authoringPackage", package: sourcePackage },
      { profile: "qti21-standard@1" },
    );
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.files.map((file) => file.path)).toEqual(
      expect.arrayContaining(["imsmanifest.xml", "items/choice.xml", "media/source.txt"]),
    );
    expect(
      first.files.some((file) => /^assets\/generated\/[a-f0-9]{64}\.json$/.test(file.path)),
    ).toBe(true);
    expect(first.zip).toEqual(second.zip);
  });

  it("accepts QTI 3 ZIP bytes through the package parser seam", async () => {
    const result = await transcodeQti3Package(
      { kind: "zip", bytes: writeQti3PackageZip(sourcePackage) },
      { profile: "qti22-standard@1" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.files.map((file) => file.path)).toEqual(
      expect.arrayContaining(["imsmanifest.xml", "items/choice.xml", "media/source.txt"]),
    );
  });

  it("emits a Canvas Classic quiz assessment, metadata dependency, HTML, and percentage scoring", async () => {
    const result = await transcodeQti3Package(
      { kind: "authoringPackage", package: sourcePackage },
      { profile: "canvas-classic-quizzes@1" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const manifest = result.files.find((file) => file.path === "imsmanifest.xml")?.data;
    const assessment = result.files.find((file) => file.path === "assessment_qti.xml")?.data;
    const metadata = result.files.find((file) => file.path === "assessment_meta.xml")?.data;
    expect(manifest).toEqual(expect.any(String));
    expect(manifest).toContain('type="imsqti_xmlv1p2"');
    expect(manifest).not.toContain("imsqti_xmlv1p1");
    expect(manifest).toContain('dependency identifierref="ASSESSMENT_META"');
    expect(assessment).toEqual(expect.any(String));
    expect(assessment).toContain("<assessment ");
    expect(assessment).toContain('<section ident="root_section">');
    expect(assessment).toContain("<fieldlabel>question_type</fieldlabel>");
    expect(assessment).toContain("<fieldentry>multiple_choice_question</fieldentry>");
    expect(assessment).toContain('<response_lid ident="response1"');
    expect(assessment).toContain('<setvar action="Set" varname="SCORE">100</setvar>');
    expect(metadata).toEqual(expect.any(String));
    expect(metadata).toContain('xmlns="http://canvas.instructure.com/xsd/cccv1p0"');
  });

  it("preserves an assessment-test hierarchy and emits a test resource graph", async () => {
    const sourceItem = fixtureXml("choice");
    const bytes = zipSync(
      Object.fromEntries(
        Object.entries({
          "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources><resource identifier="test" type="imsqti_test_xmlv3p0" href="tests/assessment.xml"><file href="tests/assessment.xml"/></resource></resources>
</manifest>`,
          "tests/assessment.xml": `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="test" title="Assessment">
  <qti-test-part identifier="part" navigation-mode="nonlinear" submission-mode="individual">
    <qti-assessment-section identifier="outer" title="Outer" visible="true">
      <qti-assessment-section identifier="inner" title="Inner" visible="false">
        <qti-assessment-item-ref identifier="choice-ref" href="../items/choice.xml"/>
      </qti-assessment-section>
    </qti-assessment-section>
  </qti-test-part>
</qti-assessment-test>`,
          "items/choice.xml": sourceItem,
        }).map(([path, data]) => [path, strToU8(data)]),
      ),
      { level: 0 },
    );
    const result = await transcodeQti3Package(
      { kind: "zip", bytes },
      { profile: "qti21-standard@1" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const assessment = result.files.find((file) => file.path === "tests/assessment.xml")?.data;
    const manifest = result.files.find((file) => file.path === "imsmanifest.xml")?.data;
    expect(assessment).toEqual(expect.any(String));
    expect(assessment).toContain('<assessmentSection identifier="outer"');
    expect(assessment).toContain('<assessmentSection identifier="inner"');
    expect(assessment).toContain('href="../items/choice.xml"');
    expect(manifest).toEqual(expect.any(String));
    expect(manifest).toContain("<schemaversion>2.1</schemaversion>");
    expect(manifest).toContain('type="imsqti_test_xmlv2p1"');
    expect(manifest).toContain('<dependency identifierref="RESOURCE_1"/>');
  });

  it("rejects invalid source before conversion", () => {
    const result = transcodeQti3Item(
      { kind: "xml", xml: "<not-qti/>" },
      { profile: "qti22-standard@1" },
    );
    expect(result).toMatchObject({ ok: false, code: "invalid_source" });
  });

  it("rejects unresolved required assets", async () => {
    const xml = fixtureXml("choice").replace(
      "<qti-item-body>",
      '<qti-item-body><img src="../media/missing.png" alt="Required diagram"/>',
    );
    const result = await transcodeQti3Package(
      {
        kind: "authoringPackage",
        package: {
          identifier: "MISSING_ASSET",
          items: [
            {
              kind: "xml",
              path: "items/choice.xml",
              identifier: "choice-reference",
              xml,
            },
          ],
        },
      },
      { profile: "qti21-standard@1" },
    );
    expect(result).toMatchObject({
      ok: false,
      code: "missing_asset",
      diagnostics: [{ code: "package.asset.missing", path: "media/missing.png" }],
    });
  });

  it("rejects source content that collides with a generated content address", async () => {
    const baseline = await transcodeQti3Package(
      { kind: "authoringPackage", package: sourcePackage },
      { profile: "qti21-standard@1" },
    );
    expect(baseline.ok).toBe(true);
    if (!baseline.ok) return;
    const generatedPath = baseline.files.find((file) =>
      file.path.startsWith("assets/generated/"),
    )?.path;
    expect(generatedPath).toBeDefined();
    if (!generatedPath) return;

    const result = await transcodeQti3Package(
      {
        kind: "authoringPackage",
        package: {
          ...sourcePackage,
          items: sourcePackage.items.map((item) => ({
            ...item,
            assets: [...(item.assets ?? []), { path: generatedPath, data: "different" }],
          })),
        },
      },
      { profile: "qti21-standard@1" },
    );
    expect(result).toMatchObject({
      ok: false,
      code: "unsafe_path",
      diagnostics: [
        expect.objectContaining({
          code: "package.generated_path.collision",
          path: generatedPath,
        }),
      ],
    });
  });
});

describe("qti3 transcoder composite items", () => {
  it.each(["qti12-standard@1", "qti21-standard@1", "qti22-standard@1"] as const)(
    "maps every interaction through %s",
    (profile) => {
      const result = transcodeQti3Item(
        {
          kind: "xml",
          xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="composite" title="Composite" time-dependent="false">
  <qti-response-declaration identifier="CHOICE" cardinality="single" base-type="identifier"><qti-correct-response><qti-value>A</qti-value></qti-correct-response></qti-response-declaration>
  <qti-response-declaration identifier="TEXT" cardinality="single" base-type="string"><qti-correct-response><qti-value>blue</qti-value></qti-correct-response></qti-response-declaration>
  <qti-item-body>
    <qti-choice-interaction response-identifier="CHOICE"><qti-prompt>Pick one.</qti-prompt><qti-simple-choice identifier="A">Alpha</qti-simple-choice><qti-simple-choice identifier="B">Beta</qti-simple-choice></qti-choice-interaction>
    <p>Name the color: <qti-text-entry-interaction response-identifier="TEXT"/></p>
  </qti-item-body>
</qti-assessment-item>`,
        },
        { profile },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.report.mappings.map((mapping) => mapping.sourceInteraction)).toEqual([
        "choice",
        "textEntry",
      ]);
      const expectedScoring = profile === "qti12-standard@1" ? "automatic" : "unscored";
      expect(result.report.mappings.every((mapping) => mapping.scoring === expectedScoring)).toBe(
        true,
      );
    },
  );
});

describe("qti3 transcoder scoring and custom payload contracts", () => {
  it("reports QTI 2.x items without response processing as unscored", () => {
    const result = transcodeQti3Item(
      {
        kind: "xml",
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="unscored" title="Unscored" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"><qti-correct-response><qti-value>A</qti-value></qti-correct-response></qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"><qti-default-value><qti-value>0</qti-value></qti-default-value></qti-outcome-declaration>
  <qti-item-body><qti-choice-interaction response-identifier="RESPONSE"><qti-simple-choice identifier="A">Alpha</qti-simple-choice><qti-simple-choice identifier="B">Beta</qti-simple-choice></qti-choice-interaction></qti-item-body>
</qti-assessment-item>`,
      },
      { profile: "qti21-standard@1" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.xml).not.toContain("<responseProcessing");
    expect(result.report.mappings[0]?.scoring).toBe("unscored");
  });

  it.each([
    ["qti21-standard@1", 'label="Choose accessibly"', 'label="Accessible Alpha"'],
    ["qti22-standard@1", 'aria-label="Choose accessibly"', 'aria-label="Accessible Alpha"'],
  ] as const)("projects accessibility attributes through %s", (profile, interaction, choice) => {
    const result = transcodeQti3Item(
      {
        kind: "xml",
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="a11y" title="A11y" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"><qti-correct-response><qti-value>A</qti-value></qti-correct-response></qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"><qti-default-value><qti-value>0</qti-value></qti-default-value></qti-outcome-declaration>
  <qti-item-body><qti-choice-interaction response-identifier="RESPONSE" aria-label="Choose accessibly"><qti-simple-choice identifier="A" aria-label="Accessible Alpha">Alpha</qti-simple-choice><qti-simple-choice identifier="B">Beta</qti-simple-choice></qti-choice-interaction></qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`,
      },
      { profile },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.xml).toContain(interaction);
    expect(result.xml).toContain(choice);
    expect(result.xml).not.toContain("ariaLabel=");
  });

  it.each(["qti21-standard@1", "qti22-standard@1"] as const)(
    "uses a textual %s fallback for graphic gap matches without image geometry",
    (profile) => {
      const result = transcodeQti3Item(
        { kind: "xml", xml: fixtureXml("graphicGapMatch") },
        { profile },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.xml).toContain("<gapMatchInteraction");
      expect(result.xml).toContain("The first step is to");
      expect(result.xml).not.toContain("data:image/svg+xml");
      expect(result.assets).toEqual([]);
      expect(result.report.mappings[0]).toMatchObject({
        emittedInteraction: "gapMatchInteraction",
        fidelity: "lossy",
      });
    },
  );

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
      "&lt;p&gt;Read &lt;strong&gt;carefully&lt;/strong&gt;. &lt;img src=&quot;media/chart.png&quot; alt=&quot;Growth chart&quot;&gt;&lt;/img&gt;&lt;/p&gt;",
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

  it("scores relationship fallbacks using emitted identifiers", () => {
    const result = transcodeQti3Item(
      { kind: "xml", xml: fixtureXml("gapMatch") },
      { profile: "qti12-standard@1" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.xml).toContain('<varequal respident="RESPONSE">PAIR_A_G1</varequal>');
    expect(result.xml).not.toContain(">A G1</varequal>");
    expect(result.xml).toContain("<not><varequal");
  });

  it("uses the same scalar point encoding in instructions and scoring", () => {
    const result = transcodeQti3Item(
      { kind: "xml", xml: fixtureXml("selectPoint") },
      { profile: "qti12-standard@1" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.xml).toContain("x,y coordinates");
    expect(result.xml).toContain(">240,88</varequal>");
    expect(result.xml).not.toContain(">240 88</varequal>");
  });

  it("uses indexed equality for ordered QTI 1.2 responses", () => {
    const result = transcodeQti3Item(
      { kind: "xml", xml: fixtureXml("graphicOrder") },
      { profile: "qti12-standard@1" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.xml).toContain('index="1"');
    expect(result.xml).toContain('index="4"');
  });

  it.each(["qti21-standard@1", "qti22-standard@1"] as const)(
    "preserves portable custom modules, configuration, and markup through %s",
    (profile) => {
      const result = transcodeQti3Item(
        { kind: "xml", xml: fixtureXml("portableCustom") },
        { profile },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.xml).toContain("urn:longsightgroup:qti3-transcoder:custom:v1");
      expect(result.xml).toContain("modules/module_resolution.js");
      expect(result.xml).toContain("fixture-portable-custom");
      expect(result.xml).toContain("Custom graphing widget placeholder");
      expect(result.report.mappings[0]).toMatchObject({
        emittedInteraction: "customInteraction",
        fidelity: "normalized",
      });
    },
  );
});

function fixtureXml(interactionType: QtiInteractionType): string {
  if (interactionType === "custom") {
    return writeQti3AssessmentItem({
      interactionType: "custom",
      identifier: "custom-reference",
      title: "Custom reference",
      bodyHtml: qti3TrustedXmlFragment("<p>Use the widget.</p>"),
      interactionMarkupHtml: qti3TrustedXmlFragment('<div class="widget">Ready</div>'),
    });
  }
  return readFileSync(`packages/fixtures/xml/${interactionType}-reference.xml`, "utf8");
}
