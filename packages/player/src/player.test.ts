import { interactionFixtures } from "@qti3/fixtures";
import { describe, expect, it } from "vitest";
import { defineQtiAssessmentItemPlayer } from "./index.js";

describe("@qti3/player", () => {
  it("exports a custom element definition function", () => {
    expect(typeof defineQtiAssessmentItemPlayer).toBe("function");
    expect(interactionFixtures.length).toBeGreaterThan(0);
  });
});
