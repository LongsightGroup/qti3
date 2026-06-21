import type { QtiProcessingExpression, QtiValue } from "./types.js";
import { assertNever } from "./assert-never.js";
import type { EvaluationContext } from "./processing-evaluator.js";
import { booleanValueOrNull } from "./processing-values.js";

type BooleanExpression = Extract<QtiProcessingExpression, { type: "and" | "anyN" | "or" | "not" }>;

export function evaluateBooleanExpression(
  expression: BooleanExpression,
  context: EvaluationContext,
): QtiValue {
  switch (expression.type) {
    case "and": {
      let sawNull = false;
      for (const item of expression.expressions) {
        const value = booleanValueOrNull(context.evaluate(item));
        if (value === false) return false;
        if (value === null) sawNull = true;
      }
      return sawNull ? null : true;
    }
    case "anyN": {
      const min = context.indexValue(expression.min) ?? 0;
      const max = context.indexValue(expression.max) ?? 0;
      const values = expression.expressions.map((item) => context.evaluate(item));
      const trueCount = values.filter((value) => value === true).length;
      const nullCount = values.filter((value) => value === null).length;
      if (min > max || trueCount > max || trueCount + nullCount < min) return false;
      if (trueCount >= min && trueCount <= max) return true;
      return null;
    }
    case "or": {
      let sawNull = false;
      for (const item of expression.expressions) {
        const value = booleanValueOrNull(context.evaluate(item));
        if (value === true) return true;
        if (value === null) sawNull = true;
      }
      return sawNull ? null : false;
    }
    case "not": {
      const value = booleanValueOrNull(context.evaluate(expression.expression));
      return value === null ? null : !value;
    }
    default:
      return assertNever(expression);
  }
}
