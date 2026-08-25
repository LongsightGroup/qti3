import type { QtiChoice, QtiContentNode, QtiSourceLocation } from "./types.js";
import { assertNever } from "./assert-never.js";
import type { XmlNode } from "./xml.js";

export interface FlatTextFromContentOptions {
  excludeAnnotations?: boolean;
  interactionText?: ((interactionIndex: number) => string) | undefined;
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
  return normalizeFlatText(nodes.map((node) => flatTextFromContentNode(node, options)).join(""));
}

function flatTextFromContentNode(
  node: QtiContentNode,
  options: FlatTextFromContentOptions,
): string {
  const excludeAnnotations = options.excludeAnnotations ?? false;
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
      if (node.qtiName === "math") {
        return withVisibleBoundary(
          node.qtiName,
          node.children
            .map((child) => flatMathText(child, excludeAnnotations))
            .filter(Boolean)
            .join(" "),
        );
      }
      return withVisibleBoundary(
        node.qtiName,
        node.children.map((child) => flatTextFromContentNode(child, options)).join(""),
      );
    case "feedback":
      return withVisibleBoundary(
        node.feedbackType === "block" ? "qti-feedback-block" : "qti-feedback-inline",
        node.children.map((child) => flatTextFromContentNode(child, options)).join(""),
      );
    case "interaction":
      return options.interactionText?.(node.interactionIndex) ?? "";
    case "printedVariable":
      return "";
    default:
      return assertNever(node);
  }
}

function flatMathText(node: QtiContentNode, excludeAnnotations: boolean): string {
  if (
    node.kind === "element" &&
    excludeAnnotations &&
    (node.qtiName === "annotation" || node.qtiName === "annotation-xml")
  ) {
    return "";
  }
  if (node.kind === "text") return node.text;
  if (node.kind === "element" || node.kind === "feedback") {
    return node.children
      .map((child) => flatMathText(child, excludeAnnotations))
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

/** Flatten rendered XML text without inventing separators at inline element boundaries. */
export function visibleTextContent(node: XmlNode): string {
  return normalizeFlatText(visibleTextFromXmlNode(node));
}

function visibleTextFromXmlNode(node: XmlNode): string {
  const accessibleLabel = accessibleXmlLabel(node);
  const text =
    accessibleLabel ??
    (node.localName === "math"
      ? flatMathXmlText(node)
      : node.content
          .map((entry) => (typeof entry === "string" ? entry : visibleTextFromXmlNode(entry)))
          .join(""));
  return withVisibleBoundary(node.localName, text);
}

function flatMathXmlText(node: XmlNode): string {
  return node.content
    .map((entry) =>
      typeof entry === "string"
        ? entry
        : entry.localName === "annotation" || entry.localName === "annotation-xml"
          ? ""
          : flatMathXmlText(entry),
    )
    .filter(Boolean)
    .join(" ");
}

function accessibleXmlLabel(node: XmlNode): string | undefined {
  if (node.localName === "math" && node.attributes.alttext) return node.attributes.alttext;
  if (node.localName === "img" && node.attributes.alt) return node.attributes.alt;
  if (node.localName === "object" && node.attributes["object-label"]) {
    return node.attributes["object-label"];
  }
  return undefined;
}

function withVisibleBoundary(qtiName: string, text: string): string {
  return visibleBoundaryNames.has(qtiName) ? ` ${text} ` : text;
}

const visibleBoundaryNames = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "br",
  "dd",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hgroup",
  "hr",
  "li",
  "main",
  "math",
  "nav",
  "ol",
  "p",
  "pre",
  "qti-feedback-block",
  "qti-gap-img",
  "qti-gap-text",
  "qti-inline-choice",
  "qti-simple-associable-choice",
  "qti-simple-choice",
  "section",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul",
]);

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
