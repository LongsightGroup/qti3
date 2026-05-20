import { interactionSupport, type QtiInteractionType } from "@qti3/core";

export interface InteractionA11yContract {
  interactionType: QtiInteractionType;
  keyboardRequired: boolean;
  requiresAccessibleName: boolean;
  requiresValidationMessageAssociation: boolean;
}

export const a11yContracts: InteractionA11yContract[] = interactionSupport.map((support) => ({
  interactionType: support.interactionType as QtiInteractionType,
  keyboardRequired: support.interactionType !== "media",
  requiresAccessibleName: true,
  requiresValidationMessageAssociation: true,
}));
