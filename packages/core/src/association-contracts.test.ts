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
