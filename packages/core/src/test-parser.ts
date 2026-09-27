import { parseOutcomeDeclaration } from "./parser-declarations.js";
import { QTI_ASI_NAMESPACE } from "./qti-namespaces.js";
import { parseXmlTree, type XmlNode } from "./xml.js";
import { validateQtiTest } from "./test-validation.js";
import { parseTestExpressionChild } from "./test-expression-parser.js";
import { testExpressionSyntax } from "./test-expression.js";
import { checkTestXml, rejectTestXml } from "./test-xml.js";
import {
  testFailure,
  type QtiExecutableTest,
  type QtiTestBranch,
  type QtiTestOutcomeRule,
  type QtiTestResult,
  type QtiTestSection,
} from "./test-model.js";
import type { QtiDiagnostic, QtiOutcomeDeclaration } from "./types.js";

/** Whether a test requires the runtime for sequencing or outcome processing. */
export type QtiTestExecution =
  | { readonly kind: "fixed" }
  | { readonly kind: "sequenced"; readonly test: QtiExecutableTest };

/** Classify sequencing on the parsed tree and reject unsupported executable routes. */
export function parseQtiTestExecution(xml: string): QtiTestResult<QtiTestExecution> {
  const parsed = parseTestRoot(xml);
  if (!parsed.ok) return parsed;
  const deliveryDiagnostics: QtiDiagnostic[] = [];
  rejectUnsupportedTestDelivery(parsed.value, deliveryDiagnostics);
  if (deliveryDiagnostics.length) return { ok: false, diagnostics: deliveryDiagnostics };
  if (!requiresTestRuntime(parsed.value)) return { ok: true, value: { kind: "fixed" } };
  const result = parseTestDefinition(parsed.value);
  return result.ok ? { ok: true, value: { kind: "sequenced", test: result.value } } : result;
}

/** Parse the supported executable test profile; never silently ignore routing features. */
export function parseQtiTest(xml: string): QtiTestResult<QtiExecutableTest> {
  const parsed = parseTestRoot(xml);
  return parsed.ok ? parseTestDefinition(parsed.value) : parsed;
}

function parseTestRoot(xml: string): QtiTestResult<XmlNode> {
  const { root, errors } = parseXmlTree(xml);
  if (
    errors.length ||
    !root ||
    root.localName !== "qti-assessment-test" ||
    root.uri !== QTI_ASI_NAMESPACE
  )
    return testFailure("xml", "Expected a well-formed QTI 3 assessment test.");
  return { ok: true, value: root };
}

function requiresTestRuntime(node: XmlNode): boolean {
  return (
    (node.uri === QTI_ASI_NAMESPACE &&
      [
        "qti-outcome-processing",
        "qti-branch-rule",
        "qti-pre-condition",
        "qti-selection",
        "qti-ordering",
        "qti-adaptive-selection",
      ].includes(node.localName)) ||
    node.children.some(requiresTestRuntime)
  );
}

function parseTestDefinition(root: XmlNode): QtiTestResult<QtiExecutableTest> {
  const diagnostics: QtiDiagnostic[] = [];
  checkTestXml(
    root,
    ["qti-outcome-declaration", "qti-test-part", "qti-outcome-processing"],
    ["identifier", "title", "tool-name", "tool-version"],
    diagnostics,
  );
  const part = parseTestPart(root, diagnostics);
  if (!part.ok) return part;
  const declarations = root.children
    .filter((node) => node.localName === "qti-outcome-declaration")
    .map((node) => parseTestDeclaration(node, diagnostics));
  const sections = part.value.children
    .filter((node) => node.localName === "qti-assessment-section")
    .map((node) => parseTestSection(node, diagnostics));
  const rules = parseTestOutcomeProcessing(root, diagnostics);
  if (diagnostics.length) return { ok: false, diagnostics };
  return validateQtiTest({
    identifier: root.attributes.identifier ?? "",
    title: root.attributes.title ?? "",
    partIdentifier: part.value.attributes.identifier ?? "",
    sections,
    outcomeDeclarations: declarations,
    outcomeProcessing: rules,
  });
}

function parseTestPart(root: XmlNode, diagnostics: QtiDiagnostic[]): QtiTestResult<XmlNode> {
  const parts = root.children.filter((node) => node.localName === "qti-test-part");
  const part = parts[0];
  if (
    parts.length !== 1 ||
    !part ||
    part.attributes["navigation-mode"] !== "linear" ||
    part.attributes["submission-mode"] !== "individual"
  )
    return testFailure(
      "mode",
      "Executable tests require one linear part with individual submission.",
    );
  checkTestXml(
    part,
    ["qti-assessment-section"],
    ["identifier", "navigation-mode", "submission-mode"],
    diagnostics,
  );
  return { ok: true, value: part };
}

