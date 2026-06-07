import type { QtiDiagnostic, QtiInteraction } from "@longsightgroup/qti3-core";
import { maximumResponseDiagnostic } from "./player-validation.js";

export const QTI3_INLINE_VALIDATION_EVENT = "qti3-inline-validation";

export interface InlineValidationDetail {
  responseIdentifier: string;
  diagnostic: QtiDiagnostic | undefined;
}

export function dispatchInlineValidation(
  host: HTMLElement,
  responseIdentifier: string,
  diagnostic: QtiDiagnostic | undefined,
): void {
  host.dispatchEvent(
    new CustomEvent<InlineValidationDetail>(QTI3_INLINE_VALIDATION_EVENT, {
      bubbles: true,
      detail: { responseIdentifier, diagnostic },
    }),
  );
}

export function reportMaximumResponseExceeded(
  host: HTMLElement,
  interaction: QtiInteraction,
  maximum: number,
): void {
  const responseIdentifier = interaction.responseIdentifier;
  if (!responseIdentifier) return;
  dispatchInlineValidation(
    host,
    responseIdentifier,
    maximumResponseDiagnostic(responseIdentifier, interaction, maximum),
  );
}
