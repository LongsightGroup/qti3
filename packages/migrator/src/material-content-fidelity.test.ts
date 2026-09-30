import { compileQtiPatternMask, createItemSession } from "@longsightgroup/qti3-core";
import { expect, it } from "vitest";
import { validQtiDocument } from "../../../tests/fixtures/valid-qti-document.js";
import { migrateQtiItemToQti3 } from "./index.js";

// Synthetic MIT sources. QTI 2 stringInteraction.patternMask constrains valid input.
// https://www.imsglobal.org/question/qtiv2p1/imsqti_infov2p1.html
it("preserves an extended-text pattern instead of allowing arbitrary text", () => {
  const result = migrateQtiItemToQti3({
    xml: `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="masked" title="Masked" adaptive="false" timeDependent="false"><responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/><outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/><itemBody><extendedTextInteraction responseIdentifier="RESPONSE" patternMask="[A-Z]{3}" expectedLines="2"/></itemBody></assessmentItem>`,
  });
  expect(result.diagnostics).toEqual([]);
  if (!result.xml) throw new Error("Expected migrated item");
  const document = validQtiDocument(result.xml);
  const pattern = document.item.interactions[0]?.attributes["pattern-mask"];
  expect(pattern).toBe("[A-Z]{3}");
  const mask = compileQtiPatternMask(pattern);
  expect(mask?.test("ABC")).toBe(true);
  expect(mask?.test("abc")).toBe(false);
  expect(mask?.test("ABCD")).toBe(false);
});

function source(material: string) {
  return `<item ident="material" title="Material"><presentation>${material}<response_lid ident="R" rcardinality="Single"><render_choice><response_label ident="A"><material><mattext>Alpha</mattext></material></response_label><response_label ident="B"><material><mattext>Beta</mattext></material></response_label></render_choice></response_lid></presentation><resprocessing><outcomes><decvar varname="SCORE" vartype="Decimal" defaultval="0"/></outcomes><respcondition continue="No"><conditionvar><varequal respident="R">A</varequal></conditionvar><setvar varname="SCORE" action="Set">1</setvar></respcondition></resprocessing></item>`;
}
// QTI 1.2 material contains ordered content components; HTML mattext is encoded text.
// https://www.imsglobal.org/node/52326
// https://www.imsglobal.org/node/51841
it.each([
  [
    "HTML",
    '<material><mattext texttype="text/html"><![CDATA[<p><em>Important</em><img src="diagram.png" alt="Diagram"/></p>]]></mattext></material>',
    /<em>Important<\/em><img src="diagram.png" alt="Diagram"\s*\/>/,
  ],
  [
    "mixed",
    '<material><mattext>Use the diagram.</mattext><matimage uri="diagram.png" imagtype="image/png" label="Diagram"/><mattext>Then answer.</mattext></material>',
    /Use the diagram\.[\s\S]*<img[^>]*src="diagram.png"[^>]*>[\s\S]*Then answer\./,
  ],
  [
    "plain",
    '<material><mattext texttype="text/plain"><![CDATA[<em>literal</em>]]></mattext></material>',
    /&lt;em&gt;literal&lt;\/em&gt;/,
  ],
] as const)("preserves %s material semantics and grades", (_kind, material, expected) => {
  const result = migrateQtiItemToQti3({ xml: source(material) });
  expect(result.diagnostics).toEqual([]);
  if (!result.xml) throw new Error("Expected migrated material");
  const document = validQtiDocument(result.xml);
  expect(result.xml).toMatch(expected);
  expect(result.xml).not.toContain("<![CDATA[");
  for (const [answer, score] of [
    ["A", 1],
    ["B", 0],
    [null, 0],
  ] as const) {
    const session = createItemSession(document);
    session.respond("RESPONSE", answer);
    expect(session.score().outcomes.SCORE).toBe(score);
  }
});

it.each(["none", "safe"] as const)(
  "rejects malformed HTML and unsupported material instead of losing content (%s)",
  (repairPolicy) => {
    for (const material of [
      '<material><mattext texttype="text/html"><![CDATA[<em>unclosed]]></mattext></material>',
      '<material><mattext texttype="application/unknown">Opaque</mattext></material>',
      '<material><matref linkrefid="external"/></material>',
    ]) {
      const result = migrateQtiItemToQti3({ xml: source(material) }, { repairPolicy });
      expect(result.xml).toBeUndefined();
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({ code: "qti12_material_not_preserved", severity: "error" }),
      );
    }
  },
);
