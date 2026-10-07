import type { QtiAssessmentItem } from "@longsightgroup/qti3-core";
import { itemMaximumScore } from "./item-score.js";

/** Recognize the standard one-point match policy native choice scoring can reproduce. */
export function usesStandardUnitChoiceScore(item: QtiAssessmentItem): boolean {
  const processing = item.responseProcessing;
  return (
    item.interactions.length === 1 &&
    item.interactions[0]?.responseIdentifier === "RESPONSE" &&
    item.responseDeclarations.length === 1 &&
    item.responseDeclarations[0]?.identifier === "RESPONSE" &&
    itemMaximumScore(item) === 1 &&
    processing !== undefined &&
    (processing.template === "https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct" ||
      processing.template ===
        "https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct.xml") &&
    processing.rules.length === 0 &&
    processing.conditions.length === 0 &&
    (processing.expressions?.length ?? 0) === 0
  );
}
