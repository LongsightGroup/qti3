import { QTI_ASI_NAMESPACE } from "./qti-namespaces.js";
import type { QtiDiagnostic } from "./types.js";
import type { XmlNode } from "./xml.js";

/** Report an unsupported construct at its XML source location. */
export function rejectTestXml(node: XmlNode, diagnostics: QtiDiagnostic[]): void {
  diagnostics.push({
    code: "test.xml.unsupported",
    severity: "error",
    message: `Unsupported test element or attributes: ${node.localName}.`,
    source: node.source,
  });
}

/** Check the closed test profile's namespace, attributes, children and element-only content. */
export function checkTestXml(
  node: XmlNode,
  names: readonly string[],
  attrs: readonly string[],
  diagnostics: QtiDiagnostic[],
  allowText = false,
): void {
  if (
    node.uri !== QTI_ASI_NAMESPACE ||
    Object.keys(node.attributes).some(
      (name) =>
        name !== "xmlns" &&
        !name.startsWith("xmlns:") &&
        !["xsi:schemaLocation", "xml:lang", ...attrs].includes(name),
    ) ||
    (!allowText && node.text.trim().length > 0)
  )
    rejectTestXml(node, diagnostics);
  for (const child of node.children)
    if (child.uri !== QTI_ASI_NAMESPACE || !names.includes(child.localName))
      rejectTestXml(child, diagnostics);
}
