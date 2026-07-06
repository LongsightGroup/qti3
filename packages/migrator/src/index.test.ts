import { parseQtiXml, validateAssessmentItem } from "@longsightgroup/qti3-core";
import { writeQti3PackageFilesResult } from "@longsightgroup/qti3-writer";
import { describe, expect, it } from "vitest";
import {
  detectQtiMigrationSource,
  migrateQtiItemToQti3,
  migrateQtiResourceToQti3,
  migrateQtiToQti3,
  migrateQtiToQti3Package,
} from "./index.js";
import { createStoredZip } from "./test-helpers.js";

describe("@longsightgroup/qti3-migrator", () => {
  it("migrates a QTI 2.1 choice package to valid QTI 3 XML", async () => {
    const bytes = createStoredZip({
      "imsmanifest.xml": manifest("imsqti_item_xmlv2p1", "items/choice.xml"),
      "items/choice.xml": qti21ChoiceItem(),
      "items/image.png": new Uint8Array([1, 2, 3]),
    });

    const result = await migrateQtiToQti3({ filename: "choice.zip", bytes });

    expect(result.sourceFormat).toBe("qti21");
    expect(result.items).toHaveLength(1);
    expect(result.assets.map((asset) => asset.path)).toContain("items/image.png");
    expect(result.items[0]?.authoringItem?.interactionType).toBe("choice");
    expect(result.items[0]?.diagnostics).toEqual([]);
    expectValidXml(result.items[0]?.xml ?? "");
  });

  it("migrates a QTI 2.1 package into writer package input", async () => {
    const bytes = createStoredZip({
      "imsmanifest.xml": manifest("imsqti_item_xmlv2p1", "items/choice.xml"),
      "items/choice.xml": qti21ChoiceItem(),
      "items/image.png": new Uint8Array([1, 2, 3]),
    });

    const migrated = await migrateQtiToQti3Package({ filename: "choice.zip", bytes });

    expect(migrated).toMatchObject({ ok: true });
    if (!migrated.ok) throw new Error("Expected package migration to succeed.");
    expect(migrated.package.items).toEqual([
      expect.objectContaining({
        kind: "xml",
        path: "items/choice.xml",
        identifier: "choice_item",
        assets: [expect.objectContaining({ path: "items/image.png" })],
      }),
    ]);
    const files = writeQti3PackageFilesResult(migrated.package);
    expect(files).toMatchObject({ ok: true });
    if (!files.ok) throw new Error("Expected writer package files to emit.");
    expect(files.files.map((file) => file.path)).toContain("imsmanifest.xml");
    expect(files.files.map((file) => file.path)).toContain("items/choice.xml");
    expect(files.files.map((file) => file.path)).toContain("items/image.png");
  });

  it("detects QTI 2.2 packages through the QTI 2.x parser", () => {
    const bytes = createStoredZip({
      "imsmanifest.xml": manifest("imsqti_item_xmlv2p2", "item.xml"),
      "item.xml": qti21ChoiceItem(),
    });

    const detection = detectQtiMigrationSource({ filename: "qti22.zip", bytes });

    expect(detection.supported).toBe(true);
    expect(detection.sourceFormat).toBe("qti22");
  });

  it("migrates QTI 1.2 choice, text entry, essay, and hotspot items with explicit safe repairs", async () => {
    const result = await migrateQtiToQti3(
      { filename: "qti12.xml", xml: qti12Items() },
      { repairPolicy: "safe" },
    );

    expect(result.sourceFormat).toBe("qti12");
    expect(result.items.map((item) => item.authoringItem?.interactionType)).toEqual([
      "choice",
      "textEntry",
      "extendedText",
      "hotspot",
    ]);
    expect(result.items[3]?.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "qti12_hotspot_image_missing_repaired",
    );
    for (const item of result.items) expectValidXml(item.xml ?? "");
  });

  it("migrates Canvas QTI 1.2 multi-response matching items", () => {
    const result = migrateQtiItemToQti3({
      filename: "canvas_matching.xml",
      xml: canvasQti12MatchingItem(),
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.authoringItem?.interactionType).toBe("match");
    if (result.authoringItem?.interactionType !== "match") {
      throw new Error("Expected match authoring item.");
    }
    expect(result.authoringItem.sources.map((source) => source.identifier)).toEqual([
      "response_source_a",
      "response_source_b",
    ]);
    expect(result.authoringItem.targets.map((target) => target.identifier)).toEqual([
      "target_a",
      "target_b",
      "target_c",
    ]);
    expect(result.authoringItem.correctResponse).toEqual([
      { sourceIdentifier: "response_source_a", targetIdentifier: "target_a" },
      { sourceIdentifier: "response_source_b", targetIdentifier: "target_b" },
    ]);
    expectValidXml(result.xml ?? "");
  });

  it("detects Canvas IMSCC QTI 1.2 assessment resources", async () => {
    const bytes = createStoredZip({
      "imsmanifest.xml": manifest(
        "imsqti_xmlv1p2/imscc_xmlv1p1/assessment",
        "assessment/quiz1.xml",
      ),
      "assessment/quiz1.xml": canvasQti12MatchingItem(),
      "web_resources/diagram.png": new Uint8Array([1, 2, 3]),
    });

    const detection = detectQtiMigrationSource({ filename: "canvas.imscc", bytes });
    const result = await migrateQtiToQti3({ filename: "canvas.imscc", bytes });

    expect(detection.supported).toBe(true);
    expect(detection.sourceFormat).toBe("qti12");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.authoringItem?.interactionType).toBe("match");
    expect(result.assets.map((asset) => asset.path)).toContain("web_resources/diagram.png");
    expectValidXml(result.items[0]?.xml ?? "");
  });

  it("emits unique sibling paths for multi-item QTI 1.2 package resources", async () => {
    const bytes = createStoredZip({
      "imsmanifest.xml": manifest("imsqti_xmlv1p2", "assessment/quiz.xml"),
      "assessment/quiz.xml": qti12Items(),
      "items/image.png": new Uint8Array([1, 2, 3]),
    });

    const result = await migrateQtiToQti3(
      { filename: "qti12-package.zip", bytes },
      { repairPolicy: "safe" },
    );
    const migrated = await migrateQtiToQti3Package(
      { filename: "qti12-package.zip", bytes },
      { repairPolicy: "safe" },
    );

    expect(result.items.map((item) => item.href)).toEqual([
      "assessment/quiz_choice12.xml",
      "assessment/quiz_text12.xml",
      "assessment/quiz_essay12.xml",
      "assessment/quiz_hotspot12.xml",
    ]);
    expect(migrated).toMatchObject({ ok: true });
    if (!migrated.ok) throw new Error("Expected package migration to succeed.");
    const files = writeQti3PackageFilesResult(migrated.package);
    expect(files).toMatchObject({ ok: true });
    if (!files.ok) throw new Error("Expected writer package files to emit.");
    expect(files.files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        "assessment/quiz_choice12.xml",
        "assessment/quiz_text12.xml",
        "assessment/quiz_essay12.xml",
        "assessment/quiz_hotspot12.xml",
      ]),
    );
  });

  it("preserves the source href for single-item QTI 1.2 package resources", async () => {
    const bytes = createStoredZip({
      "imsmanifest.xml": manifest("imsqti_xmlv1p2", "assessment/quiz.xml"),
      "assessment/quiz.xml": canvasQti12MatchingItem(),
    });

    const result = await migrateQtiToQti3({ filename: "single-qti12.zip", bytes });

    expect(result.items.map((item) => item.href)).toEqual(["assessment/quiz.xml"]);
  });

  it("migrates one resource file closure into launchable QTI 3 package entries", async () => {
    const result = await migrateQtiResourceToQti3({
      sourcePath: "assessment/choice.xml",
      title: "Choice Resource",
      files: {
        "assessment\\choice.xml": new TextEncoder().encode(qti21ChoiceItem()),
        "assessment\\image.png": new Uint8Array([1, 2, 3]),
      },
    });

    expect(result).toMatchObject({
      ok: true,
      title: "Choice Resource",
      status: "converted",
      sourceFormat: "qti21",
      launchHref: "assessment/choice.xml",
      itemHrefs: ["assessment/choice.xml"],
    });
    expect(result.entries.map((entry) => entry.path)).toEqual([
      "imsmanifest.xml",
      "assessment/choice.xml",
      "assessment/image.png",
    ]);
    expect(result.entries.find((entry) => entry.path === "assessment/image.png")?.mediaType).toBe(
      "image/png",
    );
  });

  it("returns resource migration diagnostics instead of throwing for missing source files", async () => {
    const result = await migrateQtiResourceToQti3({
      sourcePath: "assessment/missing.xml",
      files: {
        "assessment/image.png": new Uint8Array([1, 2, 3]),
      },
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.title).toBe("assessment/missing.xml");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "resource_source_missing",
    );
  });

  it("returns resource migration diagnostics instead of throwing for unsupported XML", async () => {
    const result = await migrateQtiResourceToQti3({
      sourcePath: "assessment/not-qti.xml",
      files: {
        "assessment/not-qti.xml": new TextEncoder().encode("<not-qti/>"),
      },
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("source_unsupported");
    expect(result.migration).toBeDefined();
  });

  it("emits unique sibling paths for multi-item QTI 1.2 resource migration", async () => {
    const result = await migrateQtiResourceToQti3(
      {
        sourcePath: "assessment/quiz.xml",
        files: {
          "assessment/quiz.xml": new TextEncoder().encode(qti12Items()),
          "assessment/shared.png": new Uint8Array([1, 2, 3]),
        },
      },
      { repairPolicy: "safe" },
    );

    expect(result).toMatchObject({
      ok: true,
      launchHref: "assessment/quiz_choice12.xml",
    });
    if (!result.ok) throw new Error("Expected multi-item resource migration to succeed.");
    expect(result.itemHrefs).toEqual([
      "assessment/quiz_choice12.xml",
      "assessment/quiz_text12.xml",
      "assessment/quiz_essay12.xml",
      "assessment/quiz_hotspot12.xml",
    ]);
    expect(result.entries.map((entry) => entry.path)).toEqual(
      expect.arrayContaining([
        "assessment/quiz_choice12.xml",
        "assessment/quiz_text12.xml",
        "assessment/quiz_essay12.xml",
        "assessment/quiz_hotspot12.xml",
        "assessment/shared.png",
      ]),
    );
    expect(result.entries.filter((entry) => entry.path === "assessment/shared.png")).toHaveLength(
      1,
    );
  });

  it("rejects source repairs by default and allows them only under safe policy", () => {
    const strict = migrateQtiItemToQti3({
      filename: "bad-choice.xml",
      xml: qti12ChoiceWithoutKey(),
    });
    expect(strict.xml).toBeUndefined();
    expect(strict.diagnostics[0]?.code).toBe("qti12_choice_correct_response_missing");

    const safe = migrateQtiItemToQti3(
      { filename: "bad-choice.xml", xml: qti12ChoiceWithoutKey() },
      { repairPolicy: "safe" },
    );
    expect(safe.xml).toContain("<qti-choice-interaction");
    expect(safe.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "qti12_choice_correct_response_missing_repaired",
    );
  });

  it("migrates QTI 2.x inline, hottext, gap, and graphic interactions", async () => {
    const items = [
      qti21InlineChoiceItem(),
      qti21HottextItem(),
      qti21GapMatchItem(),
      qti21GraphicOrderItem(),
      qti21GraphicAssociateItem(),
      qti21GraphicGapMatchItem(),
    ];

    const migrated = items.map((xml, index) =>
      migrateQtiItemToQti3({ filename: `item-${index}.xml`, xml }),
    );

    expect(migrated.map((item) => item.authoringItem?.interactionType)).toEqual([
      "inlineChoice",
      "hottext",
      "gapMatch",
      "graphicOrder",
      "graphicAssociate",
      "graphicGapMatch",
    ]);
    for (const item of migrated) {
      expect(item.diagnostics).toEqual([]);
      expectValidXml(item.xml ?? "");
    }
  });

  it("reports unsupported interactions by default and stubs only when requested", () => {
    const strict = migrateQtiItemToQti3({ filename: "bad.xml", xml: unsupportedQti21Item() });
    expect(strict.xml).toBeUndefined();
    expect(strict.diagnostics[0]?.code).toBe("qti2_interaction_unsupported");

    const stubbed = migrateQtiItemToQti3(
      { filename: "bad.xml", xml: unsupportedQti21Item() },
      { unsupportedPolicy: "stub" },
    );
    expect(stubbed.xml).toContain("<qti-extended-text-interaction");
    expect(stubbed.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "unsupported_item_stubbed",
    );
  });

  it("rejects composite QTI 2.x items instead of partially migrating the first interaction", () => {
    const result = migrateQtiItemToQti3({ filename: "composite.xml", xml: compositeQti21Item() });

    expect(result.xml).toBeUndefined();
    expect(result.diagnostics[0]?.code).toBe("qti2_composite_interactions_unsupported");
  });

  it("reports package test structure loss explicitly", async () => {
    const bytes = createStoredZip({
      "imsmanifest.xml": manifestWithTest("imsqti_item_xmlv2p1", "items/choice.xml"),
      "items/choice.xml": qti21ChoiceItem(),
      "tests/test.xml": "<assessmentTest/>",
    });

    const result = await migrateQtiToQti3({ filename: "test-package.zip", bytes });

    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "assessment_test_structure_not_migrated",
    );
    expectValidXml(result.items[0]?.xml ?? "");
  });
});

