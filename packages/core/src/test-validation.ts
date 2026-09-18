import { assertNever } from "./assert-never.js";
import { expressionChildren } from "./processing-expression-children.js";
import type { QtiDiagnostic, QtiProcessingExpression } from "./types.js";
import type { QtiExecutableTest, QtiTestDefinition, QtiTestResult } from "./test-model.js";

type TestExpression = Extract<
  QtiProcessingExpression,
  {
    type:
      | "baseValue"
      | "variable"
      | "testVariables"
      | "sum"
      | "numericCompare"
      | "and"
      | "or"
      | "not";
  }
>;
function isTestExpression(expression: QtiProcessingExpression): expression is TestExpression {
  return [
    "baseValue",
    "variable",
    "testVariables",
    "sum",
    "numericCompare",
    "and",
    "or",
    "not",
  ].includes(expression.type);
}

/** Establish executable support for the finite, flat-section QTI test profile. */
export function validateQtiTest(test: QtiTestDefinition): QtiTestResult<QtiExecutableTest> {
  const diagnostics: QtiDiagnostic[] = [];
  const reject = (code: string, message: string) =>
    diagnostics.push({ code: `test.${code}`, severity: "error", message });
  const identifiers = new Set<string>();
  const identifier = (value: string) => {
    if (
      !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(value) ||
      ["EXIT_TEST", "__proto__", "constructor", "prototype"].includes(value) ||
      identifiers.has(value)
    ) {
      reject("identifier", "Test identifiers must be valid, unique and non-reserved.");
    }
    identifiers.add(value);
  };
  identifier(test.identifier);
  identifier(test.partIdentifier);
  if (!test.title.trim() || test.sections.length === 0)
    reject("structure", "A test requires a title and at least one section.");
  const declarations = new Map(test.outcomeDeclarations.map((d) => [d.identifier, d]));
  for (const declaration of test.outcomeDeclarations) {
    identifier(declaration.identifier);
    if (
      declaration.cardinality !== "single" ||
      declaration.lookupTable !== undefined ||
      !["integer", "float", "boolean", "string", "identifier"].includes(declaration.baseType ?? "")
    ) {
      reject(
        "declaration.unsupported",
        "Test outcomes require a supported single-cardinality base type without lookup tables.",
      );
    }
    const value = declaration.defaultValue;
    if (
      value !== null &&
      (typeof value === "object" ||
        ((declaration.baseType === "integer" || declaration.baseType === "float") &&
          (typeof value !== "number" || !Number.isFinite(value))) ||
        (declaration.baseType === "integer" &&
          typeof value === "number" &&
          !Number.isInteger(value)) ||
        (declaration.baseType === "boolean" && typeof value !== "boolean") ||
        ((declaration.baseType === "string" || declaration.baseType === "identifier") &&
          typeof value !== "string"))
    ) {
      reject("declaration.default", "Test outcome default does not match its declared type.");
    }
  }
  const categories = new Set(test.sections.flatMap((s) => s.items.flatMap((i) => i.categories)));
  const expressionType = (expression: QtiProcessingExpression): string => {
    if (!isTestExpression(expression)) {
      reject(
        "expression.unsupported",
        "Expression is outside the supported test execution profile.",
      );
      return "unknown";
    }
    switch (expression.type) {
      case "baseValue":
        if (
          !(
            (expression.baseType === "integer" &&
              typeof expression.value === "number" &&
              Number.isSafeInteger(expression.value)) ||
            (expression.baseType === "float" &&
              typeof expression.value === "number" &&
              Number.isFinite(expression.value)) ||
            (expression.baseType === "boolean" && typeof expression.value === "boolean") ||
            ((expression.baseType === "string" || expression.baseType === "identifier") &&
              typeof expression.value === "string")
          )
        )
          reject("expression.value", "Expression values must match a supported scalar base type.");
        return typeof expression.value;
      case "variable": {
        const declaration = declarations.get(expression.identifier);
        if (!declaration)
          reject("expression.variable", "Test expression references an undeclared outcome.");
        return declaration?.baseType === "integer" || declaration?.baseType === "float"
          ? "number"
          : (declaration?.baseType ?? "unknown");
      }
      case "testVariables":
        if (
          expression.variableIdentifier !== "SCORE" ||
          (expression.includeCategory !== undefined && !categories.has(expression.includeCategory))
        )
          reject(
            "expression.testVariables",
            "This test profile aggregates item SCORE values from declared categories.",
          );
        return "numbers";
      case "sum":
        if (
          expression.expressions.length === 0 ||
          expression.expressions.some((e) => !["number", "numbers"].includes(expressionType(e)))
        )
          reject("expression.sum", "Test sums require numeric operands.");
        return "number";
      case "numericCompare":
        if (
          expressionType(expression.left) !== "number" ||
          expressionType(expression.right) !== "number"
        )
          reject("expression.compare", "Test comparisons require two scalar numbers.");
        return "boolean";
      case "and":
      case "or":
        if (
          expression.expressions.length === 0 ||
          expression.expressions.some((e) => expressionType(e) !== "boolean")
        )
          reject("expression.boolean", "Test logic requires boolean operands.");
        return "boolean";
      case "not":
        if (expressionType(expression.expression) !== "boolean")
          reject("expression.boolean", "Test logic requires a boolean operand.");
        return "boolean";
      default:
        return assertNever(expression);
    }
  };
  const hrefs = new Set<string>();
  for (const [index, section] of test.sections.entries()) {
    identifier(section.identifier);
    if (!section.title.trim() || section.items.length === 0)
      reject("section.empty", "Sections require a title and at least one item.");
    for (const item of section.items) {
      identifier(item.identifier);
      if (
        !item.href ||
        hrefs.has(item.href) ||
        /^(?:[a-z]+:|\/)|(?:^|\/)\.\.(?:\/|$)/i.test(item.href)
      )
        reject("item.href", "Item references must have distinct package-local paths.");
      hrefs.add(item.href);
      if (item.categories.some((c) => !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(c)))
        reject("item.category", "Item categories must be QTI identifiers.");
    }
    for (const branch of section.branches) {
      const checkScope = (expression: QtiProcessingExpression): void => {
        if (expression.type === "testVariables")
          reject(
            "branch.scope",
            "Test-variable aggregation belongs in outcome processing, not a branch rule.",
          );
        for (const child of expressionChildren(expression)) checkScope(child);
      };
      checkScope(branch.expression);
      if (expressionType(branch.expression) !== "boolean")
        reject("branch.expression", "Branch expressions must produce a boolean.");
      if (
        branch.target !== "EXIT_TEST" &&
        test.sections.findIndex((s) => s.identifier === branch.target) <= index
      )
        reject("branch.target", "Branch targets must identify a later section or EXIT_TEST.");
    }
  }
  for (const rule of test.outcomeProcessing) {
    const target = declarations.get(rule.identifier);
    const actual = expressionType(rule.expression);
    const expected =
      target?.baseType === "integer" || target?.baseType === "float" ? "number" : target?.baseType;
    if (!target || expected !== actual)
      reject("outcome.type", "Outcome rules must assign the declared outcome type.");
  }
  if (diagnostics.length) return { ok: false, diagnostics };
  // SAFETY: All identifiers, expression types and forward edges were checked above.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: This is the sole constructor for the validated test brand.
  return { ok: true, value: test as QtiExecutableTest };
}
