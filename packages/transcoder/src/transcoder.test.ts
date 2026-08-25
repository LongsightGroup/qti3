import { deprecatedInteractionSupport, interactionSupport } from "@longsightgroup/qti3-core";
import { writeQti3PackageZip } from "@longsightgroup/qti3-writer";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import {
  qtiTranscodeProfiles,
  transcodeQti3Item,
  transcodeQti3Package,
  type QtiTranscodeProfileId,
} from "./index.js";
import { choiceAuthoringPackage, fixtureXml } from "./transcoder.test-helpers.js";
import { validateGeneratedTargetXml } from "./xml.js";

const profiles = Object.keys(qtiTranscodeProfiles) as QtiTranscodeProfileId[];
const interactions = [...interactionSupport, ...deprecatedInteractionSupport];

describe("qti3 transcoder evidence matrix", () => {
  it("declares standards and vendor profiles with all registry interactions", () => {
    expect(profiles).toEqual([
      "blackboard-question-banks@1",
      "brightspace-course-import@1",
      "canvas-classic-quizzes@1",
      "canvas-new-quizzes@1",
      "moodle-xml@1",
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
    expect(qtiTranscodeProfiles["moodle-xml@1"]).toMatchObject({
      kind: "moodle-xml",
      evidence: { xsd: "not-applicable", reverseMigration: "not-applicable" },
    });
    expect(qtiTranscodeProfiles["moodle-xml@1"]).not.toHaveProperty("namespace");
    expect(qtiTranscodeProfiles["moodle-xml@1"]).not.toHaveProperty("schemaVersion");
    expect(qtiTranscodeProfiles["moodle-xml@1"]).not.toHaveProperty("manifestResourceType");
    expect(qtiTranscodeProfiles["canvas-new-quizzes@1"]).toMatchObject({
      kind: "canvas",
      target: "qti12",
      evidence: { xsd: "required", reverseMigration: "required" },
      vendorEvidence: {
        product: "Canvas New Quizzes",
        compatibility: { basis: "source-derived", productImport: "unverified" },
      },
    });
    expect(qtiTranscodeProfiles["canvas-classic-quizzes@1"]).toMatchObject({
      kind: "canvas",
      interactions: {
        upload: {
          transformation: "presentation",
          diagnostic: { code: "profile.canvas.classic.upload" },
        },
        order: {
          transformation: "matching-fallback",
          diagnostic: { code: "profile.canvas.classic.sequence_matching" },
        },
      },
    });
    for (const profile of [
      qtiTranscodeProfiles["blackboard-question-banks@1"],
      qtiTranscodeProfiles["brightspace-course-import@1"],
    ]) {
      expect(profile).toMatchObject({
        kind: "qti-standard",
        target: "qti21",
        package: {
          schemaVersion: "2.1",
          manifestResourceType: "imsqti_item_xmlv2p1",
        },
        evidence: { xsd: "required", reverseMigration: "required" },
        vendorEvidence: {
          compatibility: {
            basis: "vendor-documentation",
            productImport: "unverified",
          },
        },
      });
    }
  });
});

describe("qti3 transcoder package output", () => {
  it("preserves safe source paths, content-addresses its report, and emits deterministic ZIPs", async () => {
    const first = await transcodeQti3Package(
      { kind: "authoringPackage", package: choiceAuthoringPackage },
      { profile: "qti21-standard@1" },
    );
    const second = await transcodeQti3Package(
      { kind: "authoringPackage", package: choiceAuthoringPackage },
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
      { kind: "zip", bytes: writeQti3PackageZip(choiceAuthoringPackage) },
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
      { kind: "authoringPackage", package: choiceAuthoringPackage },
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

  it("emits one importable Moodle XML question bank with embedded assets", async () => {
    const result = await transcodeQti3Package(
      { kind: "authoringPackage", package: choiceAuthoringPackage },
      { profile: "moodle-xml@1" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.files.some((file) => file.path === "imsmanifest.xml")).toBe(false);
    expect(result.files.some((file) => file.path === "media/source.txt")).toBe(false);
    const questions = result.files.find((file) => file.path === "moodle_questions.xml")?.data;
    expect(questions).toEqual(expect.any(String));
    expect(questions).toContain('<question type="multichoice">');
    expect(questions).toContain('<answer fraction="100"');
    expect(questions).toContain('href="@@PLUGINFILE@@/media/source.txt"');
    expect(questions).toContain("Keep media/source.txt visible.");
    expect(questions).not.toContain("@@PLUGINFILE@@/@@PLUGINFILE@@/");
    expect(questions).toContain(
      '<file name="source.txt" path="/media/" encoding="base64">c291cmNl</file>',
    );
  });

  it("accepts a canonical assessment package and emits a test resource graph", async () => {
    const sourceItem = fixtureXml("choice");
    const bytes = zipSync(
      Object.fromEntries(
        Object.entries({
          "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="test" type="imsqti_test_xmlv3p0" href="tests/assessment.xml">
      <file href="tests/assessment.xml"/>
      <dependency identifierref="choice"/>
    </resource>
    <resource identifier="choice" type="imsqti_item_xmlv3p0" href="items/choice.xml">
      <metadata><standard-alignment standard-id="standard-1">Use evidence.</standard-alignment></metadata>
      <file href="items/choice.xml"/>
    </resource>
  </resources>
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
    expect(result.diagnostics).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "source.package.shape.ambiguous" })]),
    );
    expect(result.reports).toHaveLength(1);
    const assessment = result.files.find((file) => file.path === "tests/assessment.xml")?.data;
    const manifest = result.files.find((file) => file.path === "imsmanifest.xml")?.data;
    expect(assessment).toEqual(expect.any(String));
    expect(assessment).toContain('<assessmentSection identifier="outer"');
    expect(assessment).toContain('<assessmentSection identifier="inner"');
    expect(assessment).toContain('href="../items/choice.xml"');
    expect(manifest).toEqual(expect.any(String));
    expect(manifest).toContain("<schemaversion>2.1</schemaversion>");
    expect(manifest).toContain('type="imsqti_test_xmlv2p1"');
    expect(manifest).toContain('<dependency identifierref="choice"/>');
    expect(manifest).toContain('identifier="choice"');
    expect(manifest).toContain('identifier="standard-1"');
    expect(manifest).toContain(">Use evidence.</standard-alignment>");
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
      { kind: "authoringPackage", package: choiceAuthoringPackage },
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
          ...choiceAuthoringPackage,
          items: choiceAuthoringPackage.items.map((item) => ({
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

describe("Moodle XML profile", () => {
  it("uses native multichoice with automatic scoring for a single-choice item", () => {
    const result = transcodeQti3Item(
      { kind: "xml", xml: fixtureXml("choice") },
      { profile: "moodle-xml@1" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.xml).toContain('<question type="multichoice">');
    expect(result.xml).toContain("<single>true</single>");
    expect(result.xml).toContain('<answer fraction="100"');
    expect(result.report.mappings[0]).toMatchObject({
      emittedInteraction: "multichoice",
      scoring: "automatic",
      fidelity: "exact",
    });
  });

  it("uses native matching and preserves every accessible label", () => {
    const result = transcodeQti3Item(
      { kind: "xml", xml: fixtureXml("match") },
      { profile: "moodle-xml@1" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.xml).toContain('<question type="matching">');
    expect(result.xml).toContain("<subquestion");
    expect(result.xml).toContain("Beds near the fence received less afternoon sun.");
    expect(result.report.mappings[0]).toMatchObject({
      emittedInteraction: "matching",
      scoring: "automatic",
    });
  });

  it("maps upload to an essay with a required Moodle attachment", () => {
    const result = transcodeQti3Item(
      { kind: "xml", xml: fixtureXml("upload") },
      { profile: "moodle-xml@1" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.xml).toContain('<question type="essay">');
    expect(result.xml).toContain("<attachments>1</attachments>");
    expect(result.xml).toContain("<attachmentsrequired>1</attachmentsrequired>");
    expect(result.report.mappings[0]).toMatchObject({
      emittedInteraction: "essay",
      scoring: "manual",
      fidelity: "normalized",
    });
  });

  it("preserves an explicit source maximum score as defaultgrade", () => {
    const xml = fixtureXml("choice").replace(
      '<qti-outcome-declaration identifier="SCORE"',
      '<qti-outcome-declaration identifier="SCORE" normal-maximum="7.5"',
    );
    const result = transcodeQti3Item({ kind: "xml", xml }, { profile: "moodle-xml@1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.xml).toContain("<defaultgrade>7.5</defaultgrade>");
    expect(result.report.fidelity).toBe("exact");
  });

  it("rejects malformed type-specific Moodle question structures", () => {
    const diagnostics = validateGeneratedTargetXml(
      `<?xml version="1.0"?><quiz><question type="multichoice"><name><text>Bad</text></name><questiontext format="html"><text>Prompt</text></questiontext><defaultgrade>1</defaultgrade><penalty>0</penalty><hidden>0</hidden><single>true</single><answer fraction="100"><text>Only one</text></answer></question></quiz>`,
      "moodle-xml",
    );
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "target.moodle_xml.semantic",
        message: expect.stringContaining("requires at least two answers"),
      }),
    ]);
  });
});

describe("qti3 transcoder composite items", () => {
  it.each(["moodle-xml@1", "qti12-standard@1", "qti21-standard@1", "qti22-standard@1"] as const)(
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
      const expectedScoring =
        profile === "qti12-standard@1"
          ? "automatic"
          : profile === "moodle-xml@1"
            ? "manual"
            : "unscored";
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
