import type { QtiChoice } from "@longsightgroup/qti3-core";
import { choiceMatchLimitExceeded, choiceMatchMaximum } from "../response-limits.js";

export function isSingleUseGapSource(choice: QtiChoice): boolean {
  return sourceMatchMaximum(choice) === 1;
}

export function sourceMatchMaximum(choice: QtiChoice): number | undefined {
  return choiceMatchMaximum(choice);
}

export function sourceUseCount(placements: readonly QtiChoice[], source: QtiChoice): number {
  return placements.filter((choice) => choice.identifier === source.identifier).length;
}

export function sourceUseLimitExceeded(
  assignments: Map<string, QtiChoice>,
  source: QtiChoice,
): boolean {
  return choiceMatchLimitExceeded(source, sourceUseCount([...assignments.values()], source));
}

export function assignedLimitedSourceIds(
  sources: QtiChoice[],
  placements: readonly QtiChoice[],
): Set<string> {
  return new Set(
    sources
      .filter((source) => {
        const maximum = sourceMatchMaximum(source);
        return maximum !== undefined && sourceUseCount(placements, source) >= maximum;
      })
      .map((source) => source.identifier),
  );
}

export function clearSingleUseSourceAssignments(
  assignments: Map<string, QtiChoice>,
  source: QtiChoice,
  keepGapIdentifier: string,
): void {
  if (sourceMatchMaximum(source) !== 1) return;
  for (const [gapIdentifier, assigned] of assignments.entries()) {
    if (gapIdentifier !== keepGapIdentifier && assigned.identifier === source.identifier) {
      assignments.delete(gapIdentifier);
    }
  }
}

export function syncGapMatchSourceBank(
  sourceRegion: HTMLElement,
  sources: QtiChoice[],
  placements: readonly QtiChoice[],
  selectedSourceId: string | undefined,
): void {
  const hiddenSourceIds = assignedLimitedSourceIds(sources, placements);
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
