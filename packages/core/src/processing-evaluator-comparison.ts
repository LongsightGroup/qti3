import type { QtiProcessingExpression, QtiValue } from "./types.js";
import { equalWithTolerance } from "./processing-equality.js";
import { assertNever } from "./assert-never.js";
import type { EvaluationContext } from "./processing-evaluator.js";
import {
  containsValues,
  durationSeconds,
  numericValueOrNull,
  qtiMatchValues,
  valuesEqual,
  valueContainer,
} from "./processing-values.js";
import { expressionBaseType, expressionIsOrdered } from "./processing-variables.js";
import { roundWithMode } from "./processing-operators.js";

type ComparisonExpression = Extract<
  QtiProcessingExpression,
  {
    type:
      | "match"
      | "equal"
      | "equalRounded"
      | "numericCompare"
      | "durationCompare"
      | "member"
      | "delete"
      | "contains";
  }
>;

export function evaluateComparisonExpression(
  expression: ComparisonExpression,
  context: EvaluationContext,
): QtiValue {
  switch (expression.type) {
    case "match": {
      const left = context.evaluate(expression.left);
      const right = context.evaluate(expression.right);
      return qtiMatchValues(
        left,
        right,
        expressionIsOrdered(expression.left, context.document) ||
          expressionIsOrdered(expression.right, context.document),
        expressionBaseType(expression.left, context.document) ??
          expressionBaseType(expression.right, context.document),
      );
    }
    case "equal": {
      const left = context.evaluate(expression.left);
      const right = context.evaluate(expression.right);
      return equalWithTolerance(expression, left, right, (identifier) =>
        context.evaluate({ type: "variable", identifier }),
      );
    }
    case "equalRounded": {
      const validRounding =
        Number.isInteger(expression.figures) &&
        (expression.roundingMode === "decimalPlaces"
          ? expression.figures >= 0
          : expression.roundingMode === "significantFigures" && expression.figures > 0);
      if (!validRounding) return null;
      const left = context.evaluate(expression.left);
      const right = context.evaluate(expression.right);
      if (left === null || right === null) return null;
      const leftNumber = numericValueOrNull(left);
      const rightNumber = numericValueOrNull(right);
      if (leftNumber === null || rightNumber === null) return null;
      const roundedLeft = roundWithMode(leftNumber, expression.roundingMode, expression.figures);
      const roundedRight = roundWithMode(rightNumber, expression.roundingMode, expression.figures);
      return roundedLeft === null || roundedRight === null ? null : roundedLeft === roundedRight;
    }
    case "numericCompare": {
      const leftValue = context.evaluate(expression.left);
      const rightValue = context.evaluate(expression.right);
      if (leftValue === null || rightValue === null) return null;
      const left = numericValueOrNull(leftValue);
      const right = numericValueOrNull(rightValue);
      if (left === null || right === null) return null;
      if (expression.operator === "lt") return left < right;
      if (expression.operator === "lte") return left <= right;
      if (expression.operator === "gt") return left > right;
      return left >= right;
    }
    case "durationCompare": {
      const left = durationSeconds(context.evaluate(expression.left));
      const right = durationSeconds(context.evaluate(expression.right));
      if (left === null || right === null) return null;
      return expression.operator === "lt" ? left < right : left >= right;
    }
    case "member": {
      const value = context.evaluate(expression.value);
      const collection = context.evaluate(expression.collection);
      if (value === null || collection === null) return null;
      const baseType =
        expressionBaseType(expression.value, context.document) ??
        expressionBaseType(expression.collection, context.document);
      return valueContainer(collection).some((item) => valuesEqual(item, value, false, baseType));
    }
    case "delete": {
      const value = context.evaluate(expression.value);
      const collectionValue = context.evaluate(expression.collection);
      if (value === null || collectionValue === null) return null;
      const collection = valueContainer(collectionValue);
      if (collection.length === 0) return null;
      const baseType =
        expressionBaseType(expression.value, context.document) ??
        expressionBaseType(expression.collection, context.document);
      const filtered = collection.filter((item) => !valuesEqual(item, value, false, baseType));
      return filtered.length > 0 ? filtered : null;
    }
    case "contains": {
      const collectionValue = context.evaluate(expression.collection);
      const valuesValue = context.evaluate(expression.values);
      if (collectionValue === null || valuesValue === null) return null;
      const collection = valueContainer(collectionValue);
      const values = valueContainer(valuesValue);
      if (collection.length === 0 || values.length === 0) return null;
      const baseType =
        expressionBaseType(expression.collection, context.document) ??
        expressionBaseType(expression.values, context.document);
      return containsValues(collection, values, baseType);
    }
    default:
      return assertNever(expression);
  }
}
