import { describe, expect, it } from "vitest";
import { interactionFixtures } from "./index.js";

describe("@qti3/fixtures", () => {
  it("has one reference fixture for every target interaction", () => {
    expect(interactionFixtures).toHaveLength(21);
    expect(new Set(interactionFixtures.map((fixture) => fixture.interactionType)).size).toBe(21);
  });
});
