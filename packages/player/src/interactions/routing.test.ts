import { describe, expect, it } from "vitest";
import { testInteraction } from "../interaction-test-fixtures.js";
import { usesChoiceSet, usesOrderedResponse, usesPairResponse } from "./routing.js";

describe("interaction routing", () => {
  it("usesChoiceSet matches choice and multi identifier interactions only", () => {
    expect(usesChoiceSet(testInteraction({ type: "choice" }))).toBe(true);
    expect(
      usesChoiceSet(
        testInteraction({
          type: "custom",
          responseCardinality: "multiple",
          responseBaseType: "identifier",
        }),
      ),
    ).toBe(true);
    expect(usesChoiceSet(testInteraction({ type: "hotspot" }))).toBe(false);
    expect(usesChoiceSet(testInteraction({ type: "order" }))).toBe(false);
  });

  it("usesOrderedResponse matches ordered cardinality and order type only", () => {
    expect(usesOrderedResponse(testInteraction({ type: "order" }))).toBe(true);
    expect(
      usesOrderedResponse(testInteraction({ type: "custom", responseCardinality: "ordered" })),
    ).toBe(true);
    expect(usesOrderedResponse(testInteraction({ type: "graphicOrder" }))).toBe(false);
  });

  it("usesPairResponse matches pair base types and associate only", () => {
    expect(usesPairResponse(testInteraction({ type: "associate" }))).toBe(true);
    expect(
      usesPairResponse(testInteraction({ type: "custom", responseBaseType: "directedPair" })),
    ).toBe(true);
    expect(usesPairResponse(testInteraction({ type: "match" }))).toBe(false);
    expect(
      usesPairResponse(testInteraction({ type: "match", responseBaseType: "directedPair" })),
    ).toBe(false);
    expect(usesPairResponse(testInteraction({ type: "graphicAssociate" }))).toBe(false);
    expect(usesPairResponse(testInteraction({ type: "gapMatch" }))).toBe(false);
  });
});
