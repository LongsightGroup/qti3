import { expect, it } from "vitest";
import { createItemSession, parseQtiXml, validateAssessmentItem } from "@longsightgroup/qti3-core";
import { migrateQtiItemToQti3 } from "./index.js";

function source(
  body: string,
  adaptive = "false",
  namespace = "http://www.imsglobal.org/xsd/imsqti_v2p1",
) {
  return `<assessmentItem xmlns="${namespace}" identifier="audience" title="Audience" adaptive="${adaptive}" timeDependent="false">
    <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
    <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
    <itemBody>${body}</itemBody><responseProcessing template="http://www.imsglobal.org/question/qti_v2p1/rptemplates/match_correct"/>
  </assessmentItem>`;
}
const choice = `<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">Alpha</simpleChoice><simpleChoice identifier="B">Beta</simpleChoice></choiceInteraction>`;

// QTI 2.1 §6.4: rubric view identifies its audience, independently of placement.
it.each(["scorer", "candidate", "candidate scorer"])(
  "preserves rubric audience %s and grades",
  (view) => {
    for (const body of [
      `<rubricBlock view="${view}">Guidance</rubricBlock>${choice}`,
      `${choice}<rubricBlock view="${view}">Guidance</rubricBlock>`,
    ]) {
      const result = migrateQtiItemToQti3({ xml: source(body) });
      expect(result.diagnostics).toEqual([]);
      if (!result.xml) throw new Error("Expected migrated item");
      expect(result.xml).toContain(
        `<qti-rubric-block view="${view}" use="instructions"><qti-content-body>Guidance</qti-content-body></qti-rubric-block>`,
      );
      expect(result.xml).not.toContain("<rubricBlock");
      const parsed = parseQtiXml(result.xml);
      expect(parsed.diagnostics).toEqual([]);
      if (!parsed.document) throw new Error("Expected parsed item");
      expect(validateAssessmentItem(parsed.document).diagnostics).toEqual([]);
      for (const [response, expected] of [
        ["A", 1],
        ["B", 0],
        [null, 0],
      ] as const) {
        const session = createItemSession(parsed.document);
        session.respond("RESPONSE", response);
        expect(session.score().outcomes.SCORE).toBe(expected);
      }
    }
  },
);

// QTI 2.1 §4.1: migration cannot change adaptive sessions into mutable non-adaptive review.
it.each(["true", "1", " true "])("refuses adaptive=%s even under safe repair", (adaptive) => {
  for (const repairPolicy of ["none", "safe"] as const) {
    for (const version of ["1", "2"]) {
      const result = migrateQtiItemToQti3(
        { xml: source(choice, adaptive, `http://www.imsglobal.org/xsd/imsqti_v2p${version}`) },
        { repairPolicy },
      );
      expect(result.xml).toBeUndefined();
      expect(result.authoringItem).toBeUndefined();
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({ code: "qti2_adaptive_not_preserved", severity: "error" }),
      );
    }
  }
});

it("keeps foreign namespace content intact beside a rubric", () => {
  const result = migrateQtiItemToQti3({
    xml: source(
      `<rubricBlock view="candidate"><p>Read <math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math></p></rubricBlock>${choice}`,
    ),
  });
  expect(result.diagnostics).toEqual([]);
  expect(result.xml).toContain('<math xmlns="http://www.w3.org/1998/Math/MathML">');
});

it("translates namespace-prefixed QTI 2 rubrics", () => {
  const xml = source(`<rubricBlock view="scorer"><p>Scorer guidance</p></rubricBlock>${choice}`)
    .replace("xmlns=", "xmlns:q=")
    .replace(/(<\/?)([A-Za-z][A-Za-z0-9]*)(?=[\s/>])/g, "$1q:$2");
  const result = migrateQtiItemToQti3({ xml });
  expect(result.diagnostics).toEqual([]);
  expect(result.xml).toContain(
    '<qti-rubric-block view="scorer" use="instructions"><qti-content-body><p>Scorer guidance</p></qti-content-body></qti-rubric-block>',
  );
  if (!result.xml) throw new Error("Expected migrated item");
  const parsed = parseQtiXml(result.xml);
  expect(parsed.diagnostics).toEqual([]);
  if (!parsed.document) throw new Error("Expected item");
  expect(validateAssessmentItem(parsed.document).diagnostics).toEqual([]);
});
