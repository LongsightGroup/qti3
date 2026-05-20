import { describe, expect, it } from "vitest";
import {
  adaptiveFixtures,
  canonicalFixtures,
  interactionFixtures,
  processingFixtures,
} from "./index.js";

describe("@qti3/fixtures", () => {
  it("has one reference fixture for every target interaction", () => {
    expect(interactionFixtures).toHaveLength(21);
    expect(new Set(interactionFixtures.map((fixture) => fixture.interactionType)).size).toBe(21);
    expect(interactionFixtures.some((fixture) => fixture.interactionType === "custom")).toBe(false);
  });

  it("includes canonical processing and adaptive reference fixtures", () => {
    expect(processingFixtures.map((fixture) => fixture.id)).toEqual([
      "mapping-processing-reference",
      "generic-match-processing-reference",
      "template-processing-reference",
      "template-content-reference",
      "advanced-processing-reference",
    ]);
    expect(adaptiveFixtures.map((fixture) => fixture.id)).toEqual(["adaptive-feedback-reference"]);
    expect(canonicalFixtures).toHaveLength(
      interactionFixtures.length + processingFixtures.length + adaptiveFixtures.length,
    );
  });
});