function expectValidXml(xml: string): void {
  const parsed = parseQtiXml(xml);
  expect(parsed.ok).toBe(true);
  expect(parsed.diagnostics).toEqual([]);
  expect(parsed.document).toBeDefined();
  const validation = validateAssessmentItem(parsed.document!);
  expect(validation.ok).toBe(true);
  expect(validation.diagnostics).toEqual([]);
}

function manifest(type: string, href: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST">
  <organizations/>
  <resources>
    <resource identifier="ITEM_1" type="${type}" href="${href}">
      <file href="${href}"/>
      <file href="items/image.png"/>
    </resource>
  </resources>
</manifest>`;
}

function manifestWithTest(type: string, href: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST">
  <organizations/>
  <resources>
    <resource identifier="TEST_1" type="imsqti_test_xmlv2p1" href="tests/test.xml">
      <file href="tests/test.xml"/>
    </resource>
    <resource identifier="ITEM_1" type="${type}" href="${href}">
      <file href="${href}"/>
    </resource>
  </resources>
</manifest>`;
}

function qti21ChoiceItem(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="choice_item" title="Choice">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>B</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <p>Pick one.</p>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">Alpha</simpleChoice>
      <simpleChoice identifier="B">Beta</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;
}

function qti21InlineChoiceItem(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="inline_item" title="Inline">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>B</value></correctResponse>
  </responseDeclaration>
  <itemBody><p>Choose <inlineChoiceInteraction responseIdentifier="RESPONSE"><inlineChoice identifier="A">one</inlineChoice><inlineChoice identifier="B">two</inlineChoice></inlineChoiceInteraction>.</p></itemBody>
</assessmentItem>`;
}

function qti21HottextItem(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="hottext_item" title="Hottext">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>H1</value></correctResponse></responseDeclaration>
  <itemBody><hottextInteraction responseIdentifier="RESPONSE" maxChoices="1"><p>Select <hottext identifier="H1">this</hottext>.</p></hottextInteraction></itemBody>
</assessmentItem>`;
}

