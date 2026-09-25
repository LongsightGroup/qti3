import {
  createItemSession,
  parseQtiXml,
  validateAssessmentItem,
  type QtiValue,
} from "@longsightgroup/qti3-core";
import { buildQti3TextEntryItem, qti3TrustedXmlFragment } from "@longsightgroup/qti3-writer";
import { describe, expect, it } from "vitest";
import { migrateQtiItemToQti3 } from "./index.js";

// Independent expected grades from QTI 2.1 §8.2 and QTI 1.2 conditionvar/setvar.
// Migration must either preserve these grades or refuse to produce an item.
function qti2(processing: string, correct = "A", string = false) {
  return `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="scoring" title="Scoring" adaptive="false" timeDependent="false">
    <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="${string ? "string" : "identifier"}"><correctResponse><value>${correct}</value></correctResponse></responseDeclaration>
    <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
    <itemBody>${string ? '<p><textEntryInteraction responseIdentifier="RESPONSE"/></p>' : '<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction>'}</itemBody>${processing}</assessmentItem>`;
}
function score(xml: string | undefined, value: QtiValue, identifier = "RESPONSE"): QtiValue {
  expect(xml).toBeDefined();
  const parsed = parseQtiXml(xml ?? "");
  expect(parsed.diagnostics).toEqual([]);
  if (!parsed.document) throw new Error("Expected migrated item");
  expect(validateAssessmentItem(parsed.document).diagnostics).toEqual([]);
  const session = createItemSession(parsed.document);
  session.respond(identifier, value);
  return session.score().outcomes.SCORE ?? null;
}
function qti12(conditions: string, declaration = "") {
  return `<item ident="legacy" title="Legacy"><presentation><response_lid ident="RESPONSE" rcardinality="Single"><render_choice><response_label ident="A"><material><mattext>A</mattext></material></response_label><response_label ident="B"><material><mattext>B</mattext></material></response_label></render_choice></response_lid></presentation><resprocessing>${declaration}${conditions}</resprocessing></item>`;
}
function condition(predicate: string, value = "1", action = "Set", continuation = "No") {
  return `<respcondition continue="${continuation}"><conditionvar>${predicate}</conditionvar><setvar varname="SCORE" action="${action}">${value}</setvar></respcondition>`;
}
const equalsA = '<varequal respident="RESPONSE">A</varequal>';

describe("migration scoring contracts", () => {
  it.each(["", ' template="http://www.imsglobal.org/question/qti_v2p1/rptemplates/match_correct"'])(
    "rejects custom rules even when a template is also supplied (%s)",
    (attributes) => {
      const result = migrateQtiItemToQti3({
        xml: qti2(
          `<responseProcessing${attributes}><setOutcomeValue identifier="SCORE"><baseValue baseType="float">7</baseValue></setOutcomeValue></responseProcessing>`,
        ),
      });
      expect(result.xml).toBeUndefined();
      expect(result.authoringItem).toBeUndefined();
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "qti2_response_processing_not_preserved",
          severity: "error",
        }),
      );
    },
  );
  it.each(["http", "https"])("preserves canonical match_correct scoring (%s)", (scheme) => {
    const result = migrateQtiItemToQti3({
      xml: qti2(
        `<responseProcessing template="${scheme}://www.imsglobal.org/question/qti_v2p1/rptemplates/match_correct"/>`,
      ),
    });
    expect(result.diagnostics).toEqual([]);
    for (const [response, expected] of [
      [null, 0],
      ["A", 1],
      ["B", 0],
    ] satisfies Array<[QtiValue, number]>)
      expect(score(result.xml, response)).toBe(expected);
  });
  it.each([
    "https://example.org/match_correct",
    "http://www.imsglobal.org/question/qti_v2p1/rptemplates/map_response",
  ])("rejects unpreserved template %s", (template) => {
    const result = migrateQtiItemToQti3({
      xml: qti2(`<responseProcessing template="${template}"/>`),
    });
    expect(result.xml).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "qti2_response_processing_not_preserved" }),
    );
  });
  it.each([
    ["negated key", condition(`<not>${equalsA}</not>`)],
    ["zero-score distractor", condition(equalsA, "0")],
    ["weighted key", condition(equalsA, "7")],
    ["additive key", condition(equalsA, "50", "Add")],
    ["overriding continuation", condition(equalsA, "1", "Set", "Yes") + condition(equalsA, "0")],
    [
      "multiple predicates without actions",
      `<respcondition><conditionvar>${equalsA}</conditionvar></respcondition>`,
    ],
    [
      "alternative keys",
      condition(equalsA) + condition('<varequal respident="RESPONSE">B</varequal>'),
    ],
  ])("rejects %s rather than manufacturing an answer key", (_label, rules) => {
    for (const repairPolicy of ["none", "safe"] as const) {
      const result = migrateQtiItemToQti3({ xml: qti12(rules) }, { repairPolicy });
      expect(result.xml).toBeUndefined();
      expect(result.authoringItem).toBeUndefined();
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "qti12_response_processing_unsupported",
          severity: "error",
        }),
      );
    }
  });
  it("preserves a positive single-key program", () => {
    const result = migrateQtiItemToQti3({ xml: qti12(condition(equalsA)) });
    expect(result.diagnostics).toEqual([]);
    for (const [response, expected] of [
      [null, 0],
      ["A", 1],
      ["B", 0],
    ] satisfies Array<[QtiValue, number]>)
      expect(score(result.xml, response)).toBe(expected);
  });
  it("rejects a nonzero source default", () => {
    const result = migrateQtiItemToQti3({
      xml: qti12(
        condition(equalsA),
        '<outcomes><decvar varname="SCORE" defaultval="5"/></outcomes>',
      ),
    });
    expect(result.xml).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "qti12_response_processing_unsupported" }),
    );
  });
});

