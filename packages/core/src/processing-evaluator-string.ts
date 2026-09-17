import type { QtiProcessingExpression, QtiValue } from "./types.js";
import { assertNever } from "./assert-never.js";
import type { EvaluationContext } from "./processing-evaluator.js";
import { isRecordValue, stringMatch } from "./processing-values.js";
import { matchXmlSchemaRegex, patternVariableIdentifier } from "./xml-schema-regex.js";

type StringExpression = Extract<
  QtiProcessingExpression,
  { type: "stringMatch" | "substring" | "patternMatch" | "fieldValue" }
>;

export function evaluateStringExpression(
  expression: StringExpression,
  context: EvaluationContext,
): QtiValue {
  switch (expression.type) {
    case "stringMatch":
      return stringMatch(
        context.evaluate(expression.left),
        context.evaluate(expression.right),
        expression.caseSensitive,
        expression.substring,
      );
    case "substring":
      return stringMatch(
        context.evaluate(expression.right),
        context.evaluate(expression.left),
        expression.caseSensitive,
        true,
      );
    case "patternMatch": {
      const value = context.evaluate(expression.expression);
      if (value === null) return null;
      const reference = patternVariableIdentifier(expression.pattern);
      const pattern =
        reference === undefined
          ? expression.pattern
          : context.evaluate({ type: "variable", identifier: reference });
      if (pattern === null) return null;
      if (typeof value !== "string" || typeof pattern !== "string") {
        context.diagnostics.push({
          code: "processing.pattern.type",
          severity: "error",
          message: "Pattern matching requires a single string pattern and operand.",
          source: expression.source,
        });
        return null;
      }
      const result = matchXmlSchemaRegex(pattern, value);
      if (result.ok) return result.matches;
      context.diagnostics.push({
        code: `processing.pattern.${result.problem.code}`,
        severity: "error",
        message: result.problem.message,
        source: expression.source,
      });
      return null;
    }
    case "fieldValue": {
      const value = context.evaluate(expression.expression);
      return isRecordValue(value) ? (value[expression.fieldIdentifier] ?? null) : null;
    }
    default:
      return assertNever(expression);
  }
}