function qti21GapMatchItem(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="gap_item" title="Gap">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair"><correctResponse><value>A G1</value></correctResponse></responseDeclaration>
  <itemBody><gapMatchInteraction responseIdentifier="RESPONSE"><gapText identifier="A" matchMax="1">Alpha</gapText><p><gap identifier="G1"/></p></gapMatchInteraction></itemBody>
</assessmentItem>`;
}

function qti21GraphicOrderItem(): string {
  return graphicItem(
    "graphicOrderInteraction",
    "ordered",
    "identifier",
    "A B",
    `<hotspotChoice identifier="A" shape="rect" coords="0,0,10,10"/><hotspotChoice identifier="B" shape="rect" coords="10,0,20,10"/>`,
  );
}

function qti21GraphicAssociateItem(): string {
  return graphicItem(
    "graphicAssociateInteraction",
    "multiple",
    "pair",
    "A B",
    `<associableHotspot identifier="A" shape="rect" coords="0,0,10,10" matchMax="1"/><associableHotspot identifier="B" shape="rect" coords="10,0,20,10" matchMax="1"/>`,
  );
}

function qti21GraphicGapMatchItem(): string {
  return graphicItem(
    "graphicGapMatchInteraction",
    "multiple",
    "directedPair",
    "G T",
    `<gapText identifier="G" matchMax="1">Alpha</gapText><associableHotspot identifier="T" shape="rect" coords="0,0,10,10" matchMax="1"/>`,
  );
}

function graphicItem(
  interactionName: string,
  cardinality: string,
  baseType: string,
  value: string,
  children: string,
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="${interactionName}" title="${interactionName}">
  <responseDeclaration identifier="RESPONSE" cardinality="${cardinality}" baseType="${baseType}"><correctResponse><value>${value}</value></correctResponse></responseDeclaration>
  <itemBody><${interactionName} responseIdentifier="RESPONSE"><object data="image.png" alt="Image" type="image/png"/>${children}</${interactionName}></itemBody>
</assessmentItem>`;
}

