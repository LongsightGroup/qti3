import { parseOutcomeDeclaration } from "./parser-declarations.js";
import { parseExpression } from "./parser-processing.js";
import { QTI_ASI_NAMESPACE } from "./qti-namespaces.js";
import { parseXmlTree, type XmlNode } from "./xml.js";
import { validateQtiTest } from "./test-validation.js";
import {
  testFailure,
  type QtiExecutableTest,
  type QtiTestBranch,
  type QtiTestResult,
} from "./test-model.js";
import type { QtiDiagnostic, QtiSetOutcomeValue } from "./types.js";

/** Whether a test requires runtime selection rather than ordinary fixed navigation. */
export type QtiTestExecution =
  | { readonly kind: "fixed" }
  | { readonly kind: "sequenced"; readonly test: QtiExecutableTest };

/** Classify sequencing at the XML boundary and reject unsupported executable routes. */
export function parseQtiTestExecution(xml: string): QtiTestResult<QtiTestExecution> {
  const parsed = parseXmlTree(xml);
  if (
    parsed.errors.length ||
    !parsed.root ||
    parsed.root.localName !== "qti-assessment-test" ||
    parsed.root.uri !== QTI_ASI_NAMESPACE
  )
    return testFailure("xml", "Expected a well-formed QTI 3 assessment test.");
  const requiresSequence = (node: XmlNode): boolean =>
    node.uri === QTI_ASI_NAMESPACE &&
    ([
      "qti-branch-rule",
      "qti-pre-condition",
      "qti-selection",
      "qti-ordering",
      "qti-adaptive-selection",
    ].includes(node.localName) ||
      node.children.some(requiresSequence));
  if (!requiresSequence(parsed.root)) return { ok: true, value: { kind: "fixed" } };
  const result = parseQtiTest(xml);
  return result.ok ? { ok: true, value: { kind: "sequenced", test: result.value } } : result;
}

/** Parse the supported executable test profile; never silently ignore routing features. */
export function parseQtiTest(xml: string): QtiTestResult<QtiExecutableTest> {
  const parsed = parseXmlTree(xml);
  const root = parsed.root;
  if (
    parsed.errors.length ||
    !root ||
    root.localName !== "qti-assessment-test" ||
    root.uri !== QTI_ASI_NAMESPACE
  )
    return testFailure("xml", "Expected a well-formed QTI 3 assessment test.");
  const diagnostics: QtiDiagnostic[] = [];
  const reject = (node: XmlNode) =>
    diagnostics.push({
      code: "test.xml.unsupported",
      severity: "error",
      message: `Unsupported test element or attributes: ${node.localName}.`,
      source: node.source,
    });
  const children = (node: XmlNode, names: readonly string[], attrs: readonly string[]) => {
    if (
      Object.keys(node.attributes).some(
        (name) =>
          !name.startsWith("xmlns") && !["xsi:schemaLocation", "xml:lang", ...attrs].includes(name),
      )
    )
      reject(node);
    for (const child of node.children)
      if (child.uri !== QTI_ASI_NAMESPACE || !names.includes(child.localName)) reject(child);
  };
  const expression = (node: XmlNode) => {
    const walk = (child: XmlNode) => {
      const attributes: Record<string, readonly string[]> = {
        "qti-base-value": ["base-type"],
        "qti-variable": ["identifier"],
        "qti-test-variables": ["variable-identifier", "include-category"],
        "qti-sum": [],
        "qti-gt": [],
        "qti-gte": [],
        "qti-lt": [],
        "qti-lte": [],
        "qti-and": [],
        "qti-or": [],
        "qti-not": [],
      };
      const allowed = attributes[child.localName];
      if (!allowed) reject(child);
      else children(child, Object.keys(attributes), allowed);
      const size = child.children.length;
      if (
        (["qti-base-value", "qti-variable", "qti-test-variables"].includes(child.localName) &&
          size !== 0) ||
        (["qti-gt", "qti-gte", "qti-lt", "qti-lte"].includes(child.localName) && size !== 2) ||
        (child.localName === "qti-not" && size !== 1)
      )
        reject(child);
      for (const nested of child.children) walk(nested);
    };
    if (node.children.length !== 1) {
      reject(node);
      return undefined;
    }
    const first = node.children[0];
    if (!first) return undefined;
    walk(first);
    return parseExpression(first);
  };
  children(
    root,
    ["qti-outcome-declaration", "qti-test-part", "qti-outcome-processing"],
    ["identifier", "title", "tool-name", "tool-version"],
  );
  const parts = root.children.filter((n) => n.localName === "qti-test-part");
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
  children(part, ["qti-assessment-section"], ["identifier", "navigation-mode", "submission-mode"]);
  const declarations = root.children
    .filter((n) => n.localName === "qti-outcome-declaration")
    .map((node) => {
      if (node.attributes.cardinality !== "single") reject(node);
      children(node, ["qti-default-value"], ["identifier", "cardinality", "base-type"]);
      if (node.children.length > 1) reject(node);
      for (const value of node.children) {
        children(value, ["qti-value"], []);
        if (value.children.length !== 1) reject(value);
        for (const scalar of value.children) children(scalar, [], []);
      }
      return parseOutcomeDeclaration(node, diagnostics);
    });
  const sections = part.children.map((section) => {
    children(
      section,
      ["qti-assessment-item-ref", "qti-branch-rule"],
      ["identifier", "title", "visible", "keep-together"],
    );
    if (
      !["true", "1"].includes(section.attributes.visible ?? "") ||
      (section.attributes["keep-together"] !== undefined &&
        !["true", "1"].includes(section.attributes["keep-together"]))
    )
      reject(section);
    const branches: QtiTestBranch[] = [];
    for (const branch of section.children.filter((n) => n.localName === "qti-branch-rule")) {
      if (Object.keys(branch.attributes).some((a) => a !== "target")) reject(branch);
      const condition = expression(branch);
      if (condition)
        branches.push({ target: branch.attributes.target ?? "", expression: condition });
    }
    return {
      identifier: section.attributes.identifier ?? "",
      title: section.attributes.title ?? "",
      branches,
      items: section.children
        .filter((n) => n.localName === "qti-assessment-item-ref")
        .map((item) => {
          children(item, [], ["identifier", "href", "category"]);
          return {
            identifier: item.attributes.identifier ?? "",
            href: item.attributes.href ?? "",
            categories: (item.attributes.category ?? "").split(/\s+/).filter((c) => c.length > 0),
          };
        }),
    };
  });
  const processing = root.children.filter((n) => n.localName === "qti-outcome-processing");
  if (processing.length > 1) reject(root);
  const rules: QtiSetOutcomeValue[] = [];
  for (const node of processing) {
    children(node, ["qti-set-outcome-value"], []);
    for (const rule of node.children) {
      if (Object.keys(rule.attributes).some((a) => a !== "identifier")) reject(rule);
      const value = expression(rule);
      if (value)
        rules.push({
          type: "setOutcomeValue",
          identifier: rule.attributes.identifier ?? "",
          expression: value,
        });
    }
  }
  if (diagnostics.length) return { ok: false, diagnostics };
  return validateQtiTest({
    identifier: root.attributes.identifier ?? "",
    title: root.attributes.title ?? "",
    partIdentifier: part.attributes.identifier ?? "",
    sections,
    outcomeDeclarations: declarations,
    outcomeProcessing: rules,
  });
}
