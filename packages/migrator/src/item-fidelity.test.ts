import { expect, it } from "vitest";
import { createItemSession, parseQtiXml, validateAssessmentItem } from "@longsightgroup/qti3-core";
import { migrateQtiItemToQti3, migrateQtiToQti3Package } from "./index.js";

// QTI 2.1 §5.2, §7.1, §8: declarations do not execute scoring; outcome
// defaults and association constraints cannot be discarded during migration.
const scoreDeclaration =
  '<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>';
const standardProcessing =
  '<responseProcessing template="http://www.imsglobal.org/question/qti_v2p1/rptemplates/match_correct"/>';
function choice(processing = standardProcessing, outcomes = scoreDeclaration, fixed = "true") {
  return `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="fidelity" title="Fidelity" adaptive="false" timeDependent="false">
    <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
    ${outcomes}<itemBody><choiceInteraction responseIdentifier="RESPONSE" shuffle="true" maxChoices="1"><simpleChoice identifier="A" fixed="${fixed}">Alpha</simpleChoice><simpleChoice identifier="B">Beta</simpleChoice><simpleChoice identifier="C">Gamma</simpleChoice></choiceInteraction></itemBody>${processing}</assessmentItem>`;
}
function expectRefusal(xml: string, code: string) {
  const result = migrateQtiItemToQti3({ xml });
  expect(result.xml).toBeUndefined();
  expect(result.authoringItem).toBeUndefined();
  expect(result.diagnostics).toContainEqual(expect.objectContaining({ code, severity: "error" }));
}
it.each(["", "<responseProcessing/>"])(
  "refuses manufactured scoring for absent/empty processing %j",
  (processing) => {
    expectRefusal(
      choice(
        processing,
        '<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>7</value></defaultValue></outcomeDeclaration>',
      ),
      "qti2_response_processing_not_preserved",
    );
  },
);
it.each([
  scoreDeclaration +
    '<outcomeDeclaration identifier="PASS" cardinality="single" baseType="boolean"><defaultValue><value>true</value></defaultValue></outcomeDeclaration>',
  '<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>7</value></defaultValue></outcomeDeclaration>',
  '<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="integer"/>',
  '<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float" normalMaximum="1"/>',
])("refuses unpreserved outcomes %s", (outcomes) => {
  expectRefusal(choice(standardProcessing, outcomes), "qti2_outcomes_not_preserved");
});
it("accepts an explicit numeric zero default equivalent to the implicit default", () => {
  const result = migrateQtiItemToQti3({
    xml: choice(
      standardProcessing,
      '<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>',
    ),
  });
  expect(result.diagnostics).toEqual([]);
  const parsed = parseQtiXml(result.xml ?? "");
  expect(parsed.diagnostics).toEqual([]);
  if (!parsed.document) throw new Error("Expected valid item");
  const session = createItemSession(parsed.document);
  expect(session.score().outcomes.SCORE).toBe(0);
  session.respond("RESPONSE", "A");
  expect(session.score().outcomes.SCORE).toBe(1);
});
it.each(["true", "1", "false", "0"])(
  "preserves XML Boolean fixed=%s through candidate presentation",
  (fixed) => {
    const result = migrateQtiItemToQti3({
      xml: choice(standardProcessing, scoreDeclaration, fixed),
    });
    expect(result.diagnostics).toEqual([]);
    const parsed = parseQtiXml(result.xml ?? "");
    expect(parsed.diagnostics).toEqual([]);
    if (!parsed.document) throw new Error("Expected valid item");
    expect(validateAssessmentItem(parsed.document).diagnostics).toEqual([]);
    const positions = new Set<number>();
    for (let seed = 0; seed < 20; seed++) {
      const presentation = createItemSession(parsed.document, undefined, {
        presentationSeed: seed,
      }).presentation();
      if (!presentation.ok) throw new Error("Expected presentation");
      positions.add(
        presentation.interactions[0]!.choices.findIndex((entry) => entry.identifier === "A"),
      );
    }
    if (fixed === "true" || fixed === "1") expect([...positions]).toEqual([0]);
    else expect(positions.size).toBeGreaterThan(1);
  },
);
it.each(["simpleAssociableChoice", "gapText", "gapImg"])(
  "refuses unpreserved %s matchMin",
  (kind) => {
    const content = kind === "gapImg" ? '<object data="label.png" type="image/png"/>' : "Alpha";
    const option = `<${kind} identifier="A" matchMin="1" matchMax="1">${content}</${kind}>`;
    const interaction =
      kind === "simpleAssociableChoice"
        ? `<matchInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="1"><simpleMatchSet>${option}</simpleMatchSet><simpleMatchSet><simpleAssociableChoice identifier="B" matchMax="1">Beta</simpleAssociableChoice></simpleMatchSet></matchInteraction>`
        : `<gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false">${option}<p><gap identifier="B"/></p></gapMatchInteraction>`;
    const mapping =
      kind === "simpleAssociableChoice"
        ? ""
        : '<mapping defaultValue="0"><mapEntry mapKey="A B" mappedValue="1"/></mapping>';
    const processing =
      kind === "simpleAssociableChoice"
        ? standardProcessing
        : standardProcessing.replace("match_correct", "map_response");
    expectRefusal(
      `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="minimum" title="Minimum" adaptive="false" timeDependent="false"><responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair"><correctResponse><value>A B</value></correctResponse>${mapping}</responseDeclaration>${scoreDeclaration}<itemBody>${interaction}</itemBody>${processing}</assessmentItem>`,
      "qti2_match_min_not_preserved",
    );
  },
);
it("blocks package conversion for outcome loss", async () => {
  const result = await migrateQtiToQti3Package({
    xml: choice(
      standardProcessing,
      scoreDeclaration +
        '<outcomeDeclaration identifier="PASS" cardinality="single" baseType="boolean"/>',
    ),
  });
  expect(result.ok).toBe(false);
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({ code: "qti2_outcomes_not_preserved" }),
  );
});

