import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createItemSession, parseQtiXml, validateQtiResponseVariables } from "./index.js";

it.each(["associate", "graphicAssociate", "match", "gapMatch"])(
  "accepts single %s responses and scores them",
  (type) => {
    const xml = readFileSync(
      new URL(`../../fixtures/xml/${type}-reference.xml`, import.meta.url),
      "utf8",
    )
      .replace('cardinality="multiple"', 'cardinality="single"')
      .replace(
        /(<qti-correct-response>\s*<qti-value>[^<]*<\/qti-value>)[\s\S]*?<\/qti-correct-response>/,
        "$1</qti-correct-response>",
      );
    const parsed = parseQtiXml(xml);
    expect(parsed.diagnostics.filter((entry) => entry.severity === "error")).toEqual([]);
    if (!parsed.document) throw new Error("Missing item");
    const declaration = parsed.document.item.responseDeclarations[0];
    if (!declaration) throw new Error("Missing declaration");
    const response = declaration.correctResponse;
    expect(typeof response).toBe("string");
    expect(
      validateQtiResponseVariables({
        item: parsed.document.item,
        responses: { RESPONSE: response },
      }).ok,
    ).toBe(true);
    const session = createItemSession(parsed.document);
    session.respond("RESPONSE", response);
    expect(session.score().outcomes.SCORE).toBe(1);
  },
);

it("keeps graphic gap match restricted to multiple directed pairs", () => {
  const xml = readFileSync(
    new URL("../../fixtures/xml/graphicGapMatch-reference.xml", import.meta.url),
    "utf8",
  );
  expect(
    parseQtiXml(
      xml
        .replace('cardinality="multiple"', 'cardinality="single"')
        .replace(
          /(<qti-correct-response>\s*<qti-value>[^<]*<\/qti-value>)[\s\S]*?<\/qti-correct-response>/,
          "$1</qti-correct-response>",
        ),
    ).diagnostics,
  ).toContainEqual(expect.objectContaining({ code: "interaction.cardinality" }));
});

it.each(["associate", "graphicAssociate"])("rejects directedPair declarations for %s", (type) => {
  const xml = readFileSync(
    new URL(`../../fixtures/xml/${type}-reference.xml`, import.meta.url),
    "utf8",
  );
  expect(parseQtiXml(xml).diagnostics.filter((entry) => entry.severity === "error")).toEqual([]);
  expect(
    parseQtiXml(xml.replace('base-type="pair"', 'base-type="directedPair"')).diagnostics,
  ).toContainEqual(expect.objectContaining({ code: "interaction.baseType", severity: "error" }));
});

it.each(["associate", "graphicAssociate", "match", "gapMatch", "graphicGapMatch"])(
  "enforces final match-min including unused %s choices",
  (type) => {
    let xml = readFileSync(
      new URL(`../../fixtures/xml/${type}-reference.xml`, import.meta.url),
      "utf8",
    );
    if (type === "associate")
      xml = xml.replaceAll("<qti-simple-match-set>", "").replaceAll("</qti-simple-match-set>", "");
    xml = xml.replace('identifier="A"', 'identifier="A" match-min="1"');
    const parsed = parseQtiXml(xml);
    expect(parsed.diagnostics.filter((entry) => entry.severity === "error")).toEqual([]);
    if (!parsed.document) throw new Error("Missing item");
    const item = parsed.document.item;
    const responses = {
      RESPONSE: type === "associate" || type === "graphicAssociate" ? ["C D"] : ["B G2"],
    };
    expect(validateQtiResponseVariables({ item, responses }).diagnostics).toContainEqual(
      expect.objectContaining({ code: "response.matchMin", identifier: "RESPONSE" }),
    );
    expect(validateQtiResponseVariables({ item, responses: {} }).diagnostics).toContainEqual(
      expect.objectContaining({ code: "response.matchMin" }),
    );
    expect(
      validateQtiResponseVariables({ item, responses, allowIncompleteResponses: true }).ok,
    ).toBe(true);
  },
);

it("counts directed target uses and repeated allowed occurrences", () => {
  const xml = readFileSync(
    new URL("../../fixtures/xml/match-reference.xml", import.meta.url),
    "utf8",
  )
    .replaceAll('match-max="1"', 'match-max="0"')
    .replace('identifier="G1"', 'identifier="G1" match-min="2"');
  const item = parseQtiXml(xml).document?.item;
  if (!item) throw new Error("Missing item");
  expect(
    validateQtiResponseVariables({ item, responses: { RESPONSE: ["A G1"] } }).diagnostics,
  ).toContainEqual(expect.objectContaining({ code: "response.matchMin" }));
  expect(validateQtiResponseVariables({ item, responses: { RESPONSE: ["A G1", "A G1"] } }).ok).toBe(
    true,
  );
});

it("rejects Match-only wrappers inside Associate", () => {
  const xml = readFileSync(
    new URL("../../fixtures/xml/associate-reference.xml", import.meta.url),
    "utf8",
  );
  const wrapped = xml
    .replace(
      '<qti-simple-associable-choice identifier="A"',
      '<qti-simple-match-set><qti-simple-associable-choice identifier="A"',
    )
    .replace("</qti-associate-interaction>", "</qti-simple-match-set></qti-associate-interaction>");
  expect(parseQtiXml(wrapped).diagnostics).toContainEqual(
    expect.objectContaining({ code: "interaction.child.unsupported", severity: "error" }),
  );
});
