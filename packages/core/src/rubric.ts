import { QTI_ASI_NAMESPACE } from "./qti-namespaces.js";
import type { QtiContentNode, QtiDiagnostic } from "./types.js";

export const QTI_RUBRIC_VIEWS = [
  "author",
  "candidate",
  "proctor",
  "scorer",
  "testConstructor",
  "tutor",
] as const;
export const QTI_RUBRIC_USES = ["instructions", "scoring", "navigation"] as const;

/** QTI 3.0.1 §5.120 / §5.160. Resources require scope support, not item-level fallback. */
export function validateRubricContent(
  nodes: readonly QtiContentNode[],
  diagnostics: QtiDiagnostic[],
  testLevel = false,
  insideRubric = false,
): void {
  for (const node of nodes) {
    if (node.kind !== "element" && node.kind !== "feedback") continue;
    const qti = node.kind === "element" && node.namespaceUri === QTI_ASI_NAMESPACE;
    const rubric = qti && node.qtiName === "qti-rubric-block";
    const report = (code: string, message: string, severity: QtiDiagnostic["severity"] = "error") =>
      diagnostics.push({ code, message, severity, source: node.source, path: node.source?.path });
    if (rubric) {
      if (insideRubric) report("rubric.nested", "Rubric blocks must not be nested.");
      const views = node.attributes.view?.trim().split(/\s+/).filter(Boolean) ?? [];
      if (!views.length) report("rubric.view.required", "Rubric blocks require view.");
      else if (views.some((view) => !QTI_RUBRIC_VIEWS.some((allowed) => allowed === view)))
        report("rubric.view.invalid", "Rubric view contains an unknown audience.");
      const use = node.attributes.use?.trim();
      // ASI §5.120.1 requires item use; §5.160.2 leaves test use optional.
      if (use === undefined && !testLevel)
        report("rubric.use.required", "Item rubric blocks require use.");
      else if (use !== undefined && !QTI_RUBRIC_USES.some((allowed) => allowed === use)) {
        if (/^ext:\S+$/.test(use))
          report(
            "rubric.use.extension",
            `Rubric use ${use} has no built-in presentation policy.`,
            "warning",
          );
        else
          report(
            "rubric.use.invalid",
            "Rubric use must be instructions, scoring, navigation, or ext: followed by an extension name.",
          );
      }
      const elements = node.children.filter((child) => child.kind !== "text");
      const bodies = elements.filter(
        (child) =>
          child.kind === "element" &&
          child.namespaceUri === QTI_ASI_NAMESPACE &&
          child.qtiName === "qti-content-body",
      );
      if (bodies.length !== 1)
        report("rubric.content.required", "Rubric blocks require exactly one qti-content-body.");
      if (
        node.children.some((child) => child.kind === "text" && child.text.trim()) ||
        elements.some(
          (child) =>
            child.kind !== "element" ||
            child.namespaceUri !== QTI_ASI_NAMESPACE ||
            !["qti-stylesheet", "qti-content-body", "qti-catalog-info"].includes(child.qtiName),
        )
      )
        report("rubric.child.invalid", "Rubric content must be inside qti-content-body.");
    }
    if (insideRubric && qti && ["qti-stylesheet", "qti-catalog-info"].includes(node.qtiName))
      report(
        "rubric.resource.unsupported",
        "Rubric-scoped stylesheets and catalogs are not supported; item-level fallback would change their scope.",
      );
    if (
      insideRubric &&
      testLevel &&
      qti &&
      ["qti-template-block", "qti-template-inline"].includes(node.qtiName)
    )
      report("rubric.template.forbidden", "Test-level rubrics must not contain template content.");
    validateRubricContent(node.children, diagnostics, testLevel, insideRubric || rubric);
  }
}
