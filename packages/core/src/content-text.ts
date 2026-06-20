import type { QtiChoice, QtiContentNode, QtiSourceLocation } from "./types.js";
import { assertNever } from "./assert-never.js";

export interface FlatTextFromContentOptions {
  excludeAnnotations?: boolean;
}

export function normalizeFlatText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Append parsed character data to QTI content. The XML layer keeps text verbatim in
 * `XmlNode.content`; this helper drops block-layout indentation (whitespace-only segments
 * that contain a newline) when building `QtiContentNode` trees.
 */
export function appendContentTextNode(
  content: QtiContentNode[],
  text: string,
  source?: QtiSourceLocation,
): void {
  if (text.length === 0 || isIndentationWhitespace(text)) return;
  content.push({ kind: "text", text, source });
}

/** Block pretty-print noise such as `\n  ` between sibling block elements, not inline spaces. */
function isIndentationWhitespace(text: string): boolean {
  return text.trim().length === 0 && text.includes("\n");
}

export function flatTextFromContent(
  nodes: QtiContentNode[],
  options: FlatTextFromContentOptions = {},
): string {
  const excludeAnnotations = options.excludeAnnotations ?? false;
  return normalizeFlatText(
    nodes.map((node) => flatTextFromContentNode(node, excludeAnnotations)).join(" "),
  );
}

function flatTextFromContentNode(node: QtiContentNode, excludeAnnotations: boolean): string {
  switch (node.kind) {
    case "text":
      return node.text;
    case "element":
      if (
        excludeAnnotations &&
        (node.qtiName === "annotation" || node.qtiName === "annotation-xml")
      ) {
        return "";
      }
      if (node.qtiName === "math" && node.attributes.alttext) return node.attributes.alttext;
      if (node.qtiName === "img" && node.attributes.alt) return node.attributes.alt;
      if (node.qtiName === "object" && node.attributes["object-label"]) {
        return node.attributes["object-label"];
      }
      return node.children
        .map((child) => flatTextFromContentNode(child, excludeAnnotations))
        .join(" ");
    case "feedback":
      return node.children
        .map((child) => flatTextFromContentNode(child, excludeAnnotations))
        .join(" ");
    case "interaction":
    case "printedVariable":
      return "";
    default:
      return assertNever(node);
  }
}

export function choiceAccessibleLabel(
  choice: QtiChoice | undefined,
  fallbackIdentifier?: string,
): string {
  if (!choice) return fallbackIdentifier ?? "";
  const contentText = choice.content
    ? flatTextFromContent(choice.content, { excludeAnnotations: true })
    : "";
  return normalizeFlatText(
    contentText || choice.text || choice.identifier || fallbackIdentifier || "",
  );
}
