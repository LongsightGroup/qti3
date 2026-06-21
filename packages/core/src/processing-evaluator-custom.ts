import type { QtiProcessingExpression, QtiValue } from "./types.js";
import type { EvaluationContext } from "./processing-evaluator.js";

type CustomOperatorExpression = Extract<QtiProcessingExpression, { type: "customOperator" }>;

export function evaluateCustomOperatorExpression(
  expression: CustomOperatorExpression,
  context: EvaluationContext,
): QtiValue {
  const operatorKey = expression.definition ?? expression.className ?? "";
  const handler = context.customOperators[operatorKey];
  if (!handler) return null;
  return handler({
    definition: expression.definition,
    className: expression.className,
    attributes: expression.attributes,
    values: expression.expressions.map((item) => context.evaluate(item)),
    expression,
  });
}
