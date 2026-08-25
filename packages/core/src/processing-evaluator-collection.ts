import type { QtiProcessingExpression, QtiScalarValue, QtiValue } from "./types.js";
import { assertNever } from "./assert-never.js";
import type { EvaluationContext } from "./processing-evaluator.js";
import { MAX_QTI_REPEAT_RESULT_ELEMENTS } from "./processing-limits.js";
import { valueContainer } from "./processing-values.js";

type CollectionExpression = Extract<
  QtiProcessingExpression,
  { type: "multiple" | "ordered" | "index" | "containerSize" }
>;
type RepeatExpression = Extract<QtiProcessingExpression, { type: "repeat" }>;

export function evaluateCollectionExpression(
  expression: CollectionExpression,
  context: EvaluationContext,
): QtiValue {
  switch (expression.type) {
    case "multiple":
    case "ordered": {
      const values = expression.expressions.flatMap((item) =>
        valueContainer(context.evaluate(item)),
      );
      return values.length > 0 ? values : null;
    }
    case "index": {
      const values = valueContainer(context.evaluate(expression.expression));
      const n = context.indexValue(expression.n);
      if (n === undefined || n < 1 || n > values.length) return null;
      return values[n - 1] ?? null;
    }
    case "containerSize":
      return valueContainer(context.evaluate(expression.expression)).length;
    default:
      return assertNever(expression);
  }
}

export function evaluateRepeatExpression(
  expression: RepeatExpression,
  context: EvaluationContext,
): QtiValue {
  const repeats = context.indexValue(expression.numberRepeats);
  if (repeats === undefined || repeats < 1 || repeats > MAX_QTI_REPEAT_RESULT_ELEMENTS) {
    return null;
  }
  const container: QtiScalarValue[] = [];
  for (let repeat = 0; repeat < repeats; repeat += 1) {
    for (const item of expression.expressions) {
      const values = valueContainer(context.evaluate(item));
      if (values.length > MAX_QTI_REPEAT_RESULT_ELEMENTS - container.length) return null;
      for (const value of values) container.push(value);
    }
  }
  return container.length > 0 ? container : null;
}
