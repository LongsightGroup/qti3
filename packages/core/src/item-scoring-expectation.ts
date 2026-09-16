import type { QtiAssessmentItem } from "./types.js";

/** An external score cannot be inferred from an initialized or restored outcome value. */
export function itemHasExternalScore(item: QtiAssessmentItem): boolean {
  const scoring = item.outcomeDeclarations.find((declaration) => declaration.identifier === "SCORE")
    ?.attributes["external-scored"];
  return scoring === "human" || scoring === "externalMachine";
}

/** Items that declare automated scoring via response processing or a SCORE outcome. */
export function itemExpectsAutomatedScore(item: QtiAssessmentItem): boolean {
  if (itemHasExternalScore(item)) return false;
  return (
    Boolean(item.responseProcessing) ||
    item.outcomeDeclarations.some((declaration) => declaration.identifier === "SCORE")
  );
}
