import type { QtiAssessmentItem } from "./types.js";

/** Items that declare automated scoring via response processing or a SCORE outcome. */
export function itemExpectsAutomatedScore(item: QtiAssessmentItem): boolean {
  return (
    Boolean(item.responseProcessing) ||
    item.outcomeDeclarations.some((declaration) => declaration.identifier === "SCORE")
  );
}
