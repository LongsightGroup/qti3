import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { createItemSession, parseQtiXml, validateQtiResponseVariables } from "./index.js";

it.each([
  ["A G1", "B G1"],
  ["A G1", "A G1"],
])("rejects ordinary gap reuse: %j", (...pairs) => {
  const xml = readFileSync(
    new URL("../../fixtures/xml/shuffle/gapMatch.xml", import.meta.url),
    "utf8",
  ).replaceAll('match-max="1"', 'match-max="0"');
  const parsed = parseQtiXml(xml);
  expect(parsed.diagnostics).toEqual([]);
  if (!parsed.document) throw new Error("Expected document");
  const document = parsed.document;
  const result = validateQtiResponseVariables({
    item: parsed.document.item,
    responses: { RESPONSE: pairs },
  });
  expect(result.ok).toBe(false);
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({ code: "response.matchMax", identifier: "RESPONSE" }),
  );
  const state = createItemSession(parsed.document, undefined, { presentationSeed: 1 }).serialize();
  state.responses.RESPONSE = pairs;
  expect(() => createItemSession(document, state)).toThrow(/at most 1/);
});

it("retains multiple placements in a graphic gap with an unlimited target", () => {
  const xml = readFileSync(
    new URL("../../fixtures/xml/graphicGapMatch-reference.xml", import.meta.url),
    "utf8",
  ).replaceAll('match-max="1"', 'match-max="0"');
  const parsed = parseQtiXml(xml);
  expect(parsed.diagnostics).toEqual([]);
  if (!parsed.document) throw new Error("Expected document");
  const responses = { RESPONSE: ["A G1", "B G1"] };
  expect(validateQtiResponseVariables({ item: parsed.document.item, responses }).ok).toBe(true);
  const state = createItemSession(parsed.document).serialize();
  state.responses = responses;
  expect(createItemSession(parsed.document, state).serialize().responses).toEqual(responses);
});
