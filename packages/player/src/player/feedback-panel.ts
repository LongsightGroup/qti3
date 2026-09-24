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
      if (entry.content) element.append(...renderContentNodes(entry.content, contentContext));
      else element.textContent = entry.text;
      return element;
    }),
  );
  feedback.hidden = visibleFeedback.length === 0;
}
