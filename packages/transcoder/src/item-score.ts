import type { QtiAssessmentItem, QtiValue } from "@longsightgroup/qti3-core";

/** Resolve an explicit positive item score maximum, falling back when none is declared. */
export function itemMaximumScore(item: QtiAssessmentItem, fallback = 1): number {
  const maxScore = item.outcomeDeclarations.find(
    (declaration) => declaration.identifier === "MAXSCORE",
  );
  const declaredMaximum = scalarNumber(maxScore?.defaultValue);
  if (declaredMaximum !== undefined && declaredMaximum > 0) return declaredMaximum;

  const score = item.outcomeDeclarations.find((declaration) => declaration.identifier === "SCORE");
  const normalMaximum = Number(score?.attributes["normal-maximum"]);
  return Number.isFinite(normalMaximum) && normalMaximum > 0 ? normalMaximum : fallback;
}

function scalarNumber(value: QtiValue | undefined): number | undefined {
  const scalar = Array.isArray(value) ? value[0] : value;
  return typeof scalar === "number" && Number.isFinite(scalar) ? scalar : undefined;
}
