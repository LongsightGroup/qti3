import type { QtiInteraction } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import { usesChoiceSet, usesOrderedResponse, usesPairResponse } from "./routing.js";

function interaction(overrides: Partial<QtiInteraction> & Pick<QtiInteraction, "type">): QtiInteraction {
  return {
    qtiName: "qti-interaction",
    type: overrides.type,
    responseIdentifier: "RESPONSE",
    responseCardinality: "single",
    responseBaseType: "identifier",
    choices: [],
    attributes: {},
    source: { start: 0, end: 0 },
    ...overrides,
  } as QtiInteraction;
}

describe("interaction routing", () => {
  it("usesChoiceSet matches choice and multi identifier interactions only", () => {
    expect(usesChoiceSet(interaction({ type: "choice" }))).toBe(true);
    expect(
      usesChoiceSet(
        interaction({ type: "custom", responseCardinality: "multiple", responseBaseType: "identifier" }),
      ),
    ).toBe(true);
    expect(usesChoiceSet(interaction({ type: "hotspot" }))).toBe(false);
    expect(usesChoiceSet(interaction({ type: "order" }))).toBe(false);
  });

  it("usesOrderedResponse matches ordered cardinality and order type only", () => {
    expect(usesOrderedResponse(interaction({ type: "order" }))).toBe(true);
    expect(usesOrderedResponse(interaction({ type: "custom", responseCardinality: "ordered" }))).toBe(
      true,
    );
    expect(usesOrderedResponse(interaction({ type: "graphicOrder" }))).toBe(false);
  });

  it("usesPairResponse matches pair base types and associate only", () => {
    expect(usesPairResponse(interaction({ type: "associate" }))).toBe(true);
    expect(
      usesPairResponse(interaction({ type: "custom", responseBaseType: "directedPair" })),
    ).toBe(true);
    expect(usesPairResponse(interaction({ type: "match" }))).toBe(false);
    expect(usesPairResponse(interaction({ type: "graphicAssociate" }))).toBe(false);
  });
});
