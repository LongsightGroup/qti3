import { parseNumericOperatorAttribute, randomOperatorAttributes } from "./operator-attribute.js";
import type { QtiDiagnostic, QtiDocument, QtiProcessingExpression, QtiValue } from "./types.js";
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
import { isNullResponse } from "./processing-values.js";
import { isRecordValue } from "./value-guards.js";

export interface EvaluationContext {
  document: QtiDocument;
  responses: Record<string, QtiValue>;
  outcomes: Record<string, QtiValue>;
  templateValues: Record<string, QtiValue>;
  correctResponses: Record<string, QtiValue>;
  defaultValues: Record<string, QtiValue>;
  diagnostics: QtiDiagnostic[];
  builtInVariable(identifier: string): QtiValue | undefined;
  allowedUndeclaredResponseIdentifiers: ReadonlySet<string>;
  random: () => number;
  customOperators: QtiCustomOperatorRegistry;
  evaluate(expression: QtiProcessingExpression): QtiValue;
  indexValue(identifierOrInteger: string | undefined): number | undefined;
  numericAttribute(raw: string | undefined): number | undefined;
  numericOperands(
    expressions: QtiProcessingExpression[],
    cardinality?: "single" | "container" | "either",
    baseType?: "number" | "integer",
  ): number[] | null;
  undeclaredResponseValue(identifier: string): QtiValue | undefined;
}

export interface EvaluationOptions {
  builtInVariable?: ((identifier: string) => QtiValue | undefined) | undefined;
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
    defaultValues: {},
    diagnostics: [],
    builtInVariable:
      options.builtInVariable ??
      ((identifier) =>
        identifier === "completionStatus"
          ? (outcomes.completionStatus ?? "not_attempted")
          : undefined),
    allowedUndeclaredResponseIdentifiers,
    random,
    customOperators,
    evaluate(expression) {
      return evaluateProcessingExpression(expression, context);
    },
    indexValue(raw) {
      const value = context.numericAttribute(raw);
      return value !== undefined && Number.isInteger(value) ? value : undefined;
    },
    numericAttribute(raw) {
      const attribute = parseNumericOperatorAttribute(raw);
      if (attribute.type === "invalid") return undefined;
      const value =
        attribute.type === "literal"
          ? attribute.value
          : (outcomes[attribute.identifier] ?? templateValues[attribute.identifier]);
      return typeof value === "number" && Number.isFinite(value) ? value : undefined;
    },
    numericOperands(expressions, cardinality = "single", baseType = "number") {
      const numericValues: number[] = [];
      for (const expression of expressions) {
        const value = context.evaluate(expression);
        if (value === null) return null;
        const values = Array.isArray(value) ? value : [value];
        if (
          isRecordValue(value) ||
          (cardinality === "single" && Array.isArray(value)) ||
          (cardinality === "container" && !Array.isArray(value)) ||
          values.some(
            (item) =>
              typeof item !== "number" ||
              !Number.isFinite(item) ||
              (baseType === "integer" && !Number.isInteger(item)),
          )
        ) {
          context.diagnostics.push({
            code: "processing.operand.type",
            severity: "error",
            message: `Expected ${baseType} operands with ${cardinality} cardinality.`,
            source: expression.source,
          });
          return null;
        }
        for (const item of values) {
          if (typeof item === "number") numericValues.push(item);
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
  // QTI 3 §2.2.2: empty strings and containers are NULL, including intermediate results.
  const value = evaluateExpressionValue(expression, context);
  // The public value/state contract supports finite numbers only. Diagnose overflow
  // before an intermediate result reaches another operator or persisted state.
  if (typeof value === "number" && !Number.isFinite(value)) {
    context.diagnostics.push({
      code: "processing.numeric.nonFinite",
      severity: "error",
      message: `${expression.type} produced a non-finite numeric result; this engine cannot represent it.`,
      source: expression.source,
    });
    return null;
  }
  return isNullResponse(value) ? null : value;
}

function evaluateExpressionValue(
  expression: QtiProcessingExpression,
  context: EvaluationContext,
): QtiValue {
  switch (expression.type) {
    case "baseValue":
      return expression.value;
    case "null":
      return null;
    case "randomInteger": {
      const attributes = randomOperatorAttributes(expression);
      const min = context.indexValue(attributes.min);
      const max = context.indexValue(attributes.max);
      const step = context.indexValue(attributes.step);
      if (min === undefined || max === undefined || step === undefined || step <= 0 || max < min)
        return null;
      const count = Math.floor((max - min) / step) + 1;
      return min + Math.floor(context.random() * count) * step;
    }
    case "randomFloat": {
      const attributes = randomOperatorAttributes(expression);
      const min = context.numericAttribute(attributes.min);
      const max = context.numericAttribute(attributes.max);
      return min === undefined || max === undefined || max < min
        ? null
        : min + context.random() * (max - min);
    }
    case "random": {
      const values = context.evaluate(expression.expression);
      if (!Array.isArray(values) || values.length === 0) return null;
      return values[Math.floor(context.random() * values.length)] ?? null;
    }
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
