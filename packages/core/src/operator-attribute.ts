import { parseFiniteNumber } from "./parser-values.js";
import { parseVariableReference } from "./variable-reference.js";

export type NumericOperatorAttribute =
  | { type: "literal"; value: number }
  | { type: "reference"; identifier: string }
  | { type: "invalid" };

/** QTI numeric attribute references use the same braced identifier binding as patterns. */
export function parseNumericOperatorAttribute(raw: string): NumericOperatorAttribute {
  const value = parseFiniteNumber(raw);
  if (value !== undefined) return { type: "literal", value };
  const identifier = parseVariableReference(raw.trim());
  return identifier === undefined ? { type: "invalid" } : { type: "reference", identifier };
}
