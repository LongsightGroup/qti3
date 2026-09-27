import type { QtiBaseType, QtiCardinality, QtiProcessingExpression } from "./types.js";
import { parseBaseType } from "./parser-values.js";
import { assertNever } from "./assert-never.js";

/** Known expression shape; a record or dynamically selected field can lack a base type. */
export interface ProcessingExpressionType {
  cardinality: QtiCardinality;
  baseType?: QtiBaseType | undefined;
}

/** Infer expression shape from the original declarations. NULL and custom results are unknown. */
export function inferProcessingExpressionType(
  expression: QtiProcessingExpression,
  resolve: (identifier: string) => ProcessingExpressionType | undefined,
): ProcessingExpressionType | undefined {
  const infer = (child: QtiProcessingExpression) => inferProcessingExpressionType(child, resolve);
  const single = (baseType: QtiBaseType | undefined): ProcessingExpressionType => ({
    cardinality: "single",
    baseType,
  });
  switch (expression.type) {
    case "null":
    case "customOperator":
      return undefined;
    case "baseValue":
      return single(parseBaseType(expression.baseType));
    case "variable":
    case "correct":
    case "default":
      return resolve(expression.identifier);
    case "multiple":
    case "ordered":
    case "repeat": {
      const types = expression.expressions.map(infer).filter((type) => type !== undefined);
      const first = types[0]?.baseType;
      return {
        cardinality: expression.type === "multiple" ? "multiple" : "ordered",
        baseType: types.every((type) => type.baseType === first) ? first : undefined,
      };
    }
    case "index":
    case "random":
      return single(infer(expression.expression)?.baseType);
    case "delete":
      return infer(expression.collection);
    case "fieldValue":
      return single(undefined);
    case "sum":
    case "product":
    case "min":
    case "max": {
      const types = expression.expressions.map(infer);
      return single(
        types.some((type) => type?.baseType === "float")
          ? "float"
          : types.every((type) => type?.baseType === "integer")
            ? "integer"
            : undefined,
      );
    }
    case "subtract": {
      const left = infer(expression.left)?.baseType;
      const right = infer(expression.right)?.baseType;
      return single(
        left === "float" || right === "float"
          ? "float"
          : left === "integer" && right === "integer"
            ? "integer"
            : undefined,
      );
    }
    case "randomInteger":
    case "containerSize":
    case "integerDivide":
    case "integerModulus":
    case "round":
    case "truncate":
    case "gcd":
    case "lcm":
      return single("integer");
    case "mathOperator":
      return single(["signum", "floor", "ceil"].includes(expression.name) ? "integer" : "float");
    case "mapResponse":
    case "mapResponsePoint":
    case "randomFloat":
    case "divide":
    case "power":
    case "roundTo":
    case "integerToFloat":
    case "mathConstant":
    case "statsOperator":
      return single("float");
    case "isNull":
    case "matchCorrect":
    case "match":
    case "and":
    case "anyN":
    case "or":
    case "not":
    case "equal":
    case "equalRounded":
    case "numericCompare":
    case "durationCompare":
    case "stringMatch":
    case "substring":
    case "patternMatch":
    case "member":
    case "contains":
    case "inside":
      return single("boolean");
    default:
      return assertNever(expression);
  }
}