function unsupportedQti21Item(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="bad" title="Bad"><itemBody><drawingInteraction responseIdentifier="RESPONSE"/></itemBody></assessmentItem>`;
}

function qti12Items(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop>
  <item ident="choice12" title="Choice 12"><presentation><material><mattext>Pick.</mattext></material><response_lid ident="RESPONSE" rcardinality="Single"><render_choice><response_label ident="A"><material><mattext>A</mattext></material></response_label><response_label ident="B"><material><mattext>B</mattext></material></response_label></render_choice></response_lid></presentation><resprocessing><respcondition><conditionvar><varequal respident="RESPONSE">B</varequal></conditionvar></respcondition></resprocessing></item>
  <item ident="text12" title="Text 12"><presentation><material><mattext>Type.</mattext></material><response_str ident="RESPONSE"><render_fib/></response_str></presentation><resprocessing><respcondition><conditionvar><varequal respident="RESPONSE">answer</varequal></conditionvar></respcondition></resprocessing></item>
  <item ident="essay12" title="Essay question"><presentation><material><mattext>Write.</mattext></material></presentation></item>
  <item ident="hotspot12" title="Hotspot 12"><presentation><material><mattext>Click.</mattext></material><response_lid ident="RESPONSE"><render_hotspot><response_label ident="H1" rarea="Rectangle" coords="0,0,10,10"/></render_hotspot></response_lid></presentation><resprocessing><respcondition><conditionvar><varequal respident="RESPONSE">H1</varequal></conditionvar></respcondition></resprocessing></item>
</questestinterop>`;
}

