import type { QtiSourceLocation } from "./types.js";

/** Scalar types supported by deterministic test outcome processing. */
export type QtiTestBaseType = "integer" | "float" | "boolean" | "string" | "identifier";

/** Test expressions form a closed language, independent of item processing. */
export type QtiTestExpression = (
  | {
      readonly type: "baseValue";
      readonly baseType: QtiTestBaseType;
      readonly value: number | boolean | string;
    }
  | { readonly type: "variable"; readonly identifier: string }
  | {
      readonly type: "testVariables";
      readonly variableIdentifier: string;
      readonly includeCategory?: string | undefined;
    }
  | { readonly type: "sum"; readonly expressions: readonly QtiTestExpression[] }
  | { readonly type: "and"; readonly expressions: readonly QtiTestExpression[] }
  | { readonly type: "or"; readonly expressions: readonly QtiTestExpression[] }
  | {
      readonly type: "numericCompare";
      readonly operator: "gt" | "gte" | "lt" | "lte";
      readonly left: QtiTestExpression;
      readonly right: QtiTestExpression;
    }
  | { readonly type: "not"; readonly expression: QtiTestExpression }
) & { readonly source?: QtiSourceLocation | undefined };

/** XML names, AST variants, arities and attributes owned by the test language. */
export const testExpressionSyntax = [
  { name: "qti-base-value", type: "baseValue", arity: 0, attributes: ["base-type"] },
  { name: "qti-variable", type: "variable", arity: 0, attributes: ["identifier"] },
  {
    name: "qti-test-variables",
    type: "testVariables",
    arity: 0,
    attributes: ["variable-identifier", "include-category"],
  },
  { name: "qti-sum", type: "sum", arity: "oneOrMore", attributes: [] },
  { name: "qti-gt", type: "numericCompare", operator: "gt", arity: 2, attributes: [] },
  { name: "qti-gte", type: "numericCompare", operator: "gte", arity: 2, attributes: [] },
  { name: "qti-lt", type: "numericCompare", operator: "lt", arity: 2, attributes: [] },
  { name: "qti-lte", type: "numericCompare", operator: "lte", arity: 2, attributes: [] },
  { name: "qti-and", type: "and", arity: "oneOrMore", attributes: [] },
  { name: "qti-or", type: "or", arity: "oneOrMore", attributes: [] },
  { name: "qti-not", type: "not", arity: 1, attributes: [] },
] as const satisfies readonly {
  name: string;
  type: QtiTestExpression["type"];
  operator?: "gt" | "gte" | "lt" | "lte";
  arity: number | "oneOrMore";
  attributes: readonly string[];
}[];

/** Refine a supported test scalar type without accepting item-only base types. */
export function isTestBaseType(value: string | undefined): value is QtiTestBaseType {
  return (
    value === "integer" ||
    value === "float" ||
    value === "boolean" ||
    value === "string" ||
    value === "identifier"
  );
}
