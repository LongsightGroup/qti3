import type { QtiChoice, QtiContentNode } from "@longsightgroup/qti3-core";

import type { Qti2MappedInteraction } from "./qti2-mapped-interaction.js";
import type { Qti2Revision } from "./qti2-processing-dialect.js";
import { attributes, semanticAttributes } from "./qti2-wire.js";
import type { QtiTranscodeDiagnostic } from "./types.js";
import { escapeXmlAttribute, escapeXmlText } from "./xml.js";

interface ContentFragment {
  readonly xml: string;
  readonly blockFallback: boolean;
}

// These QTI 2 containers accept inline content only; essay fallbacks must become siblings.
const inlineContentContainers = new Set([
  "p",
  "pre",
  "address",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "a",
  "abbr",
  "acronym",
  "b",
  "bdo",
  "big",
  "cite",
  "code",
  "dfn",
  "em",
  "i",
  "kbd",
  "q",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "tt",
  "var",
]);

/** Serialize content, lifting introduced block interactions out of inline ancestors. */
export function serializeQti2Content(
  nodes: readonly QtiContentNode[],
  mappings: readonly Qti2MappedInteraction[],
  revision: Qti2Revision,
  diagnostics: QtiTranscodeDiagnostic[],
): string {
  return contentFragments(nodes, mappings, revision, diagnostics)
    .map((fragment) => fragment.xml)
    .join("");
}

function contentFragments(
  nodes: readonly QtiContentNode[],
  mappings: readonly Qti2MappedInteraction[],
  revision: Qti2Revision,
  diagnostics: QtiTranscodeDiagnostic[],
): ContentFragment[] {
  return nodes.flatMap((node): ContentFragment[] => {
    const inline = (xml: string): ContentFragment[] => [{ xml, blockFallback: false }];
    switch (node.kind) {
      case "text":
        return inline(escapeXmlText(node.text));
      case "interaction": {
        const mapping = mappings[node.interactionIndex];
        return [
          { xml: mapping?.xml ?? "", blockFallback: mapping?.kind === "extended-text-fallback" },
        ];
      }
      case "printedVariable":
        return inline(
          `<printedVariable identifier="${escapeXmlAttribute(node.identifier)}"${attributes({ format: node.format })}></printedVariable>`,
        );
      case "feedback": {
        const name = node.feedbackType === "block" ? "feedbackBlock" : "feedbackInline";
        return inline(
          `<${name} identifier="${escapeXmlAttribute(node.identifier)}" outcomeIdentifier="${escapeXmlAttribute(node.outcomeIdentifier)}" showHide="${node.showHide}">${serializeQti2Content(node.children, mappings, revision, diagnostics)}</${name}>`,
        );
      }
      case "element": {
        const name = contentElementName(node.qtiName);
        if (name === "positionObjectStage") {
          const substitution = substituteStagedPositionObjectXml(node, mappings);
          if (substitution !== undefined) return inline(substitution);
          return inline(
            `<${name}${semanticAttributes(node.attributes, revision, diagnostics, `/itemBody/${name}`)}>${serializePositionObjectStageChildren(node, mappings, revision, diagnostics)}</${name}>`,
          );
        }
        const children = contentFragments(node.children, mappings, revision, diagnostics);
        const hasBlock = children.some((child) => child.blockFallback);
        if (hasBlock && inlineContentContainers.has(name)) {
          return splitInlineContainer(name, node.attributes, children, revision, diagnostics);
        }
        return inline(
          `<${name}${semanticAttributes(node.attributes, revision, diagnostics, `/itemBody/${name}`)}>${children.map((child) => child.xml).join("")}</${name}>`,
        );
      }
    }
    throw new Error(`Unreachable QTI content node: ${JSON.stringify(node)}`);
  });
}

function splitInlineContainer(
  name: string,
  authoredAttributes: Readonly<Record<string, string>>,
  children: readonly ContentFragment[],
  revision: Qti2Revision,
  diagnostics: QtiTranscodeDiagnostic[],
): ContentFragment[] {
  const result: ContentFragment[] = [];
  let pending: string[] = [];
  let wrapped = false;
  const firstAttributes = semanticAttributes(
    authoredAttributes,
    revision,
    diagnostics,
    `/itemBody/${name}`,
  );
  const continuationAttributes = semanticAttributes(
    authoredAttributes,
    revision,
    [],
    `/itemBody/${name}`,
    new Set(["id"]),
  );
  const flush = () => {
    // Preserve an authored anchor even when the first child is the lifted interaction.
    if (pending.length === 0 && (wrapped || !authoredAttributes.id)) return;
    result.push({
      xml: `<${name}${wrapped ? continuationAttributes : firstAttributes}>${pending.join("")}</${name}>`,
      blockFallback: false,
    });
    wrapped = true;
    pending = [];
  };
  for (const child of children) {
    if (child.blockFallback) {
      flush();
      result.push(child);
    } else {
      pending.push(child.xml);
    }
  }
  flush();
  return result;
}

export function serializeQti2Choice(
  choice: QtiChoice,
  element: string,
  revision: Qti2Revision,
  diagnostics: QtiTranscodeDiagnostic[],
  path: string,
): string {
  const content =
    choice.content && choice.content.length > 0
      ? serializeQti2Content(choice.content, [], revision, [])
      : escapeXmlText(choice.text);
  return `<${element} identifier="${escapeXmlAttribute(choice.identifier)}"${semanticAttributes(
    choice.attributes,
    revision,
    diagnostics,
    path,
    new Set(["identifier"]),
  )}>${content}</${element}>`;
}

function substituteStagedPositionObjectXml(
  node: QtiContentNode & { readonly kind: "element" },
  mappings: readonly Qti2MappedInteraction[],
): string | undefined {
  const interactionChildren = node.children.filter((child) => child.kind === "interaction");
  if (interactionChildren.length === 0) return undefined;
  const substitutionXml: string[] = [];
  for (const child of interactionChildren) {
    const mapping = mappings[child.interactionIndex];
    if (mapping?.kind !== "extended-text-fallback") return undefined;
    substitutionXml.push(mapping.xml);
  }
  return substitutionXml.join("");
}

function serializePositionObjectStageChildren(
  node: QtiContentNode & { readonly kind: "element" },
  mappings: readonly Qti2MappedInteraction[],
  revision: Qti2Revision,
  diagnostics: QtiTranscodeDiagnostic[],
): string {
  const background = node.children.flatMap((child) => {
    const mapping = child.kind === "interaction" ? mappings[child.interactionIndex] : undefined;
    return mapping?.kind === "native" && mapping.stageObjectXml ? [mapping.stageObjectXml] : [];
  })[0];
  return node.children
    .map((child) =>
      background && child.kind === "element" && ["img", "picture"].includes(child.qtiName)
        ? background
        : serializeQti2Content([child], mappings, revision, diagnostics),
    )
    .join("");
}

function contentElementName(name: string): string {
  if (name === "qti-content-body") return "div";
  const qti = name.startsWith("qti-") ? name.slice(4) : name;
  return qti.replace(/-([a-z])/g, (_match, character: string) => character.toUpperCase());
}
