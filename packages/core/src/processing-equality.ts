import { parseNumericOperatorAttribute } from "./operator-attribute.js";
import type { ProcessingVariables } from "./processing-variables.js";
import { parseXmlBoolean } from "./parser-values.js";
import type { QtiDiagnostic, QtiProcessingExpression, QtiValue } from "./types.js";

type EqualExpression = Extract<QtiProcessingExpression, { type: "equal" }>;
type EqualityTolerance =
  | { mode: "exact" }
  | {
      mode: "absolute" | "relative";
      lower: string;
      upper: string;
      includeLower: boolean;
      includeUpper: boolean;
    };

function parseTolerance(
  attributes: Record<string, string> = {},
): { ok: true; value: EqualityTolerance } | { ok: false; message: string } {
  const mode = attributes["tolerance-mode"] ?? "exact";
  if (mode !== "exact" && mode !== "absolute" && mode !== "relative") {
    return {
      ok: false,
      message: "qti-equal requires exact, absolute, or relative tolerance-mode.",
    };
  }
  const lowerAttribute = attributes["include-lower-bound"];
  const upperAttribute = attributes["include-upper-bound"];
  const includeLower = lowerAttribute === undefined ? true : parseXmlBoolean(lowerAttribute);
  const includeUpper = upperAttribute === undefined ? true : parseXmlBoolean(upperAttribute);
  if (includeLower === undefined || includeUpper === undefined) {
    return { ok: false, message: "qti-equal boundary flags must be boolean." };
  }
  if (mode === "exact") return { ok: true, value: { mode } };
  const tolerances = attributes.tolerance?.trim().split(/\s+/) ?? [];
  const [lower, upper = lower] = tolerances;
  if (!lower || !upper || tolerances.length > 2) {
    return {
      ok: false,
      message: "qti-equal requires one or two tolerance values in absolute or relative mode.",
    };
  }
  return { ok: true, value: { mode, lower, upper, includeLower, includeUpper } };
}

/** Validate tolerance attributes and numeric literal or declared-variable operands. */
export function validateEqualTolerance(
  expression: EqualExpression,
  variables: ProcessingVariables,
  diagnostics: QtiDiagnostic[],
): void {
  const parsed = parseTolerance(expression.attributes);
  const messages: string[] = [];
  if (!parsed.ok) messages.push(parsed.message);
  else if (parsed.value.mode !== "exact") {
    for (const token of [parsed.value.lower, parsed.value.upper]) {
      if (!variables.numericAttribute(token, "number") || Number(token) < 0) {
        messages.push(
          "qti-equal tolerance must be nonnegative numeric values or declared variable references.",
        );
        break;
      }
    }
  }
  for (const message of messages) {
    diagnostics.push({
      code: "processing.equal.tolerance",
      severity: "error",
      message,
      source: expression.source,
      path: expression.source?.path,
    });
  }
}

/** Compare single numeric operands using QTI absolute/relative tolerance and boundary rules. */
export function equalWithTolerance(
  expression: EqualExpression,
  left: QtiValue,
  right: QtiValue,
  resolve: (identifier: string) => QtiValue,
): boolean | null {
  if (typeof left !== "number" || typeof right !== "number") return null;
  const parsed = parseTolerance(expression.attributes);
  if (!parsed.ok) return null;
  const tolerance = parsed.value;
  if (tolerance.mode === "exact") return left === right;
  const lower = resolveTolerance(tolerance.lower, resolve);
  const upper = resolveTolerance(tolerance.upper, resolve);
  if (
    typeof lower !== "number" ||
    typeof upper !== "number" ||
    !Number.isFinite(lower) ||
    !Number.isFinite(upper) ||
    lower < 0 ||
    upper < 0
  )
    return null;
  const minimum = tolerance.mode === "absolute" ? left - lower : left * (1 - lower / 100);
  const maximum = tolerance.mode === "absolute" ? left + upper : left * (1 + upper / 100);
  return (
    (tolerance.includeLower ? right >= minimum : right > minimum) &&
    (tolerance.includeUpper ? right <= maximum : right < maximum)
  );
}

function resolveTolerance(raw: string, resolve: (identifier: string) => QtiValue): QtiValue {
  const attribute = parseNumericOperatorAttribute(raw);
  return attribute.type === "literal"
    ? attribute.value
    : attribute.type === "reference"
      ? resolve(attribute.identifier)
      : null;
}
