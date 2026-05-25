import { choiceSelector } from "../interaction-support.js";
import type { QtiPlayerMessages } from "../player-messages.js";

export function createSelectionSummary(): HTMLParagraphElement {
  const summary = document.createElement("p");
  summary.className = "qti3-selection-summary";
  summary.setAttribute("aria-live", "polite");
  return summary;
}

export function orderedItemAccessibleName(
  messages: QtiPlayerMessages,
  label: string,
  index: number,
  total: number,
): string {
  return messages.orderedItemAtPosition({ label, position: index + 1, total });
}

export function announceOrderedItemMove(
  summary: HTMLElement,
  messages: QtiPlayerMessages,
  label: string,
  to: number,
  total: number,
  from?: number,
): void {
  if (from !== undefined && Math.abs(to - from) === 1) {
    summary.textContent = messages.orderedItemMovedOneStep({
      label,
      direction: to < from ? "up" : "down",
    });
    return;
  }
  summary.textContent = messages.orderedItemMovedToPosition({
    label,
    position: to + 1,
    total,
  });
}

export function announceOrderedSelectionCount(
  summary: HTMLElement,
  messages: QtiPlayerMessages,
  count: number,
): void {
  summary.textContent =
    count > 0
      ? messages.graphicOrderRegionsSelected({ count })
      : messages.graphicOrderNoRegionsSelected();
}

export function focusReorderControl(container: ParentNode, identifier: string): void {
  container.querySelector<HTMLButtonElement>(`button${choiceSelector(identifier)}`)?.focus();
}
