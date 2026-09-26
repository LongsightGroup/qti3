import { parseFiniteNumber } from "./parser-values.js";
import { parseVariableReference } from "./variable-reference.js";

export type NumericOperatorAttribute =
  | { type: "literal"; value: number }
  | { type: "reference"; identifier: string }
  | { type: "invalid" };

/** QTI numeric attribute references use the same braced identifier binding as patterns. */
export function parseNumericOperatorAttribute(raw: string | undefined): NumericOperatorAttribute {
  if (raw === undefined) return { type: "invalid" };
  const value = parseFiniteNumber(raw);
  if (value !== undefined) return { type: "literal", value };
  const identifier = parseVariableReference(raw.trim());
  return identifier === undefined ? { type: "invalid" } : { type: "reference", identifier };
}

/** QTI random operators default only omitted min/step; empty attributes remain invalid. */
export function randomOperatorAttributes(expression: {
  min: string | undefined;
  max: string | undefined;
  step?: string | undefined;
}) {
  return { min: expression.min ?? "0", max: expression.max, step: expression.step ?? "1" };
}
