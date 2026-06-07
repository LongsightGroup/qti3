import type { QtiChoice, QtiValue } from "@longsightgroup/qti3-core";
import { clearSingleUseSourceAssignments } from "./gap-match-source-bank.js";

export interface GapMatchAssignmentOptions {
  originGapIdentifier?: string | undefined;
  maximumAssignments?: number | undefined;
}

export interface GapMatchAssignmentResult {
  accepted: boolean;
  next: Map<string, QtiChoice>;
}

export function tryGapMatchAssignment(
  current: Map<string, QtiChoice>,
  gapIdentifier: string,
  source: QtiChoice,
  options: GapMatchAssignmentOptions = {},
): GapMatchAssignmentResult {
  const next = new Map(current);
  if (options.originGapIdentifier && options.originGapIdentifier !== gapIdentifier) {
    next.delete(options.originGapIdentifier);
  }
  clearSingleUseSourceAssignments(next, source, gapIdentifier);
  next.set(gapIdentifier, source);
  const maximum = options.maximumAssignments;
  if (maximum !== undefined && next.size > maximum) {
    return { accepted: false, next: current };
  }
  return { accepted: true, next };
}

export function applyGapMatchAssignments(
  target: Map<string, QtiChoice>,
  next: Map<string, QtiChoice>,
): void {
  target.clear();
  for (const [gapIdentifier, source] of next.entries()) {
    target.set(gapIdentifier, source);
  }
}

export function gapMatchResponseValue(assignments: Map<string, QtiChoice>): QtiValue {
  return [...assignments.entries()].map(
    ([gapIdentifier, source]) => `${source.identifier} ${gapIdentifier}`,
  );
}
