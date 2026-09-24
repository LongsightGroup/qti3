import {
  visibleModalFeedback,
  type QtiAssessmentItem,
  type QtiValue,
} from "@longsightgroup/qti3-core";
import { renderContentNodes, type PlayerContentContext } from "../content/content-renderer.js";

export function syncFeedbackPanel(
  feedback: HTMLElement | null,
  item: QtiAssessmentItem,
  outcomes: Record<string, QtiValue>,
  contentContext: PlayerContentContext,
): void {
  if (!feedback) return;
  const visibleFeedback = visibleModalFeedback(item, outcomes);
  feedback.replaceChildren(
    ...visibleFeedback.map((entry) => {
      const element = document.createElement("div");
      element.dataset.feedbackIdentifier = entry.identifier;
      if (entry.title) {
        element.setAttribute("role", "group");
        element.setAttribute("aria-label", entry.title);
        const label = document.createElement("p");
        label.className = "qti3-feedback-title";
        label.textContent = entry.title;
        element.append(label);
      }
      element.append(...renderContentNodes(entry.content, contentContext));
      return element;
    }),
  );
  feedback.hidden = visibleFeedback.length === 0;
}
