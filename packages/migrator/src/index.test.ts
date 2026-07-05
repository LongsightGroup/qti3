import { parseQtiXml, validateAssessmentItem } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import { detectQtiMigrationSource, migrateQtiItemToQti3, migrateQtiToQti3 } from "./index.js";
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

  it("detects QTI 2.2 packages through the QTI 2.x parser", () => {
    const bytes = createStoredZip({
      "imsmanifest.xml": manifest("imsqti_item_xmlv2p2", "item.xml"),
      "item.xml": qti21ChoiceItem(),
    });

    const detection = detectQtiMigrationSource({ filename: "qti22.zip", bytes });

    expect(detection.supported).toBe(true);
    expect(detection.sourceFormat).toBe("qti22");
  });

  it("migrates QTI 1.2 choice, text entry, essay, and hotspot items", async () => {
    const result = await migrateQtiToQti3({ filename: "qti12.xml", xml: qti12Items() });

    expect(result.sourceFormat).toBe("qti12");
    expect(result.items.map((item) => item.authoringItem?.interactionType)).toEqual([
      "choice",
      "textEntry",
      "extendedText",
      "hotspot",
    ]);
    for (const item of result.items) expectValidXml(item.xml ?? "");
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
