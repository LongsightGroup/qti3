import type { QtiProcessingExpression, QtiValue } from "./types.js";
import { assertNever } from "./assert-never.js";
import type { EvaluationContext } from "./processing-evaluator.js";
import { qtiValueToString } from "./value-format.js";
import { isRecordValue, stringMatch } from "./processing-values.js";
import { resolveOptionalVariableValue } from "./processing-variables.js";

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
      const patternValue =
        resolveOptionalVariableValue(
          context.document,
          expression.pattern,
          context.responses,
          context.outcomes,
          context.templateValues,
        ) ??
        context.undeclaredResponseValue(expression.pattern) ??
        expression.pattern;
      try {
        return new RegExp(
          typeof patternValue === "string" ? patternValue : qtiValueToString(patternValue),
        ).test(qtiValueToString(value));
      } catch {
        return null;
      }
    }
    case "fieldValue": {
      const value = context.evaluate(expression.expression);
      return isRecordValue(value) ? (value[expression.fieldIdentifier] ?? null) : null;
    }
    default:
      return assertNever(expression);
  }
}
