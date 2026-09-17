import type { QtiChoice } from "@longsightgroup/qti3-core";
import { choiceMatchMaximum } from "../response-limits.js";

/** Each array entry is one placement; equal directed pairs remain distinct. */
export type GraphicGapAssignments = Map<string, QtiChoice[]>;

type AssignmentResult =
  | { accepted: true; next: GraphicGapAssignments }
  | { accepted: false; maximum: number; choice?: QtiChoice };

export function graphicGapResponse(assignments: GraphicGapAssignments): string[] {
  return [...assignments].flatMap(([gap, sources]) =>
    sources.map((source) => `${source.identifier} ${gap}`),
  );
}

export function removeGraphicGapInstance(
  assignments: GraphicGapAssignments,
  gap: string,
  sourceIdentifier: string,
): boolean {
  const sources = assignments.get(gap);
  const index = sources?.findIndex((source) => source.identifier === sourceIdentifier) ?? -1;
  if (!sources || index < 0) return false;
  sources.splice(index, 1);
  if (sources.length === 0) assignments.delete(gap);
  return true;
}

export function assignGraphicGapInstance(
  current: GraphicGapAssignments,
  gap: QtiChoice,
  source: QtiChoice,
  maximumAssignments: number | undefined,
  originGap?: string,
): AssignmentResult {
  const next = new Map([...current].map(([id, sources]) => [id, [...sources]]));
  if (originGap !== undefined) {
    if (!removeGraphicGapInstance(next, originGap, source.identifier)) {
      return { accepted: true, next: current };
    }
  }
  // A single-use token can be moved; a one-place target can be replaced.
  if (choiceMatchMaximum(source) === 1) {
    for (const id of next.keys()) removeGraphicGapInstance(next, id, source.identifier);
  }
  const targetMaximum = choiceMatchMaximum(gap);
  const assigned = targetMaximum === 1 ? [] : (next.get(gap.identifier) ?? []);
  assigned.push(source);
  next.set(gap.identifier, assigned);
  if (targetMaximum !== undefined && assigned.length > targetMaximum) {
    return { accepted: false, maximum: targetMaximum, choice: gap };
  }
  const allSources = [...next.values()].flat();
  const sourceMaximum = choiceMatchMaximum(source);
  if (
    sourceMaximum !== undefined &&
    allSources.filter((choice) => choice.identifier === source.identifier).length > sourceMaximum
  ) {
    return { accepted: false, maximum: sourceMaximum, choice: source };
  }
  if (maximumAssignments !== undefined && allSources.length > maximumAssignments) {
    return { accepted: false, maximum: maximumAssignments };
  }
  return { accepted: true, next };
}
