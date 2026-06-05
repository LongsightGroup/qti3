import type { QtiInteraction } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import { interactionChoices } from "./interaction-support.js";
import {
  maximumAllowedResponses,
  mediaPlayCount,
  minimumMediaPlays,
  parseUnlimitedMaximum,
  responseLimitAttribute,
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

  it.each(["order", "graphicOrder"] as const)(
    "uses choice limits, not association limits, for %s interactions",
    (type) => {
      const interaction = {
        type,
        attributes: {
          "min-associations": "3",
          "min-choices": "2",
          "max-associations": "1",
          "max-choices": "2",
        },
      } as unknown as QtiInteraction;

      expect(responseLimitAttribute(interaction, "min-choices", "min-associations")).toBe("2");
      expect(responseLimitAttribute(interaction, "max-choices", "max-associations")).toBe("2");
      expect(
        maximumAllowedResponses({
          type,
          attributes: { "max-associations": "1", "max-choices": "2" },
        } as unknown as QtiInteraction),
      ).toBe(2);
      expect(
        maximumAllowedResponses({
          type,
          attributes: { "max-associations": "1" },
        } as unknown as QtiInteraction),
      ).toBeUndefined();
    },
  );

  it("falls back to association limits for association interactions", () => {
    const interaction = {
      type: "associate",
      attributes: { "min-associations": "1", "max-associations": "2" },
    } as unknown as QtiInteraction;

    expect(responseLimitAttribute(interaction, "min-choices", "min-associations")).toBe("1");
    expect(responseLimitAttribute(interaction, "max-choices", "max-associations")).toBe("2");
    expect(maximumAllowedResponses(interaction)).toBe(2);
  });
});
