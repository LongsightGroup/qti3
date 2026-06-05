import type { OrderOrientation } from "../interactions/shared-vocabulary.js";
import { choiceSelector } from "../interaction-support.js";
import { reorderStepDirection } from "../movement.js";
import type { PlayerMessageResolver } from "../player-message-resolver.js";

export function createSelectionSummary(): HTMLParagraphElement {
  const summary = document.createElement("p");
  summary.className = "qti3-selection-summary";
  summary.setAttribute("aria-live", "polite");
  return summary;
}

export function orderedItemAccessibleName(
  messages: PlayerMessageResolver,
  label: string,
  index: number,
  total: number,
): string {
  return messages.message("orderedItemAtPosition", { label, position: index + 1, total });
}

export function announceOrderedItemMove(
  summary: HTMLElement,
  messages: PlayerMessageResolver,
  label: string,
  to: number,
  total: number,
  from: number | undefined,
  orientation: OrderOrientation,
): void {
  if (from !== undefined && Math.abs(to - from) === 1) {
    summary.textContent = messages.message("orderedItemMovedOneStep", {
      label,
      direction: reorderStepDirection(orientation, from, to),
    });
    return;
  }
  summary.textContent = messages.message("orderedItemMovedToPosition", {
    label,
    position: to + 1,
    total,
  });
}

export function announceOrderedSelectionCount(
  summary: HTMLElement,
  messages: PlayerMessageResolver,
  count: number,
): void {
  summary.textContent =
    count > 0
      ? messages.message("graphicOrderRegionsSelected", { count })
      : messages.message("graphicOrderNoRegionsSelected");
}

export function focusReorderControl(container: ParentNode, identifier: string): void {
  container.querySelector<HTMLButtonElement>(`button${choiceSelector(identifier)}`)?.focus();
}
