import type { QtiDocument, QtiProcessingExpression, QtiValue } from "./types.js";
import { assertNever } from "./assert-never.js";
import type { QtiCustomOperatorRegistry } from "./custom-operators.js";
import { evaluateBooleanExpression } from "./processing-evaluator-boolean.js";
import {
  evaluateCollectionExpression,
  evaluateRepeatExpression,
} from "./processing-evaluator-collection.js";
import { evaluateComparisonExpression } from "./processing-evaluator-comparison.js";
import { evaluateCustomOperatorExpression } from "./processing-evaluator-custom.js";
import { evaluateGeometryExpression } from "./processing-evaluator-geometry.js";
import { evaluateNumericExpression } from "./processing-evaluator-numeric.js";
import { evaluateStringExpression } from "./processing-evaluator-string.js";
import { evaluateVariableExpression } from "./processing-evaluator-variable.js";
import { isRecordValue, numericValueOrNull } from "./processing-values.js";

export interface EvaluationContext {
  document: QtiDocument;
  responses: Record<string, QtiValue>;
  outcomes: Record<string, QtiValue>;
  templateValues: Record<string, QtiValue>;
  correctResponses: Record<string, QtiValue>;
  allowedUndeclaredResponseIdentifiers: ReadonlySet<string>;
  random: () => number;
  customOperators: QtiCustomOperatorRegistry;
  evaluate(expression: QtiProcessingExpression): QtiValue;
  indexValue(identifierOrInteger: string): number | undefined;
  numericOperands(expressions: QtiProcessingExpression[]): number[] | null;
  undeclaredResponseValue(identifier: string): QtiValue | undefined;
}

export interface EvaluationOptions {
  allowedUndeclaredResponseIdentifiers?: ReadonlySet<string> | readonly string[] | undefined;
}

export function createEvaluationContext(
  document: QtiDocument,
  responses: Record<string, QtiValue>,
  outcomes: Record<string, QtiValue>,
  templateValues: Record<string, QtiValue>,
  correctResponses: Record<string, QtiValue>,
  random: () => number,
  customOperators: QtiCustomOperatorRegistry,
  options: EvaluationOptions = {},
): EvaluationContext {
  const allowedUndeclaredResponseIdentifiers =
    options.allowedUndeclaredResponseIdentifiers instanceof Set
      ? options.allowedUndeclaredResponseIdentifiers
      : new Set(options.allowedUndeclaredResponseIdentifiers ?? []);
  const context: EvaluationContext = {
    document,
    responses,
    outcomes,
    templateValues,
    correctResponses,
    allowedUndeclaredResponseIdentifiers,
    random,
    customOperators,
    evaluate(expression) {
      return evaluateProcessingExpression(expression, context);
    },
    indexValue(identifierOrInteger) {
      const parsed = Number(identifierOrInteger);
      if (Number.isInteger(parsed)) return parsed;
      const value = outcomes[identifierOrInteger] ?? templateValues[identifierOrInteger] ?? null;
      const numeric = numericValueOrNull(value);
      return numeric !== null && Number.isInteger(numeric) ? numeric : undefined;
    },
    numericOperands(expressions) {
      const numericValues: number[] = [];
      for (const expression of expressions) {
        const value = context.evaluate(expression);
        if (value === null || isRecordValue(value)) return null;
        const values = Array.isArray(value) ? value : [value];
        for (const item of values) {
          const numeric = numericValueOrNull(item);
          if (numeric === null) return null;
          numericValues.push(numeric);
        }
      }
      return numericValues;
    },
    undeclaredResponseValue(identifier) {
      return allowedUndeclaredResponseIdentifiers.has(identifier) && identifier in responses
        ? (responses[identifier] ?? null)
        : undefined;
    },
  };
  return context;
}

export function evaluateProcessingExpression(
  expression: QtiProcessingExpression,
  context: EvaluationContext,
): QtiValue {
  switch (expression.type) {
    case "baseValue":
      return expression.value;
    case "null":
      return null;
    case "randomInteger": {
      const step = expression.step > 0 ? expression.step : 1;
      const count = Math.floor((expression.max - expression.min) / step) + 1;
      return expression.min + Math.floor(context.random() * count) * step;
    }
    case "randomFloat":
      return expression.min + context.random() * (expression.max - expression.min);
    case "random":
      if (expression.values.length === 0) return null;
      return context.evaluate(
        expression.values[Math.floor(context.random() * expression.values.length)]!,
      );
    case "isNull":
    case "matchCorrect":
    case "mapResponse":
    case "mapResponsePoint":
    case "correct":
    case "default":
    case "variable":
      return evaluateVariableExpression(expression, context);
    case "multiple":
    case "ordered":
    case "index":
    case "containerSize":
      return evaluateCollectionExpression(expression, context);
    case "sum":
    case "product":
    case "min":
    case "max":
    case "subtract":
    case "divide":
    case "power":
    case "integerDivide":
    case "integerModulus":
    case "round":
    case "roundTo":
    case "truncate":
    case "integerToFloat":
    case "gcd":
    case "lcm":
    case "mathConstant":
    case "mathOperator":
    case "statsOperator":
      return evaluateNumericExpression(expression, context);
    case "and":
    case "anyN":
    case "or":
    case "not":
      return evaluateBooleanExpression(expression, context);
    case "match":
    case "equal":
    case "equalRounded":
    case "numericCompare":
    case "durationCompare":
    case "member":
    case "delete":
    case "contains":
      return evaluateComparisonExpression(expression, context);
    case "stringMatch":
    case "substring":
    case "patternMatch":
    case "fieldValue":
      return evaluateStringExpression(expression, context);
    case "inside":
      return evaluateGeometryExpression(expression, context);
    case "repeat":
      return evaluateRepeatExpression(expression, context);
    case "customOperator":
      return evaluateCustomOperatorExpression(expression, context);
    default:
      return assertNever(expression);
  }
}