it("refuses a graphic association hotspot's required minimum", () => {
  expectRefusal(
    `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="graphic-minimum" title="Graphic minimum" adaptive="false" timeDependent="false">
    <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="pair"><correctResponse><value>A B</value></correctResponse></responseDeclaration>${scoreDeclaration}
    <itemBody><graphicAssociateInteraction responseIdentifier="RESPONSE" maxAssociations="1"><object data="image.png" type="image/png" width="100" height="100"/><associableHotspot identifier="A" shape="rect" coords="0,0,20,20" matchMin="1" matchMax="1"/><associableHotspot identifier="B" shape="rect" coords="30,30,50,50" matchMax="1"/></graphicAssociateInteraction></itemBody>${standardProcessing}</assessmentItem>`,
    "qti2_match_min_not_preserved",
  );
});
it("preserves fixed=1 on associable choices", () => {
  const xml = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="fixed-associate" title="Fixed association" adaptive="false" timeDependent="false">
    <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="pair"><correctResponse><value>A B</value></correctResponse></responseDeclaration>${scoreDeclaration}
    <itemBody><associateInteraction responseIdentifier="RESPONSE" shuffle="true" maxAssociations="1"><simpleAssociableChoice identifier="A" fixed="1" matchMax="1">Alpha</simpleAssociableChoice><simpleAssociableChoice identifier="B" matchMax="1">Beta</simpleAssociableChoice></associateInteraction></itemBody>${standardProcessing}</assessmentItem>`;
  const result = migrateQtiItemToQti3({ xml });
  expect(result.diagnostics).toEqual([]);
  const parsed = parseQtiXml(result.xml ?? "");
  expect(parsed.diagnostics).toEqual([]);
  if (!parsed.document) throw new Error("Expected item");
  expect(validateAssessmentItem(parsed.document).diagnostics).toEqual([]);
  expect(parsed.document.item.interactions[0]?.choices[0]?.attributes.fixed).toBe("true");
});
