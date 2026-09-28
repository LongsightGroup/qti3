import { createItemSession } from "@longsightgroup/qti3-core";
import { expect, it } from "vitest";
import { validQtiDocument } from "../../../tests/fixtures/valid-qti-document.js";
import { migrateQtiItemToQti3 } from "./index.js";

// Synthetic MIT fixture. QTI 2.0 §8.1.1 defines match_correct as B => 1,
// any other response (including NULL) => 0 for this authored answer key.
// https://developers.imsglobal.org/question/qti_v2p0/imsqti_infov2p0.html
function source(processing: string): string {
  return `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p0" identifier="choice" title="Choice" adaptive="false" timeDependent="false">
    <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>B</value></correctResponse></responseDeclaration>
    <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
    <itemBody><rubricBlock view="candidate"><p>Choose one answer.</p></rubricBlock>
      <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
        <simpleChoice identifier="A">Alpha</simpleChoice><simpleChoice identifier="B">Beta</simpleChoice>
      </choiceInteraction>
    </itemBody>${processing}</assessmentItem>`;
}

it.each(["0", "1"])("preserves QTI 2.0 choice and v2p%s template grades", (version) => {
  const result = migrateQtiItemToQti3({
    xml: source(
      `<responseProcessing template="http://www.imsglobal.org/question/qti_v2p${version}/rptemplates/match_correct"/>`,
    ),
  });
  expect(result.diagnostics).toEqual([]);
  expect(result.authoringItem).toMatchObject({ interactionType: "choice", correctResponse: ["B"] });
  if (!result.xml) throw new Error("Expected migrated QTI 2.0 item");
  const document = validQtiDocument(result.xml);
  expect(document.item.responseDeclarations).toMatchObject([
    {
      identifier: "RESPONSE",
      cardinality: "single",
      baseType: "identifier",
      correctResponse: "B",
    },
  ]);
  expect(result.xml).toContain('<qti-rubric-block view="candidate" use="instructions">');
  expect(result.xml).toContain('max-choices="1"');
  for (const [answer, expected] of [
    ["B", 1],
    ["A", 0],
    [null, 0],
  ] as const) {
    const session = createItemSession(document);
    session.respond("RESPONSE", answer);
    expect(session.score().outcomes).toMatchObject({ SCORE: expected });
  }
});

it.each(["none", "safe"] as const)(
  "refuses unpreserved QTI 2.0 scoring with %s repair",
  (repairPolicy) => {
    const result = migrateQtiItemToQti3(
      {
        xml: source(
          '<responseProcessing><setOutcomeValue identifier="SCORE"><baseValue baseType="float">7</baseValue></setOutcomeValue></responseProcessing>',
        ),
      },
      { repairPolicy },
    );
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
