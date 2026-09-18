import { assertNever } from "./assert-never.js";
import type { QtiTestExpression } from "./test-expression.js";
import { isQtiIdentifier } from "./qti-identifier.js";
import { isQtiPackageItemHref } from "./qti-package-paths.js";
import { isTestBaseType } from "./test-expression.js";
import { checkTestExpression, isBoolean, isTestScalarValue } from "./test-expression-validation.js";
import type { QtiDiagnostic } from "./types.js";
import type { QtiExecutableTest, QtiTestDefinition, QtiTestResult } from "./test-model.js";

type Reject = (code: string, message: string) => void;

/** Establish executable support for the finite, flat-section QTI test profile. */
export function validateQtiTest(test: QtiTestDefinition): QtiTestResult<QtiExecutableTest> {
  const diagnostics: QtiDiagnostic[] = [];
  const reject: Reject = (code, message) => {
    diagnostics.push({ code: `test.${code}`, severity: "error", message });
  };
  validateStructure(test, reject);
  validateDeclarations(test, reject);
  validateExpressions(test, diagnostics, reject);
  validateGraph(test, reject);
  if (diagnostics.length) return { ok: false, diagnostics };
  // SAFETY: Validation establishes nonempty sections/items, scalar declarations, expression types
  // and forward edges. Clone so later mutation of the caller's definition cannot invalidate the brand.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: Sole constructor of the validated executable test brand.
  return { ok: true, value: copyExecutableDefinition(test) as QtiExecutableTest };
}

function validateStructure(test: QtiTestDefinition, reject: Reject): void {
  const identifiers = new Set<string>();
  const identifier = (value: string) => {
    if (
      !isQtiIdentifier(value) ||
      ["EXIT_TEST", "__proto__", "constructor", "prototype"].includes(value) ||
      identifiers.has(value)
    )
      reject("identifier", "Test identifiers must be valid, unique and non-reserved.");
    identifiers.add(value);
  };
  identifier(test.identifier);
  identifier(test.partIdentifier);
  for (const declaration of test.outcomeDeclarations) identifier(declaration.identifier);
  if (!test.title.trim() || !test.sections.length)
    reject("structure", "A test requires a title and at least one section.");
  const hrefs = new Set<string>();
  for (const section of test.sections) {
    identifier(section.identifier);
    if (!section.title.trim() || !section.items.length)
      reject("section.empty", "Sections require a title and at least one item.");
    for (const item of section.items) {
      identifier(item.identifier);
      if (!isQtiPackageItemHref(item.href) || hrefs.has(item.href))
        reject("item.href", "Item references must have distinct package-local paths.");
      hrefs.add(item.href);
      if (item.categories.some((category) => !isQtiIdentifier(category)))
        reject("item.category", "Item categories must be QTI identifiers.");
    }
  }
}

function validateDeclarations(test: QtiTestDefinition, reject: Reject): void {
  for (const declaration of test.outcomeDeclarations) {
    if (
      declaration.cardinality !== "single" ||
      declaration.lookupTable !== undefined ||
      !isTestBaseType(declaration.baseType)
    )
      reject(
        "declaration.unsupported",
        "Test outcomes require a supported single-cardinality base type without lookup tables.",
      );
    if (
      declaration.defaultValue !== null &&
      !isTestScalarValue(declaration.baseType, declaration.defaultValue)
    )
      reject("declaration.default", "Test outcome default does not match its declared type.");
  }
}

function validateExpressions(
  test: QtiTestDefinition,
  diagnostics: QtiDiagnostic[],
  reject: Reject,
): void {
  const declarations = new Map(
    test.outcomeDeclarations.map((declaration) => [declaration.identifier, declaration]),
  );
  const categories = new Set(
    test.sections.flatMap((section) => section.items.flatMap((item) => item.categories)),
  );
  for (const section of test.sections) {
    for (const branch of section.branches) {
      if (
        !isBoolean(
          checkTestExpression(branch.expression, declarations, categories, "branch", diagnostics),
        )
      )
        reject("branch.expression", "Branch expressions must produce a boolean.");
    }
  }
  for (const rule of test.outcomeProcessing) {
    const target = declarations.get(rule.identifier);
    const actual = checkTestExpression(
      rule.expression,
      declarations,
      categories,
      "outcome",
      diagnostics,
    );
    const compatible =
      actual &&
      target &&
      (actual.baseType === target.baseType ||
        (actual.baseType === "integer" && target.baseType === "float"));
    if (!compatible || actual.cardinality !== "single")
      reject("outcome.type", "Outcome rules must assign the declared outcome type.");
  }
}

function validateGraph(test: QtiTestDefinition, reject: Reject): void {
  const indices = new Map(test.sections.map((section, index) => [section.identifier, index]));
  for (const [index, section] of test.sections.entries()) {
    for (const branch of section.branches) {
      if (branch.target !== "EXIT_TEST" && (indices.get(branch.target) ?? -1) <= index)
        reject("branch.target", "Branch targets must identify a later section or EXIT_TEST.");
    }
  }
}

function copyExecutableDefinition(test: QtiTestDefinition): QtiTestDefinition {
  return Object.freeze({
    ...test,
    outcomeDeclarations: Object.freeze(
      test.outcomeDeclarations.map((declaration) =>
        Object.freeze({
          ...declaration,
          attributes: { ...declaration.attributes },
        }),
      ),
    ),
    outcomeProcessing: Object.freeze(
      test.outcomeProcessing.map((rule) =>
        Object.freeze({ ...rule, expression: copyExpression(rule.expression) }),
      ),
    ),
    sections: Object.freeze(
      test.sections.map((section) =>
        Object.freeze({
          ...section,
          items: Object.freeze(
            section.items.map((item) =>
              Object.freeze({ ...item, categories: Object.freeze([...item.categories]) }),
            ),
          ),
          branches: Object.freeze(
            section.branches.map((branch) =>
              Object.freeze({ ...branch, expression: copyExpression(branch.expression) }),
            ),
          ),
        }),
      ),
    ),
  });
}

function copyExpression(expression: QtiTestExpression): QtiTestExpression {
  switch (expression.type) {
    case "sum":
    case "and":
    case "or":
      return Object.freeze({
        ...expression,
        expressions: Object.freeze(expression.expressions.map(copyExpression)),
      });
    case "numericCompare":
      return Object.freeze({
        ...expression,
        left: copyExpression(expression.left),
        right: copyExpression(expression.right),
      });
    case "not":
      return Object.freeze({ ...expression, expression: copyExpression(expression.expression) });
    case "baseValue":
    case "variable":
    case "testVariables":
      return Object.freeze({ ...expression });
    default:
      return assertNever(expression);
  }
}