function canvasQti12MatchingItem(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd">
  <assessment ident="canvas_assessment" title="Sample Matching Assessment">
    <section ident="root_section">
      <item ident="canvas_matching" title="Match Sources to Targets">
        <itemmetadata>
          <qtimetadata>
            <qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>matching_question</fieldentry></qtimetadatafield>
          </qtimetadata>
        </itemmetadata>
        <presentation>
          <material><mattext texttype="text/html">&lt;p&gt;Match each source to its target.&lt;/p&gt;</mattext></material>
          <response_lid ident="response_source_a">
            <material><mattext texttype="text/plain">Source A</mattext></material>
            <render_choice>
              <response_label ident="target_a"><material><mattext>Target A</mattext></material></response_label>
              <response_label ident="target_b"><material><mattext>Target B</mattext></material></response_label>
              <response_label ident="target_c"><material><mattext>Target C</mattext></material></response_label>
            </render_choice>
          </response_lid>
          <response_lid ident="response_source_b">
            <material><mattext texttype="text/plain">Source B</mattext></material>
            <render_choice>
              <response_label ident="target_a"><material><mattext>Target A</mattext></material></response_label>
              <response_label ident="target_b"><material><mattext>Target B</mattext></material></response_label>
              <response_label ident="target_c"><material><mattext>Target C</mattext></material></response_label>
            </render_choice>
          </response_lid>
        </presentation>
        <resprocessing>
          <respcondition><conditionvar><varequal respident="response_source_a">target_a</varequal></conditionvar><setvar varname="SCORE" action="Add">50</setvar></respcondition>
          <respcondition><conditionvar><varequal respident="response_source_b">target_b</varequal></conditionvar><setvar varname="SCORE" action="Add">50</setvar></respcondition>
        </resprocessing>
      </item>
    </section>
  </assessment>
</questestinterop>`;
}

function qti12ChoiceWithoutKey(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<item ident="choice12" title="Choice 12"><presentation><material><mattext>Pick.</mattext></material><response_lid ident="RESPONSE" rcardinality="Single"><render_choice><response_label ident="A"><material><mattext>A</mattext></material></response_label><response_label ident="B"><material><mattext>B</mattext></material></response_label></render_choice></response_lid></presentation></item>`;
}

function compositeQti21Item(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="composite" title="Composite">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>B</value></correctResponse></responseDeclaration>
  <responseDeclaration identifier="RESPONSE_2" cardinality="single" baseType="string"><correctResponse><value>answer</value></correctResponse></responseDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction>
    <textEntryInteraction responseIdentifier="RESPONSE_2"/>
  </itemBody>
</assessmentItem>`;
}
