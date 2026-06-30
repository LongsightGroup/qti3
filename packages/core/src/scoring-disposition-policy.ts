import type { QtiAssessmentItem } from "./types.js";
import { itemExpectsAutomatedScore } from "./item-scoring-expectation.js";

export type QtiItemSubmissionScoringDisposition =
  | "scored"
  | "manual-scoring-required"
  | "unscored-reference"
  | "invalid";

const MANUALLY_SCORED_INTERACTION_TYPES = new Set<string>([
  "custom",
  "drawing",
  "extendedText",
  "portableCustom",
  "upload",
]);

/** Interaction types that typically require human review even without response processing. */
export function itemHasManuallyScoredInteractions(item: QtiAssessmentItem): boolean {
  return item.interactions.some((interaction) =>
    MANUALLY_SCORED_INTERACTION_TYPES.has(interaction.type),
  );
}

export function itemNeedsScoringFollowUpWhenUnscored(item: QtiAssessmentItem): boolean {
  return itemExpectsAutomatedScore(item) || itemHasManuallyScoredInteractions(item);
}

/** Default generic disposition taxonomy shipped by qti3-core for submission materialization. */
export function classifyQtiItemScoringDisposition(
  item: QtiAssessmentItem,
  score: number | null,
): Exclude<QtiItemSubmissionScoringDisposition, "invalid"> {
  if (score !== null) return "scored";
  if (itemNeedsScoringFollowUpWhenUnscored(item)) return "manual-scoring-required";
  return "unscored-reference";
}
