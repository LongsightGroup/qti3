import {
  visibleModalFeedback,
  type QtiAssessmentItem,
  type QtiValue,
} from "@longsightgroup/qti3-core";

export function syncFeedbackPanel(
  feedback: HTMLElement | null,
  item: QtiAssessmentItem,
  outcomes: Record<string, QtiValue>,
): void {
  if (!feedback) return;
  const visibleFeedback = visibleModalFeedback(item, outcomes);
  feedback.replaceChildren(
    ...visibleFeedback.map((entry) => {
      const element = document.createElement("p");
      element.dataset.feedbackIdentifier = entry.identifier;
      element.textContent = entry.text;
      return element;
    }),
  );
  feedback.hidden = visibleFeedback.length === 0;
}
