import { describe, expect, it } from "vitest";
import { itemExpectsAutomatedScore } from "./item-scoring-expectation.js";
import {
  classifyQtiItemScoringDisposition,
  itemHasManuallyScoredInteractions,
  itemNeedsScoringFollowUpWhenUnscored,
} from "./scoring-disposition-policy.js";
import type { QtiAssessmentItem } from "./types.js";

describe("scoring disposition policy", () => {
  it("detects automated scoring expectations from response processing", () => {
    const item = minimalItem({
      responseProcessing: { template: "match_correct", rules: [], conditions: [] },
    });
    expect(itemExpectsAutomatedScore(item)).toBe(true);
    expect(itemNeedsScoringFollowUpWhenUnscored(item)).toBe(true);
    expect(classifyQtiItemScoringDisposition(item, null)).toBe("manual-scoring-required");
  });

  it("detects manually scored interaction types", () => {
    const item = minimalItem({
      interactions: [interaction("extendedText")],
    });
    expect(itemHasManuallyScoredInteractions(item)).toBe(true);
    expect(itemNeedsScoringFollowUpWhenUnscored(item)).toBe(true);
    expect(classifyQtiItemScoringDisposition(item, null)).toBe("manual-scoring-required");
  });

  it("classifies reference-only interactions as unscored", () => {
    const item = minimalItem({
      interactions: [interaction("media")],
    });
    expect(itemNeedsScoringFollowUpWhenUnscored(item)).toBe(false);
    expect(classifyQtiItemScoringDisposition(item, null)).toBe("unscored-reference");
  });

  it("prefers scored when a numeric score is present", () => {
    const item = minimalItem({
      responseProcessing: { template: "match_correct", rules: [], conditions: [] },
    });
    expect(classifyQtiItemScoringDisposition(item, 1)).toBe("scored");
  });
});

function minimalItem(overrides: Partial<QtiAssessmentItem> = {}): QtiAssessmentItem {
  return {
    identifier: "item",
    adaptive: false,
    attributes: {},
    responseDeclarations: [],
    outcomeDeclarations: [],
    templateDeclarations: [],
    interactions: [],
    modalFeedback: [],
    catalogReferences: [],
    stylesheets: [],
    body: [],
    bodyText: "",
    ...overrides,
  };
}

function interaction(
  type: QtiAssessmentItem["interactions"][number]["type"],
  responseIdentifier = "RESPONSE",
): QtiAssessmentItem["interactions"][number] {
  return {
    type,
    registryStatus: "supported",
    qtiName: `qti-${type}-interaction`,
    responseIdentifier,
    choices: [],
    childElements: [],
    attributes: {},
    text: "",
  };
}