function parseTestDeclaration(node: XmlNode, diagnostics: QtiDiagnostic[]): QtiOutcomeDeclaration {
  if (node.attributes.cardinality !== "single" || node.children.length > 1)
    rejectTestXml(node, diagnostics);
  checkTestXml(
    node,
    ["qti-default-value"],
    ["identifier", "cardinality", "base-type"],
    diagnostics,
  );
  for (const value of node.children) {
    checkTestXml(value, ["qti-value"], [], diagnostics);
    if (value.children.length !== 1) rejectTestXml(value, diagnostics);
    for (const scalar of value.children) checkTestXml(scalar, [], [], diagnostics, true);
  }
  return parseOutcomeDeclaration(node, diagnostics);
}

function parseTestSection(section: XmlNode, diagnostics: QtiDiagnostic[]): QtiTestSection {
  checkTestXml(
    section,
    ["qti-assessment-item-ref", "qti-branch-rule"],
    ["identifier", "title", "visible", "keep-together"],
    diagnostics,
  );
  if (
    !["true", "1"].includes(section.attributes.visible ?? "") ||
    (section.attributes["keep-together"] !== undefined &&
      !["true", "1"].includes(section.attributes["keep-together"]))
  )
    rejectTestXml(section, diagnostics);
  const branches: QtiTestBranch[] = [];
  for (const branch of section.children.filter((node) => node.localName === "qti-branch-rule")) {
    checkTestXml(
      branch,
      testExpressionSyntax.map((syntax) => syntax.name),
      ["target"],
      diagnostics,
    );
    const expression = parseTestExpressionChild(branch, diagnostics);
    if (expression) branches.push({ target: branch.attributes.target ?? "", expression });
  }
  const items = section.children
    .filter((node) => node.localName === "qti-assessment-item-ref")
    .map((item) => {
      checkTestXml(item, [], ["identifier", "href", "category"], diagnostics);
      return {
        identifier: item.attributes.identifier ?? "",
        href: item.attributes.href ?? "",
        categories: (item.attributes.category ?? "")
          .split(/\s+/)
          .filter((category) => category.length > 0),
      };
    });
  return {
    identifier: section.attributes.identifier ?? "",
    title: section.attributes.title ?? "",
    branches,
    items,
  };
}

function parseTestOutcomeProcessing(
  root: XmlNode,
  diagnostics: QtiDiagnostic[],
): QtiTestOutcomeRule[] {
  const processing = root.children.filter((node) => node.localName === "qti-outcome-processing");
  if (processing.length > 1) rejectTestXml(root, diagnostics);
  const rules: QtiTestOutcomeRule[] = [];
  for (const node of processing) {
    checkTestXml(node, ["qti-set-outcome-value"], [], diagnostics);
    for (const rule of node.children) {
      checkTestXml(
        rule,
        testExpressionSyntax.map((syntax) => syntax.name),
        ["identifier"],
        diagnostics,
      );
      const expression = parseTestExpressionChild(rule, diagnostics);
      if (expression)
        rules.push({
          type: "setOutcomeValue",
          identifier: rule.attributes.identifier ?? "",
          expression,
        });
    }
  }
  return rules;
}

// These constructs are preserved by interchange tooling but have no test-delivery implementation.
const unsupportedTestDelivery = new Map(
  Object.entries({
    "qti-rubric-block": {
      code: "test.rubric.unsupported",
      message:
        "Test-level rubric delivery is not supported. Preserve this test for interchange; do not deliver it without its rubrics.",
    },
    "qti-test-feedback": {
      code: "test.feedback.unsupported",
      message:
        "Test feedback delivery is not supported. Preserve this test for interchange; do not deliver it without evaluating and presenting its feedback.",
    },
    "qti-time-limits": {
      code: "test.time-limits.unsupported",
      message:
        "Test time limits are not enforced by this execution profile. Preserve this test for interchange; do not deliver it without enforcing its time limits.",
    },
    "qti-item-session-control": {
      code: "test.session-control.unsupported",
      message:
        "Test-level item session controls are not applied by this execution profile. Preserve this test for interchange; do not deliver it without applying its inherited session controls.",
    },
  }),
);

/** Classification must not authorize delivery that omits authored test behavior. */
function rejectUnsupportedTestDelivery(node: XmlNode, diagnostics: QtiDiagnostic[]): void {
  const unsupported =
    node.uri === QTI_ASI_NAMESPACE ? unsupportedTestDelivery.get(node.localName) : undefined;
  if (unsupported)
    diagnostics.push({
      ...unsupported,
      severity: "error",
      source: node.source,
      path: node.source.path,
    });
  for (const child of node.children) rejectUnsupportedTestDelivery(child, diagnostics);
}
