import type { QtiAttemptStateV1, QtiItemSession, QtiValue } from "@longsightgroup/qti3-core";

/** QTI 3 §7.19: suppressed non-adaptive review uses the original outcome defaults. */
export function feedbackPresentation(
  session: QtiItemSession,
  state: QtiAttemptStateV1,
  showFeedback: boolean | undefined,
): {
  outcomeValue(identifier: string): QtiValue;
  modalOutcomes: Record<string, QtiValue> | undefined;
} {
  // This player permits review. Adaptive review retains the final feedback (§7.19.3).
  const suppress = state.status === "completed" && !session.item.adaptive && showFeedback === false;
  return {
    outcomeValue: (identifier) =>
      suppress ? session.initialOutcomeValue(identifier) : (state.outcomes[identifier] ?? null),
    modalOutcomes: state.responseProcessingCompleted && !suppress ? state.outcomes : undefined,
  };
}
