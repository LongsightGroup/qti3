import type { QtiDiagnostic, QtiProcessingExpression, QtiValue } from "./types.js";
import type { ProcessingVariables } from "./processing-variables.js";
import type { ProcessingExpressionType } from "./processing-expression-type.js";
import { assertNever } from "./assert-never.js";
import { expressionChildren } from "./processing-expression-children.js";
import { isRecordValue } from "./value-guards.js";
import { qtiScalarMatchesBaseType } from "./validation-primitives.js";

/** Check assignment shape where it is statically known; NULL is assignable to every type. */
export function validateProcessingAssignment(
  identifier: string,
  expression: QtiProcessingExpression,
  variables: ProcessingVariables,
  diagnostics: QtiDiagnostic[],
): void {
  const target = variables.declarationType(identifier);
  const actual = variables.typeOf(expression);
  if (!target || !actual) return;
  if (
    target.cardinality === actual.cardinality &&
    (!target.baseType ||
      !actual.baseType ||
      target.baseType === actual.baseType ||
      (target.baseType === "float" && actual.baseType === "integer"))
  )
    return;
  diagnostics.push({
    code: "processing.assignment.type",
    severity: "error",
    message: `Expression type does not match variable ${identifier} (${target.cardinality} ${target.baseType ?? "record"}).`,
    source: expression.source,
    path: expression.source?.path,
  });
}

/** Reject statically known nonnumeric operands before coercion can change scoring. */
export function validateNumericOperands(
  expression: QtiProcessingExpression,
  variables: ProcessingVariables,
  diagnostics: QtiDiagnostic[],
): void {
  let containers = false;
  let integers = false;
  switch (expression.type) {
    case "sum":
    case "product":
    case "min":
    case "max":
      containers = true;
      break;
    case "gcd":
    case "lcm":
      containers = true;
      integers = true;
      break;
    case "integerDivide":
    case "integerModulus":
    case "integerToFloat":
      integers = true;
      break;
    case "subtract":
    case "divide":
    case "power":
    case "round":
    case "roundTo":
    case "truncate":
    case "equal":
    case "equalRounded":
    case "numericCompare":
    case "mathOperator":
      break;
    case "statsOperator":
      containers = true;
      break;
    case "and":
    case "anyN":
    case "baseValue":
    case "containerSize":
    case "contains":
    case "correct":
    case "customOperator":
    case "default":
    case "delete":
    case "durationCompare":
    case "fieldValue":
    case "index":
    case "inside":
    case "isNull":
    case "mapResponse":
    case "mapResponsePoint":
    case "match":
    case "matchCorrect":
    case "mathConstant":
    case "member":
    case "multiple":
    case "not":
    case "null":
    case "or":
    case "ordered":
    case "patternMatch":
    case "random":
    case "randomFloat":
    case "randomInteger":
    case "repeat":
    case "stringMatch":
    case "substring":
    case "variable":
      return;
    default:
      return assertNever(expression);
  }
  for (const operand of expressionChildren(expression)) {
    const type = variables.typeOf(operand);
    if (!type) continue;
    if (
      type.cardinality !== "record" &&
      (containers || type.cardinality === "single") &&
      (expression.type !== "statsOperator" || type.cardinality !== "single") &&
      (!type.baseType || type.baseType === "integer" || (!integers && type.baseType === "float"))
    )
      continue;
    diagnostics.push({
      code: "processing.operand.type",
      severity: "error",
      message: `${expression.type} requires ${integers ? "integer" : "numeric"} operands with compatible cardinality.`,
      source: operand.source,
      path: operand.source?.path,
    });
  }
}

/** Check dynamic results before they are written into a declared variable. */
export function processingValueMatchesType(
  value: QtiValue,
  type: ProcessingExpressionType,
): boolean {
  if (value === null) return true;
  if (type.cardinality === "record") return isRecordValue(value);
  if (isRecordValue(value)) return false;
  if (Array.isArray(value) !== (type.cardinality !== "single")) return false;
  if (!type.baseType) return true;
  const baseType = type.baseType;
  return (Array.isArray(value) ? value : [value]).every((entry) => {
    if (baseType === "float" || baseType === "integer") {
      return (
        typeof entry === "number" &&
        Number.isFinite(entry) &&
        (baseType === "float" || Number.isInteger(entry))
      );
    }
    if (baseType === "boolean") return typeof entry === "boolean";
    return qtiScalarMatchesBaseType(entry, baseType);
  });
}
