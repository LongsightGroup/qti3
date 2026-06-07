import type { QtiChoice } from "@longsightgroup/qti3-core";
import { parseUnlimitedMaximum } from "../response-limits.js";

export function isSingleUseGapSource(choice: QtiChoice): boolean {
  return parseUnlimitedMaximum(choice.attributes["match-max"]) === 1;
}

export function assignedSingleUseSourceIds(
  sources: QtiChoice[],
  assignments: Map<string, QtiChoice>,
): Set<string> {
  const assignedIds = new Set([...assignments.values()].map((choice) => choice.identifier));
  return new Set(
    sources
      .filter((source) => isSingleUseGapSource(source) && assignedIds.has(source.identifier))
      .map((source) => source.identifier),
  );
}

export function clearSingleUseSourceAssignments(
  assignments: Map<string, QtiChoice>,
  source: QtiChoice,
  keepGapIdentifier: string,
): void {
  if (!isSingleUseGapSource(source)) return;
  for (const [gapIdentifier, assigned] of assignments.entries()) {
    if (gapIdentifier !== keepGapIdentifier && assigned.identifier === source.identifier) {
      assignments.delete(gapIdentifier);
    }
  }
}

export function syncGapMatchSourceBank(
  sourceRegion: HTMLElement,
  sources: QtiChoice[],
  assignments: Map<string, QtiChoice>,
  selectedSourceId: string | undefined,
): void {
  const hiddenSourceIds = assignedSingleUseSourceIds(sources, assignments);
  for (const button of sourceRegion.querySelectorAll<HTMLButtonElement>("button")) {
    const sourceId = button.dataset.choiceIdentifier;
    const hidden = sourceId !== undefined && hiddenSourceIds.has(sourceId);
    button.hidden = hidden;
    button.setAttribute(
      "aria-pressed",
      !hidden && sourceId === selectedSourceId ? "true" : "false",
    );
  }
}
