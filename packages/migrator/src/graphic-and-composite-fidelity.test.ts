import { createItemSession } from "@longsightgroup/qti3-core";
import { expect, it } from "vitest";
import { validQtiDocument } from "../../../tests/fixtures/valid-qti-document.js";
import { migrateQtiItemToQti3 } from "./index.js";

// Synthetic MIT sources. QTI 1.2 conditionvar/and and setvar require both answers.
// https://www.imsglobal.org/node/52326
const twoBlanks = `<item ident="two" title="Two blanks"><presentation><material><mattext>Fill both blanks.</mattext></material>
<response_str ident="R" rcardinality="Single"><render_fib fibtype="String" rows="1"><response_label ident="R_LABEL"/></render_fib></response_str>
<response_str ident="S" rcardinality="Single"><render_fib fibtype="String" rows="1"><response_label ident="S_LABEL"/></render_fib></response_str>
</presentation><resprocessing><outcomes><decvar varname="SCORE" vartype="Decimal" defaultval="0"/></outcomes><respcondition continue="No"><conditionvar><and><varequal respident="R">alpha</varequal><varequal respident="S">beta</varequal></and></conditionvar><setvar varname="SCORE" action="Set">1</setvar></respcondition></resprocessing></item>`;

it.each(["none", "safe"] as const)(
  "rejects a two-answer conjunction instead of grading only the first (%s)",
  (repairPolicy) => {
    // Independent truth table: alpha/beta => 1; alpha/NULL, alpha/wrong, NULL/NULL => 0.
    // Refusal must prevent the former one-field artifact that awarded alpha/NULL one point.
    const result = migrateQtiItemToQti3({ xml: twoBlanks }, { repairPolicy });
    expect(result.xml).toBeUndefined();
    expect(result.authoringItem).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "qti12_composite_responses_unsupported", severity: "error" }),
    );
  },
);

function item(body: string, baseType = "identifier", cardinality = "single", answer = "A") {
  return `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p0" identifier="graphic" title="Graphic" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="${cardinality}" baseType="${baseType}"><correctResponse><value>${answer}</value></correctResponse></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
  <itemBody>${body}</itemBody><responseProcessing template="http://www.imsglobal.org/question/qti_v2p0/rptemplates/match_correct"/></assessmentItem>`;
}
// QTI 2 graphical interactions retain ordered item content and alternative descriptions.
// https://developers.imsglobal.org/question/qti_v2p0/imsqti_infov2p0.html
it("preserves hotspot instructions, region labels, object description and grades", () => {
  const result = migrateQtiItemToQti3({
    xml: item(
      `<div><p>Before.</p><hotspotInteraction responseIdentifier="RESPONSE" maxChoices="1"><prompt>Pick one.</prompt><object data="map.png" type="image/png" width="100" height="100">Map of regions.</object><hotspotChoice identifier="A" shape="rect" coords="0,0,40,40" hotspotLabel="North &amp; west"/><hotspotChoice identifier="B" shape="rect" coords="50,50,90,90" hotspotLabel="South"/></hotspotInteraction><p>After.</p></div>`,
    ),
  });
  expect(result.diagnostics).toEqual([]);
  if (!result.xml) throw new Error("Expected migrated hotspot");
  const document = validQtiDocument(result.xml);
  expect(result.xml).toMatch(
    /<div><p>Before\.<\/p>\s*<qti-hotspot-interaction[\s\S]*<\/qti-hotspot-interaction>\s*<p>After\.<\/p><\/div>/,
  );
  expect(result.xml).toContain('hotspot-label="North &amp; west"');
  expect(result.xml).toContain('hotspot-label="South"');
  expect(result.xml).toContain('alt="Map of regions."');
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

const associate = (group: string) =>
  `<associateInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="1"><simpleAssociableChoice identifier="A" matchMax="1" matchGroup="${group}">Alpha</simpleAssociableChoice><simpleAssociableChoice identifier="B" matchMax="1">Beta</simpleAssociableChoice><simpleAssociableChoice identifier="C" matchMax="1">Gamma</simpleAssociableChoice></associateInteraction>`;
// QTI 2.0 associableChoice.matchGroup excludes all choices outside the named set.
it.each(["none", "safe"] as const)("rejects lost matchGroup exclusions (%s)", (repairPolicy) => {
  const result = migrateQtiItemToQti3(
    { xml: item(associate("B"), "pair", "multiple", "A B") },
    { repairPolicy },
  );
  expect(result.xml).toBeUndefined();
  expect(result.authoringItem).toBeUndefined();
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({ code: "qti2_match_group_not_preserved", severity: "error" }),
  );
});

it("retains unrestricted associations when matchGroup is empty", () => {
  const result = migrateQtiItemToQti3({ xml: item(associate(""), "pair", "multiple", "A B") });
  expect(result.diagnostics).toEqual([]);
  if (!result.xml) throw new Error("Expected unrestricted association item");
  const document = validQtiDocument(result.xml);
  for (const [answer, expected] of [
    [["A B"], 1],
    [["A C"], 0],
    [null, 0],
  ] as const) {
    const session = createItemSession(document);
    session.respond("RESPONSE", answer === null ? null : [...answer]);
    expect(session.score().outcomes.SCORE).toBe(expected);
  }
});

it.each(["associate", "gap"] as const)(
  "preserves %s region labels and object fallback alongside its label",
  (kind) => {
    const object =
      '<object data="map.png" type="image/png" width="100" height="100" label="Map">Detailed regions.</object>';
    const target =
      '<associableHotspot identifier="T" shape="rect" coords="0,0,40,40" matchMax="1" hotspotLabel="North"/>';
    const body =
      kind === "associate"
        ? `<graphicAssociateInteraction responseIdentifier="RESPONSE" maxAssociations="1">${object}${target}<associableHotspot identifier="U" shape="rect" coords="50,50,90,90" matchMax="1" hotspotLabel="South"/></graphicAssociateInteraction>`
        : `<graphicGapMatchInteraction responseIdentifier="RESPONSE">${object}<gapImg identifier="G" matchMax="1"><object data="label.png" type="image/png" label="Label"/></gapImg>${target}</graphicGapMatchInteraction>`;
    const correct = kind === "associate" ? "T U" : "G T";
    const result = migrateQtiItemToQti3({
      xml: item(body, kind === "associate" ? "pair" : "directedPair", "multiple", correct),
    });
    expect(result.diagnostics).toEqual([]);
    if (!result.xml) throw new Error("Expected migrated graphic interaction");
    const document = validQtiDocument(result.xml);
    expect(result.xml).toContain('hotspot-label="North"');
    expect(result.xml).toContain('alt="Map"');
    expect(result.xml).toContain('data-qti-aria-describedby="longdesc-graphic"');
    expect(result.xml).toContain('id="longdesc-graphic"');
    expect(result.xml).toContain("Detailed regions.");
    const correctSession = createItemSession(document);
    correctSession.respond("RESPONSE", [correct]);
    expect(correctSession.score().outcomes.SCORE).toBe(1);
    expect(createItemSession(document).score().outcomes.SCORE).toBe(0);
  },
);
