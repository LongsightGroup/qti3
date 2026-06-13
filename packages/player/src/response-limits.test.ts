import { describe, expect, it } from "vitest";
import { testInteraction } from "./interaction-test-fixtures.js";
import { interactionChoices } from "./interaction-support.js";
import {
  associationMaximumResponses,
  maximumAllowedResponses,
  mediaPlayCount,
  minimumMediaPlays,
  orderSubsetLimitsActive,
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
    expect(interactionChoices(testInteraction({ type: "choice", choices: [] }))).toEqual([]);
  });

  it("derives media play limits from interaction attributes", () => {
    const interaction = testInteraction({
      type: "media",
      attributes: { "min-plays": "2", "max-plays": "4" },
    });
    expect(minimumMediaPlays(interaction)).toBe(2);
    expect(maximumAllowedResponses(interaction)).toBe(4);
    expect(mediaPlayCount(3)).toBe(3);
  });

  it.each(["order", "graphicOrder"] as const)(
    "uses choice limits, not association limits, for %s interactions",
    (type) => {
      const interaction = testInteraction({
        type,
        attributes: {
          "min-associations": "3",
          "min-choices": "2",
          "max-associations": "1",
          "max-choices": "2",
        },
      });

      expect(responseLimitAttribute(interaction, "min-choices", "min-associations")).toBe("2");
      expect(responseLimitAttribute(interaction, "max-choices", "max-associations")).toBe("2");
      expect(
        maximumAllowedResponses(
          testInteraction({
            type,
            attributes: { "min-choices": "1", "max-associations": "1", "max-choices": "2" },
          }),
        ),
      ).toBe(2);
      expect(
        maximumAllowedResponses(
          testInteraction({
            type,
            attributes: { "max-associations": "1", "max-choices": "2" },
          }),
        ),
      ).toBeUndefined();
      expect(
        maximumAllowedResponses(
          testInteraction({
            type,
            attributes: { "max-associations": "1" },
          }),
        ),
      ).toBeUndefined();
      expect(
        orderSubsetLimitsActive(
          testInteraction({
            type,
            attributes: { "min-choices": "2" },
          }),
        ),
      ).toBe(true);
      expect(
        orderSubsetLimitsActive(
          testInteraction({
            type,
            attributes: { "max-choices": "2" },
          }),
        ),
      ).toBe(false);
    },
  );

  it("falls back to association limits for association interactions", () => {
    const interaction = testInteraction({
      type: "associate",
      attributes: { "min-associations": "1", "max-associations": "2" },
    });

    expect(responseLimitAttribute(interaction, "min-choices", "min-associations")).toBe("1");
    expect(responseLimitAttribute(interaction, "max-choices", "max-associations")).toBe("2");
    expect(maximumAllowedResponses(interaction)).toBe(2);
  });

  it("defaults graphic gap match maximum associations to one when omitted", () => {
    expect(
      maximumAllowedResponses(testInteraction({ type: "graphicGapMatch", attributes: {} })),
    ).toBe(1);
    expect(
      maximumAllowedResponses(
        testInteraction({
          type: "graphicGapMatch",
          attributes: { "max-associations": "2" },
        }),
      ),
    ).toBe(2);
  });

  it("treats single-cardinality association interactions as one response", () => {
    expect(
      associationMaximumResponses(
        testInteraction({
          type: "associate",
          responseCardinality: "single",
          attributes: { "max-associations": "3" },
        }),
      ),
    ).toBe(1);
    expect(
      associationMaximumResponses(
        testInteraction({
          type: "match",
          responseCardinality: "multiple",
          attributes: { "max-associations": "3" },
        }),
      ),
    ).toBe(3);
  });
});
