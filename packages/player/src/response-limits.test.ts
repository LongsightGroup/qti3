import type { QtiInteraction } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import { interactionChoices } from "./interaction-support.js";
import {
  maximumAllowedResponses,
  mediaPlayCount,
  minimumMediaPlays,
  parseUnlimitedMaximum,
} from "./response-limits.js";

describe("response-limits", () => {
  it("parses unlimited maximum values", () => {
    expect(parseUnlimitedMaximum("2")).toBe(2);
    expect(parseUnlimitedMaximum("0")).toBeUndefined();
    expect(parseUnlimitedMaximum(undefined)).toBeUndefined();
  });

  it("returns interaction choices without synthetic fallback", () => {
    const interaction = {
      type: "choice",
      choices: [],
    } as unknown as QtiInteraction;
    expect(interactionChoices(interaction)).toEqual([]);
  });

  it("derives media play limits from interaction attributes", () => {
    const interaction = {
      type: "media",
      attributes: { "min-plays": "2", "max-plays": "4" },
    } as unknown as QtiInteraction;
    expect(minimumMediaPlays(interaction)).toBe(2);
    expect(maximumAllowedResponses(interaction)).toBe(4);
    expect(mediaPlayCount(3)).toBe(3);
  });
});
