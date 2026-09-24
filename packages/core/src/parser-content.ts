import { appendContentTextNode, flatTextFromContent } from "./content-text.js";
import { QTI_ASI_NAMESPACE } from "./qti-namespaces.js";
import type { QtiContentNode, QtiDiagnostic } from "./types.js";
import { parseXmlTree, type XmlNode } from "./xml.js";

function isQtiElement(node: XmlNode, name: string): boolean {
  return node.uri === QTI_ASI_NAMESPACE && node.localName === name;
}

/** Parse modal content while excluding forbidden interactions from the returned tree. */
export function parseModalFeedbackContent(
  node: XmlNode,
  diagnostics: QtiDiagnostic[],
): QtiContentNode[] {
  return parseContent(node, (interaction) => {
    diagnostics.push({
      code: "feedback.interaction.forbidden",
      severity: "error",
      message: "qti-modal-feedback must not contain interactions.",
      path: interaction.source.path,
      source: interaction.source,
    });
    return undefined;
  });
}

/** Parse a trusted modal-feedback fragment without inventing an assessment item or declarations. */
export function parseQtiModalFeedbackFragment(xml: string): {
  content: QtiContentNode[];
  text: string;
  diagnostics: QtiDiagnostic[];
} {
  const tree = parseXmlTree(
    `<qti-content-body xmlns="${QTI_ASI_NAMESPACE}">${xml}</qti-content-body>`,
  );
  const diagnostics: QtiDiagnostic[] = tree.errors.map((error) => ({
    code: "xml.parse",
    severity: "error",
    message: error.message,
  }));
  if (diagnostics.length || !tree.root) return { content: [], text: "", diagnostics };
  const content = parseModalFeedbackContent(tree.root, diagnostics);
  return { content, text: flatTextFromContent(content), diagnostics };
}

export function parseContent(
  node: XmlNode,
  interaction: (node: XmlNode) => QtiContentNode | undefined,
): QtiContentNode[] {
  const content: QtiContentNode[] = [];
  for (const entry of node.content) {
    if (typeof entry === "string") {
      appendContentTextNode(content, entry, node.source);
      continue;
    }
    const parsed = parseContentNode(entry, interaction);
    if (parsed) content.push(parsed);
  }
  return content;
}

function parseContentNode(
  node: XmlNode,
  interaction: (node: XmlNode) => QtiContentNode | undefined,
): QtiContentNode | undefined {
  if (node.uri === QTI_ASI_NAMESPACE && /^qti-.+-interaction$/.test(node.localName))
    return interaction(node);

  if (isQtiElement(node, "qti-printed-variable")) {
    return {
      kind: "printedVariable",
      identifier: node.attributes.identifier ?? "",
      format: node.attributes.format,
      attributes: node.attributes,
      source: node.source,
    };
  }

  if (isQtiElement(node, "qti-feedback-block") || isQtiElement(node, "qti-feedback-inline")) {
    return {
      kind: "feedback",
      feedbackType: node.localName === "qti-feedback-block" ? "block" : "inline",
      identifier: node.attributes.identifier ?? "",
      outcomeIdentifier: node.attributes["outcome-identifier"] ?? "",
      showHide: node.attributes["show-hide"] === "hide" ? "hide" : "show",
      attributes: node.attributes,
      children: parseContent(node, interaction),
      source: node.source,
    };
  }

  return {
    kind: "element",
    qtiName: node.localName,
    namespaceUri: node.uri,
    attributes: node.attributes,
    children: parseContent(node, interaction),
    source: node.source,
  };
}
