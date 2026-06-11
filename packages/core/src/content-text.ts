import type { QtiChoice, QtiContentNode } from "./types.js";

export interface FlatTextFromContentOptions {
  excludeAnnotations?: boolean;
}

export function normalizeFlatText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
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
