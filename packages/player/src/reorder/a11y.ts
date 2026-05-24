import { choiceSelector } from "../interaction-support.js";

export function createSelectionSummary(): HTMLParagraphElement {
  const summary = document.createElement("p");
  summary.className = "qti3-selection-summary";
  summary.setAttribute("aria-live", "polite");
  return summary;
}

export function orderedItemAccessibleName(label: string, index: number, total: number): string {
  return `${label}, position ${index + 1} of ${total}`;
}

export function announceOrderedItemMove(
  summary: HTMLElement,
  label: string,
  to: number,
  total: number,
  from?: number,
): void {
  if (from !== undefined && Math.abs(to - from) === 1) {
    summary.textContent = `${label} moved ${to < from ? "up" : "down"}.`;
    return;
  }
  summary.textContent = `${label} moved to position ${to + 1} of ${total}.`;
}

export function announceOrderedSelectionCount(
  summary: HTMLElement,
  count: number,
  singular: string,
  plural: string,
): void {
  summary.textContent =
    count > 0 ? `${count} ${count === 1 ? singular : plural}.` : `No ${plural}.`;
}

export function focusReorderControl(container: ParentNode, identifier: string): void {
  container.querySelector<HTMLButtonElement>(`button${choiceSelector(identifier)}`)?.focus();
}
