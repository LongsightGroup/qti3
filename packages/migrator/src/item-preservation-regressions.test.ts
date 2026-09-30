import { createItemSession } from "@longsightgroup/qti3-core";
import { expect, it } from "vitest";
import { validQtiDocument } from "../../../tests/fixtures/valid-qti-document.js";
import { migrateQtiItemToQti3 } from "./index.js";

// Synthetic MIT inputs. QTI 2.1 itemBody is ordered; xml:lang is inherited.
// §§5, 7.2 and 9 define response cardinality, hottext and modal feedback.
// https://www.imsglobal.org/question/qtiv2p1/imsqti_infov2p1.html
const choice =
  '<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1"><simpleChoice identifier="A">Alpha</simpleChoice><simpleChoice identifier="B">Beta</simpleChoice></choiceInteraction>';
function source(body: string, cardinality = "single", feedback = "", lang = "fr") {
  return `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="preservation" title="Preservation" adaptive="false" timeDependent="false" xml:lang="${lang}">
  <responseDeclaration identifier="RESPONSE" cardinality="${cardinality}" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
  <itemBody>${body}</itemBody><responseProcessing template="http://www.imsglobal.org/question/qti_v2p1/rptemplates/match_correct"/>${feedback}</assessmentItem>`;
}

it.each([
  choice,
  '<p>Select <inlineChoiceInteraction responseIdentifier="RESPONSE" shuffle="false"><inlineChoice identifier="A">Alpha</inlineChoice><inlineChoice identifier="B">Beta</inlineChoice></inlineChoiceInteraction>.</p>',
])("preserves inherited item language through block and inline migration (%s)", (body) => {
  const xml =
    body === choice
      ? source(body)
      : source(body).replace(
          '<responseProcessing template="http://www.imsglobal.org/question/qti_v2p1/rptemplates/match_correct"/>',
          '<responseProcessing><setOutcomeValue identifier="SCORE"><baseValue baseType="float">0</baseValue></setOutcomeValue><responseCondition><responseIf><and><not><isNull><variable identifier="RESPONSE"/></isNull></not><match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match></and><setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue></responseIf></responseCondition></responseProcessing>',
        );
  const result = migrateQtiItemToQti3({ xml });
  expect(result.diagnostics).toEqual([]);
  expect(result.authoringItem).toMatchObject({ lang: "fr" });
  if (!result.xml) throw new Error("Expected migrated item");
  validQtiDocument(result.xml);
  expect(result.xml).toContain('xml:lang="fr"');
});

it("preserves nested choice placement, trailing instructions and grades", () => {
  const result = migrateQtiItemToQti3({
    xml: source(`<div><p>Before</p>${choice}<p>After</p></div>`),
  });
  expect(result.diagnostics).toEqual([]);
  if (!result.xml) throw new Error("Expected migrated item");
  const document = validQtiDocument(result.xml);
  expect(result.xml).toMatch(
    /<div><p>Before<\/p>\s*<qti-choice-interaction[\s\S]*<\/qti-choice-interaction>\s*<p>After<\/p><\/div>/,
  );
  expect(result.xml.match(/<p>Before<\/p>/g)).toHaveLength(1);
  expect(result.xml.match(/<p>After<\/p>/g)).toHaveLength(1);
  for (const [answer, expected] of [
    ["A", 1],
    ["B", 0],
    [null, 0],
  ] as const) {
    const session = createItemSession(document);
    session.respond("RESPONSE", answer);
    expect(session.score().outcomes.SCORE).toBe(expected);
  }
});

it.each(["none", "safe"] as const)("refuses lost modal feedback with %s repair", (repairPolicy) => {
  const result = migrateQtiItemToQti3(
    {
      xml: source(
        choice,
        "single",
        '<modalFeedback outcomeIdentifier="completionStatus" identifier="completed" showHide="show"><p>Explanation.</p></modalFeedback>',
      ),
    },
    { repairPolicy },
  );
  expect(result.xml).toBeUndefined();
  expect(result.authoringItem).toBeUndefined();
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({ code: "qti2_modal_feedback_not_preserved", severity: "error" }),
  );
});

it.each(["single", "multiple"] as const)(
  "preserves hottext %s cardinality with a one-choice limit",
  (cardinality) => {
    const hottext =
      '<hottextInteraction responseIdentifier="RESPONSE" maxChoices="1"><p>Select <hottext identifier="A">Alpha</hottext> or <hottext identifier="B">Beta</hottext>.</p></hottextInteraction>';
    const result = migrateQtiItemToQti3({ xml: source(hottext, cardinality) });
    expect(result.diagnostics).toEqual([]);
    if (!result.xml) throw new Error("Expected migrated item");
    const document = validQtiDocument(result.xml);
    expect(document.item.responseDeclarations[0]?.cardinality).toBe(cardinality);
    expect(document.item.responseDeclarations[0]?.correctResponse).toEqual(
      cardinality === "single" ? "A" : ["A"],
    );
    for (const [answer, expected] of [
      ["A", 1],
      ["B", 0],
      [null, 0],
    ] as const) {
      const session = createItemSession(document);
      session.respond("RESPONSE", answer === null || cardinality === "single" ? answer : [answer]);
      expect(session.score().outcomes.SCORE).toBe(expected);
    }
  },
);

it("refuses a source response declaration the writer would omit", () => {
  const xml = source(choice).replace(
    "<outcomeDeclaration",
    '<responseDeclaration identifier="EXTRA" cardinality="single" baseType="integer"/><outcomeDeclaration',
  );
  const result = migrateQtiItemToQti3({ xml });
  expect(result.xml).toBeUndefined();
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({ code: "qti2_response_type_not_preserved", severity: "error" }),
  );
});
