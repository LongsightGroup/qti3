import type { QtiDiagnostic } from "@longsightgroup/qti3-core";

/** Load-time item structure problems emitted during `loadXml` and mirrored into validation UI. */
export const AUTHORING_DIAGNOSTIC_CODES = new Set<string>([
  "interaction.unsupported",
  "interaction.choices.missing",
  "interaction.embed.unsupported",
  "interaction.patternMask.invalid",
]);

export function isAuthoringDiagnostic(diagnostic: QtiDiagnostic): boolean {
  return AUTHORING_DIAGNOSTIC_CODES.has(diagnostic.code);
}

/** Response-scoring and attempt validation messages persisted separately from authoring diagnostics. */
export function responseValidationMessages(messages: QtiDiagnostic[]): QtiDiagnostic[] {
  return messages.filter((message) => !isAuthoringDiagnostic(message));
}

export function mergeVisibleValidationMessages(
  authoringDiagnostics: QtiDiagnostic[],
  validationMessages: QtiDiagnostic[],
): QtiDiagnostic[] {
  return [...authoringDiagnostics, ...validationMessages];
}

/**
 * Serialized attempt state stores both authoring and response validation messages together.
 * After restore, split response messages back out so they are not duplicated against
 * load-time `authoringDiagnostics`.
 */
export function splitSerializedValidationMessages(messages: QtiDiagnostic[]): {
  authoringDiagnostics: QtiDiagnostic[];
  validationMessages: QtiDiagnostic[];
} {
  const authoringDiagnostics: QtiDiagnostic[] = [];
  const validationMessages: QtiDiagnostic[] = [];
  for (const message of messages) {
    if (isAuthoringDiagnostic(message)) authoringDiagnostics.push(message);
    else validationMessages.push(message);
  }
  return { authoringDiagnostics, validationMessages };
}
