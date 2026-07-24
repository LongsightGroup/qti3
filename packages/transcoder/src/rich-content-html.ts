import type { QtiChoice, QtiContentNode, QtiInteraction } from "@longsightgroup/qti3-core";

import { escapeXml } from "./xml.js";

/** Project QTI body content into escaped HTML suitable for an XML text node. */
export function serializeRichContentBody(
  nodes: readonly QtiContentNode[],
  interactions: readonly QtiInteraction[],
): string {
  const body = serializeRichContent(nodes);
  const interactionPrompts = interactions
    .map((interaction) => interaction.prompt?.trim())
    .filter((prompt): prompt is string => Boolean(prompt))
    .filter((prompt) => !body.includes(prompt))
    .map((prompt) => `<p>${escapeXml(prompt)}</p>`)
    .join("");
  return escapeXml(`${body}${interactionPrompts}`);
}

/** Project a choice's rich content into escaped HTML suitable for an XML text node. */
export function serializeRichChoiceContent(choice: QtiChoice): string {
  if (!choice.content || choice.content.length === 0) {
    return escapeXml(accessibleChoiceLabel(choice) ?? choice.identifier);
  }
  return escapeXml(serializeRichContent(choice.content));
}

/** Return the best stable learner-facing label available for a choice. */
export function accessibleChoiceLabel(choice: QtiChoice): string | undefined {
  const explicit =
    choice.attributes["hotspot-label"] ??
    choice.attributes["aria-label"] ??
    choice.attributes.label;
  if (explicit?.trim()) return explicit.trim();
  const text = choice.text.trim();
  return text && text !== choice.identifier ? text : undefined;
}

function serializeRichContent(nodes: readonly QtiContentNode[]): string {
  return nodes
    .map((node) => {
      switch (node.kind) {
        case "text":
          return node.text;
        case "interaction":
          return "";
        case "printedVariable":
          return `<span data-qti-variable="${escapeXml(node.identifier)}">[${escapeXml(
            node.identifier,
          )}]</span>`;
        case "feedback":
          return serializeRichContent(node.children);
        case "element": {
          const name = htmlElementName(node.qtiName);
          const children = serializeRichContent(node.children);
          if (!name) return children;
          const attributes = Object.entries(node.attributes)
            .filter(([attribute]) => attribute !== "xmlns")
            .map(([attribute, value]) => ` ${attribute.replace(/^qti-/, "")}="${escapeXml(value)}"`)
            .join("");
          return `<${name}${attributes}>${children}</${name}>`;
        }
        default: {
          const unexpected: never = node;
          throw new Error(`Unsupported QTI content node: ${JSON.stringify(unexpected)}`);
        }
      }
    })
    .join("");
}

function htmlElementName(qtiName: string): string {
  if (qtiName === "qti-prompt") return "div";
  return qtiName.startsWith("qti-") ? "" : qtiName;
}
