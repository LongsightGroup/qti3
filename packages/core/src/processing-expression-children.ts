import type { QtiProcessingExpression } from "./types.js";
import { assertNever } from "./assert-never.js";

export function expressionChildren(expression: QtiProcessingExpression): QtiProcessingExpression[] {
  switch (expression.type) {
    case "random":
      return expression.values;
    case "multiple":
    case "ordered":
    case "sum":
    case "product":
    case "min":
    case "max":
    case "and":
    case "anyN":
    case "or":
    case "gcd":
    case "lcm":
    case "mathOperator":
    case "repeat":
    case "customOperator":
      return expression.expressions;
    case "subtract":
    case "divide":
    case "power":
    case "integerDivide":
    case "integerModulus":
    case "match":
    case "equal":
    case "equalRounded":
    case "numericCompare":
    case "durationCompare":
    case "stringMatch":
    case "substring":
      return [expression.left, expression.right];
    case "not":
    case "round":
    case "roundTo":
    case "truncate":
    case "integerToFloat":
    case "index":
    case "containerSize":
    case "patternMatch":
    case "fieldValue":
    case "inside":
      return [expression.expression];
    case "statsOperator":
      return expression.expressions ?? [expression.expression];
    case "member":
    case "delete":
      return [expression.value, expression.collection];
    case "contains":
      return [expression.collection, expression.values];
    case "baseValue":
    case "correct":
    case "default":
    case "isNull":
    case "mapResponse":
    case "mapResponsePoint":
    case "matchCorrect":
    case "mathConstant":
    case "null":
    case "randomFloat":
    case "randomInteger":
    case "variable":
      return [];
    default:
      return assertNever(expression);
  }
}
