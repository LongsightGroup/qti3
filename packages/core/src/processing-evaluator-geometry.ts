import type { QtiProcessingExpression, QtiValue } from "./types.js";
import type { EvaluationContext } from "./processing-evaluator.js";
import { parsePoint, pointInsideArea } from "./processing-mapping.js";
import { valueContainer } from "./processing-values.js";

type GeometryExpression = Extract<QtiProcessingExpression, { type: "inside" }>;

export function evaluateGeometryExpression(
  expression: GeometryExpression,
  context: EvaluationContext,
): QtiValue {
  const value = context.evaluate(expression.expression);
  if (value === null) return null;
  if (expression.shape === "default") return true;
  return valueContainer(value).some((pointValue) => {
    const point = parsePoint(String(pointValue));
    return point
      ? pointInsideArea(point, {
          shape: expression.shape,
          coords: expression.coords,
          mappedValue: 0,
          attributes: {},
        })
      : false;
  });
}
