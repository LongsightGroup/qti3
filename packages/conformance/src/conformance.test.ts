import { interactionFixtures } from "@qti3/fixtures";
import { describe, expect, it } from "vitest";
import { runFixture } from "./index.js";

describe("@qti3/conformance", () => {
  for (const fixture of interactionFixtures) {
    it(`passes ${fixture.interactionType}`, () => {
      const result = runFixture(fixture);
      expect(result.diagnostics).toEqual([]);
      expect(result.ok).toBe(true);
    });
  }
});
