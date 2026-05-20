import type { QtiInteractionType } from "@qti3/core";

export interface InteractionA11yContract {
  interactionType: QtiInteractionType;
  keyboardRequired: boolean;
  requiresAccessibleName: boolean;
  requiresValidationMessageAssociation: boolean;
}

export const a11yContracts: InteractionA11yContract[] = [
  "associate",
  "choice",
  "custom",
  "drawing",
  "endAttempt",
  "extendedText",
  "gapMatch",
  "graphicAssociate",
  "graphicGapMatch",
  "graphicOrder",
  "hotspot",
  "hottext",
  "inlineChoice",
  "match",
  "media",
  "order",
  "positionObject",
  "portableCustom",
  "selectPoint",
  "slider",
  "textEntry",
  "upload",
].map((interactionType) => ({
  interactionType: interactionType as QtiInteractionType,
  keyboardRequired: interactionType !== "media",
  requiresAccessibleName: true,
  requiresValidationMessageAssociation: true,
}));
