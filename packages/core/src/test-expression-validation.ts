import { assertNever } from "./assert-never.js";
import {
  isTestBaseType,
  testExpressionSyntax,
  type QtiTestBaseType,
  type QtiTestExpression,
} from "./test-expression.js";
import type { QtiDiagnostic, QtiOutcomeDeclaration, QtiValue } from "./types.js";

/** The declared QTI type of an expression, including its cardinality. */
export interface TestExpressionType {
  readonly baseType: QtiTestBaseType;
  readonly cardinality: "single" | "multiple";
}

/** Check scalar literals and defaults against the supported base types. */
export function isTestScalarValue(baseType: string | undefined, value: QtiValue): boolean {
  if (baseType === undefined) return false;
  switch (baseType) {
    case "integer":
      return typeof value === "number" && Number.isSafeInteger(value);
    case "float":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "string":
    case "identifier":
      return typeof value === "string";
    default:
      return false;
  }
}

/** Infer a test expression's QTI type and diagnose invalid operands and scope. */
export function checkTestExpression(
  expression: QtiTestExpression,
  declarations: ReadonlyMap<string, QtiOutcomeDeclaration>,
  categories: ReadonlySet<string>,
  scope: "outcome" | "branch",
  diagnostics: QtiDiagnostic[],
): TestExpressionType | undefined {
  const reject = (code: string, message: string) => {
    diagnostics.push({
      code: `test.${code}`,
      severity: "error",
      message,
      source: expression.source,
    });
  };
  const check = (child: QtiTestExpression) =>
    checkTestExpression(child, declarations, categories, scope, diagnostics);
  if (!testExpressionSyntax.some((syntax) => syntax.type === expression.type)) {
    reject("expression.unsupported", "Expression is outside the supported test execution profile.");
    return undefined;
  }
  switch (expression.type) {
    case "baseValue":
      if (!isTestScalarValue(expression.baseType, expression.value)) {
        reject("expression.value", "Expression values must match a supported scalar base type.");
        return undefined;
      }
      return { baseType: expression.baseType, cardinality: "single" };
    case "variable": {
      const declaration = declarations.get(expression.identifier);
      if (!declaration || !isTestBaseType(declaration.baseType)) {
        reject(
          "expression.variable",
          "Test expression references an undeclared or unsupported outcome.",
        );
        return undefined;
      }
      return { baseType: declaration.baseType, cardinality: "single" };
    }
    case "testVariables":
      if (scope === "branch")
        reject(
          "branch.scope",
          "Test-variable aggregation belongs in outcome processing, not a branch rule.",
        );
      if (
        expression.variableIdentifier !== "SCORE" ||
        (expression.includeCategory !== undefined && !categories.has(expression.includeCategory))
      )
        reject(
          "expression.testVariables",
          "This test profile aggregates item SCORE values from declared categories.",
        );
      return { baseType: "float", cardinality: "multiple" };
    case "sum": {
      const operands = expression.expressions.map(check);
      if (!operands.length || operands.some((type) => !isNumeric(type)))
        reject("expression.sum", "Test sums require numeric operands.");
      return {
        baseType: operands.every((type) => type?.baseType === "integer") ? "integer" : "float",
        cardinality: "single",
      };
    }
    case "numericCompare": {
      const left = check(expression.left);
      const right = check(expression.right);
      if (
        !testExpressionSyntax.some(
          (syntax) => syntax.type === "numericCompare" && syntax.operator === expression.operator,
        )
      )
        reject("expression.compare", "Unsupported test comparison operator.");
      if (
        !isNumeric(left) ||
        left?.cardinality !== "single" ||
        !isNumeric(right) ||
        right?.cardinality !== "single"
      )
        reject("expression.compare", "Test comparisons require two scalar numbers.");
      return { baseType: "boolean", cardinality: "single" };
    }
    case "and":
    case "or": {
      const operands = expression.expressions.map(check);
      if (!operands.length || operands.some((type) => !isBoolean(type)))
        reject("expression.boolean", "Test logic requires boolean operands.");
      return { baseType: "boolean", cardinality: "single" };
    }
    case "not":
      if (!isBoolean(check(expression.expression)))
        reject("expression.boolean", "Test logic requires a boolean operand.");
      return { baseType: "boolean", cardinality: "single" };
    default:
      return assertNever(expression);
  }
}

function isNumeric(type: TestExpressionType | undefined): boolean {
  return type?.baseType === "integer" || type?.baseType === "float";
}

/** Whether a branch expression has the required single boolean type. */
export function isBoolean(type: TestExpressionType | undefined): boolean {
  return type?.baseType === "boolean" && type.cardinality === "single";
}
