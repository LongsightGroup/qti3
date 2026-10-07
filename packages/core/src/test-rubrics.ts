import { parseContent } from "./parser-content.js";
import { validateRubricContent } from "./rubric.js";
import { QTI_ASI_NAMESPACE } from "./qti-namespaces.js";
import { parseXmlTree, type XmlNode } from "./xml.js";
import type { QtiContentNode, QtiDiagnostic } from "./types.js";
import type { QtiTestResult } from "./test-model.js";

/** An authored static rubric and its test, part, or section owner. */
export interface QtiTestRubricBlock {
  readonly scopeType: "assessment-test" | "test-part" | "assessment-section";
  readonly scopeIdentifier: string;
  readonly node: Extract<QtiContentNode, { kind: "element" }>;
}

/**
 * Parse static test rubrics using the canonical content parser and rubric validator.
 * This does not validate or enable test execution. Hosts retain each rubric's scope and
 * apply audience filtering at delivery. Dynamic content and scoped resources are rejected.
 */
export function parseQtiTestRubrics(xml: string): QtiTestResult<readonly QtiTestRubricBlock[]> {
  const { root, errors } = parseXmlTree(xml);
  if (
    errors.length ||
    !root ||
    root.uri !== QTI_ASI_NAMESPACE ||
    root.localName !== "qti-assessment-test"
  ) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "test.rubric.xml",
          severity: "error",
          message: "Expected a well-formed QTI 3 assessment test.",
        },
      ],
    };
  }
  const blocks: QtiTestRubricBlock[] = [];
  const diagnostics: QtiDiagnostic[] = [];
  visit(root);
  return diagnostics.some((entry) => entry.severity === "error")
    ? { ok: false, diagnostics }
    : { ok: true, value: blocks };

  function visit(owner: XmlNode): void {
    for (const child of owner.children) {
      if (child.uri === QTI_ASI_NAMESPACE && child.localName === "qti-rubric-block") {
        const scopeType = scopeOf(owner);
        if (!scopeType || !owner.attributes.identifier) {
          diagnostics.push({
            code: "test.rubric.scope",
            severity: "error",
            message: "A test rubric requires an identified test, part, or section owner.",
            path: child.source.path,
            source: child.source,
          });
          continue;
        }
        // Preserve parsed namespaces/provenance; isolate this child without fabricating an item.
        const content = parseContent({ ...owner, content: [child] }, () => undefined, diagnostics);
        validateRubricContent(content, diagnostics, true);
        rejectDynamicContent(content, diagnostics);
        const node = content[0];
        if (node?.kind === "element") {
          if (node.attributes.use?.startsWith("ext:")) {
            diagnostics.push({
              code: "test.rubric.use.unsupported",
              severity: "error",
              message: "Extension rubric uses require an explicit host presentation policy.",
              path: child.source.path,
              source: child.source,
            });
          }
          blocks.push({ scopeType, scopeIdentifier: owner.attributes.identifier, node });
        }
        continue;
      }
      visit(child);
    }
  }
}

function scopeOf(node: XmlNode): QtiTestRubricBlock["scopeType"] | undefined {
  if (node.uri !== QTI_ASI_NAMESPACE) return undefined;
  switch (node.localName) {
    case "qti-assessment-test":
      return "assessment-test";
    case "qti-test-part":
      return "test-part";
    case "qti-assessment-section":
      return "assessment-section";
    default:
      return undefined;
  }
}

function rejectDynamicContent(
  nodes: readonly QtiContentNode[],
  diagnostics: QtiDiagnostic[],
): void {
  for (const node of nodes) {
    if (node.kind === "printedVariable" || node.kind === "feedback") {
      diagnostics.push({
        code: "test.rubric.dynamic.unsupported",
        severity: "error",
        message: "Static test rubric delivery cannot evaluate variables or conditional feedback.",
        path: node.source?.path,
        source: node.source,
      });
    }
    if ("children" in node) rejectDynamicContent(node.children, diagnostics);
  }
}