describe("string value fidelity (QTI string datatype preserves whitespace)", () => {
  it.each([" A ", " ", "A B"])("preserves migration and direct writer answer %j", (answer) => {
    const migrated = migrateQtiItemToQti3({ xml: qti2("", answer, true) });
    expect(migrated.diagnostics).toEqual([]);
    const authored = buildQti3TextEntryItem({
      identifier: "raw-string",
      title: "Raw string",
      bodyHtml: qti3TrustedXmlFragment(
        '<p><qti-text-entry-interaction response-identifier="RESPONSE"/></p>',
      ),
      responses: [
        {
          responseIdentifier: "RESPONSE",
          correctResponse: answer,
          answers: [{ value: answer, score: 1, caseSensitive: true }],
        },
      ],
    });
    for (const xml of [migrated.xml, authored]) {
      expect(score(xml, answer)).toBe(1);
      if (answer.trim() !== answer) expect(score(xml, answer.trim())).toBe(0);
    }
  });
});

describe("legacy scoring preservation and refusal", () => {
  // Preserve the formerly accepted Canvas scoring example as a refusal regression.
  it("rejects Canvas matching that awards 50 points per pair", () => {
    const responses = ["R", "S"]
      .map(
        (id) =>
          `<response_lid ident="${id}" rcardinality="Single"><render_choice><response_label ident="A"><material><mattext>A</mattext></material></response_label><response_label ident="B"><material><mattext>B</mattext></material></response_label></render_choice></response_lid>`,
      )
      .join("");
    const rules = ["R", "S"]
      .map((id) => condition(`<varequal respident="${id}">A</varequal>`, "50", "Add", "Yes"))
      .join("");
    const result = migrateQtiItemToQti3({
      xml: `<item ident="canvas" title="Canvas"><presentation>${responses}</presentation><resprocessing>${rules}</resprocessing></item>`,
    });
    expect(result.xml).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "qti12_response_processing_unsupported" }),
    );
  });

  it("keeps coordinates out of labels for supported QTI 1.2 hotspot scoring", () => {
    const result = migrateQtiItemToQti3({
      xml: `<item ident="hotspot" title="Hotspot"><presentation><material><matimage uri="map.png" width="100" height="100"/></material><response_lid ident="RESPONSE" rcardinality="Single"><render_hotspot><response_label ident="A" rarea="Rectangle">0,0,10,10</response_label></render_hotspot></response_lid></presentation><resprocessing>${condition(equalsA)}</resprocessing></item>`,
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.authoringItem).toMatchObject({
      interactionType: "hotspot",
      choices: [{ coords: "0,0,10,10", hotspotLabel: undefined }],
    });
    expect(score(result.xml, "A")).toBe(1);
    expect(score(result.xml, null)).toBe(0);
  });

  it("preserves an identical inline scoring tree, even with an overridden template", () => {
    const rules = `<responseCondition><responseIf><match><variable identifier="R"/><correct identifier="R"/></match><setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue></responseIf><responseElse><setOutcomeValue identifier="SCORE"><baseValue baseType="float">0</baseValue></setOutcomeValue></responseElse></responseCondition>`;
    const xml = qti2(
      `<responseProcessing template="https://example.org/overridden">${rules}</responseProcessing>`,
    ).replaceAll('="RESPONSE"', '="R"');
    const result = migrateQtiItemToQti3({ xml });
    expect(result.diagnostics).toEqual([]);
    for (const [response, expected] of [
      [null, 0],
      ["A", 1],
      ["B", 0],
    ] satisfies Array<[QtiValue, number]>)
      expect(score(result.xml, response, "R")).toBe(expected);
  });

  it.each(["", "Yes", "No"])("preserves QTI 1.2 varequal case=%j (default Yes)", (mode) => {
    const xml = `<item ident="text" title="Text"><presentation><response_str ident="RESPONSE" rcardinality="Single"><render_fib/></response_str></presentation><resprocessing>${condition(`<varequal respident="RESPONSE" ${mode ? `case="${mode}"` : ""}>Answer</varequal>`)}</resprocessing></item>`;
    const result = migrateQtiItemToQti3({ xml });
    expect(result.diagnostics).toEqual([]);
    expect(score(result.xml, "Answer")).toBe(1);
    expect(score(result.xml, "answer")).toBe(mode === "No" ? 1 : 0);
  });
  it("rejects authored scoring on a manually graded essay", () => {
    const xml = qti12(condition(equalsA)).replace(
      "<presentation>",
      "<itemmetadata><qtimetadata><qtimetadatafield><fieldlabel>qmd_itemtype</fieldlabel><fieldentry>Essay</fieldentry></qtimetadatafield></qtimetadata></itemmetadata><presentation>",
    );
    const result = migrateQtiItemToQti3({ xml });
    expect(result.xml).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "qti12_response_processing_unsupported" }),
    );
  });
});
