import { describe, expect, it } from "vitest";
import { createItemSession, parseQtiXml, validateQtiResponseVariables } from "./index.js";

/** Synthetic MIT-licensed item; no correct response is needed to enforce placement limits. */
function graphicGapDocument(maximum = 3) {
  const parsed =
    parseQtiXml(`<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="restored-graphic-gap" title="Restored placements" time-dependent="false">
    <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
    <qti-item-body><qti-graphic-gap-match-interaction response-identifier="RESPONSE" min-associations="2" max-associations="${maximum}">
      <object data="targets.svg" type="image/svg+xml" width="400" height="160">Two target areas.</object>
      <qti-gap-text identifier="A" match-min="2" match-max="2">Alpha</qti-gap-text>
      <qti-gap-text identifier="B" match-max="1">Beta</qti-gap-text>
      <qti-gap-text identifier="C" match-max="0">Gamma</qti-gap-text>
      <qti-associable-hotspot identifier="G1" shape="rect" coords="25,25,125,100" match-max="2"/>
      <qti-associable-hotspot identifier="G2" shape="rect" coords="225,25,325,100" match-max="0"/>
    </qti-graphic-gap-match-interaction></qti-item-body>
  </qti-assessment-item>`);
  expect(parsed.ok).toBe(true);
  if (!parsed.document) throw new Error("Expected graphic gap item");
  return parsed.document;
}

describe("graphic gap attempt state", () => {
  it.each([
    { name: "source match-max", pairs: ["A G1", "A G1", "A G2"], maximum: 3 },
    { name: "single-use source", pairs: ["B G1", "B G2"], maximum: 3 },
    { name: "target match-max", pairs: ["A G1", "A G1", "B G1"], maximum: 3 },
    { name: "max-associations", pairs: ["A G1", "B G1", "A G2"], maximum: 2 },
    { name: "unknown source", pairs: ["UNKNOWN G1"], maximum: 3 },
    { name: "unknown target", pairs: ["A UNKNOWN"], maximum: 3 },
    { name: "reversed pair", pairs: ["G1 A"], maximum: 3 },
    { name: "source limit with unlimited total", pairs: ["A G2", "A G2", "A G2"], maximum: 0 },
  ])("rejects restored $name without changing the live session", ({ pairs, maximum }) => {
    const document = graphicGapDocument(maximum);
    const session = createItemSession(document);
    session.respond("RESPONSE", ["A G1"]);
    const state = session.serialize();

    expect(() => createItemSession(document, { ...state, responses: { RESPONSE: pairs } })).toThrow(
      /Cannot restore response RESPONSE/,
    );
    expect(session.serialize()).toEqual(state);
  });

  it.each([null, [], ["A G1"], ["A G1", "A G1"], ["A G1", "B G1", "A G2"]])(
    "preserves valid and incomplete placements exactly: %j",
    (value) => {
      const document = graphicGapDocument();
      const session = createItemSession(document);
      session.respond("RESPONSE", value);
      session.setStatus("suspended");
      const state = session.serialize();

      expect(createItemSession(document, state).serialize()).toEqual(state);
    },
  );

  it("enforces match-max without scoring or an authored minimum/total maximum", () => {
    const document = graphicGapDocument(0);
    const interaction = document.item.interactions[0];
    if (!interaction) throw new Error("Expected graphic gap interaction");
    delete interaction.attributes["min-associations"];
    const result = validateQtiResponseVariables({
      item: document.item,
      responses: { RESPONSE: ["A G2", "A G2", "A G2"] },
      allowIncompleteResponses: true,
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "response.matchMax" }),
    );
  });
});
