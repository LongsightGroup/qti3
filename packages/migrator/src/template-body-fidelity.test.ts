import { expect, it } from "vitest";
import { createItemSession, parseQtiXml, validateAssessmentItem } from "@longsightgroup/qti3-core";
import { migrateQtiItemToQti3, migrateQtiToQti3Package } from "./index.js";

// QTI 2.1: optional correctResponse is not an implied key; templateProcessing may replace it.
const response = (cardinality: string, baseType: string, correct: string) =>
  `<responseDeclaration identifier="RESPONSE" cardinality="${cardinality}" baseType="${baseType}">${correct}</responseDeclaration>`;
const key = "<correctResponse><value>A</value></correctResponse>";
function item(declaration: string, body: string, template = "") {
  return `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="fidelity" title="Fidelity" adaptive="false" timeDependent="false">${declaration}<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>${template}<itemBody>${body}</itemBody><responseProcessing template="http://www.imsglobal.org/question/qti_v2p1/rptemplates/match_correct"/></assessmentItem>`;
}
const order =
  '<orderInteraction responseIdentifier="RESPONSE" shuffle="false"><simpleChoice identifier="A">Alpha</simpleChoice><simpleChoice identifier="B">Beta</simpleChoice></orderInteraction>';
const choice =
  '<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">Alpha</simpleChoice><simpleChoice identifier="B">Beta</simpleChoice></choiceInteraction>';
for (const repairPolicy of ["none", "safe"] as const) {
  it.each([
    [response("ordered", "identifier", ""), order],
    [
      response("single", "integer", ""),
      '<sliderInteraction responseIdentifier="RESPONSE" lowerBound="0" upperBound="10"/>',
    ],
  ])(`refuses missing answer keys with repair=${repairPolicy}`, (declaration, body) => {
    const result = migrateQtiItemToQti3({ xml: item(declaration, body) }, { repairPolicy });
    expect(result.xml).toBeUndefined();
    expect(result.authoringItem).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "qti2_correct_response_not_preserved", severity: "error" }),
    );
  });
  it(`refuses lost template processing with repair=${repairPolicy}`, async () => {
    const xml = item(
      response("single", "identifier", key),
      choice,
      '<templateProcessing><setCorrectResponse identifier="RESPONSE"><baseValue baseType="identifier">B</baseValue></setCorrectResponse></templateProcessing>',
    );
    // Source grades: A=0, B=1 after template processing. Static A=1 is never an acceptable conversion.
    const result = migrateQtiItemToQti3({ xml }, { repairPolicy });
    expect(result.xml).toBeUndefined();
    expect(result.authoringItem).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "qti2_template_not_preserved", severity: "error" }),
    );
    expect((await migrateQtiToQti3Package({ xml }, { repairPolicy })).ok).toBe(false);
  });
}

// QTI 2 itemBody / hottextInteraction / gapMatchInteraction: preserve authored content order.
it.each(["hottext", "gap"])(
  "preserves %s prompt and surrounding paragraphs without changing grades",
  (kind) => {
    const gap = kind === "gap";
    const declaration = response(
      gap ? "multiple" : "single",
      gap ? "directedPair" : "identifier",
      gap ? "<correctResponse><value>A G</value></correctResponse>" : key,
    );
    const interaction = gap
      ? '<gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false"><prompt>Place the label.</prompt><gapText identifier="A" matchMax="1">Alpha</gapText><p>Sentence <gap identifier="G"/>.</p></gapMatchInteraction>'
      : '<hottextInteraction responseIdentifier="RESPONSE" maxChoices="1"><prompt>Select the adjective.</prompt><p>The <hottext identifier="A">green</hottext> door.</p></hottextInteraction>';
    const result = migrateQtiItemToQti3({
      xml: item(
        declaration,
        `<div><p>Introduction.</p>${interaction}<p>Trailing instructions.</p></div>`,
      ),
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.xml).toBeDefined();
    const parsed = parseQtiXml(result.xml!);
    expect(parsed.diagnostics).toEqual([]);
    if (!parsed.document) throw new Error("Expected item");
    expect(validateAssessmentItem(parsed.document).diagnostics).toEqual([]);
    const xml = result.xml!;
    const prompt = gap ? "Place the label." : "Select the adjective.";
    expect(xml.indexOf("Introduction.")).toBeLessThan(xml.indexOf(prompt));
    expect(xml.indexOf(prompt)).toBeLessThan(xml.indexOf("Trailing instructions."));
    expect(xml).not.toContain("qti-interaction-placeholder");
    const session = createItemSession(parsed.document);
    expect(session.score().outcomes.SCORE).toBe(0);
    session.respond("RESPONSE", gap ? ["A G"] : "A");
    expect(session.score().outcomes.SCORE).toBe(1);
    session.respond("RESPONSE", null);
    expect(session.score().outcomes.SCORE).toBe(0);
  },
);

it("refuses invalid packed identifier answer keys instead of silently splitting them", () => {
  const result = migrateQtiItemToQti3({
    xml: item(
      response("ordered", "identifier", "<correctResponse><value>A B</value></correctResponse>"),
      order,
    ),
  });
  expect(result.xml).toBeUndefined();
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({ code: "qti2_correct_response_not_preserved" }),
  );
});
