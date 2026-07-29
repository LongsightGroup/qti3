import type { QtiChoice, QtiContentNode } from "@longsightgroup/qti3-core";

import type { Qti2MappedInteraction } from "./qti2-mapped-interaction.js";
import type { Qti2Revision } from "./qti2-processing-dialect.js";
import { attributes, semanticAttributes } from "./qti2-wire.js";
import type { QtiTranscodeDiagnostic } from "./types.js";
import { escapeXml } from "./xml.js";

export function serializeQti2Content(
  nodes: readonly QtiContentNode[],
  mappings: readonly Qti2MappedInteraction[],
  revision: Qti2Revision,
  diagnostics: QtiTranscodeDiagnostic[],
): string {
  return nodes
    .map((node) => {
      switch (node.kind) {
        case "text":
          return escapeXml(node.text);
        case "interaction":
          return mappings[node.interactionIndex]?.xml ?? "";
        case "printedVariable":
          return `<printedVariable identifier="${escapeXml(node.identifier)}"${attributes({
            format: node.format,
          })}></printedVariable>`;
        case "feedback":
          return `<feedback${node.feedbackType === "block" ? "Block" : "Inline"} identifier="${escapeXml(
            node.identifier,
          )}" outcomeIdentifier="${escapeXml(node.outcomeIdentifier)}" showHide="${node.showHide}">${serializeQti2Content(
            node.children,
            mappings,
            revision,
            diagnostics,
          )}</feedback${node.feedbackType === "block" ? "Block" : "Inline"}>`;
        case "element": {
          const name = contentElementName(node.qtiName);
          if (name === "positionObjectStage") {
            const stagedSubstitution = substituteStagedPositionObjectXml(node, mappings);
            if (stagedSubstitution !== undefined) return stagedSubstitution;
          }
          return `<${name}${semanticAttributes(
            node.attributes,
            revision,
            diagnostics,
            `/itemBody/${name}`,
          )}>${serializeQti2Content(node.children, mappings, revision, diagnostics)}</${name}>`;
        }
      }
      throw new Error(`Unreachable QTI content node: ${JSON.stringify(node)}`);
    })
    .join("");
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
      : escapeXml(choice.text);
  return `<${element} identifier="${escapeXml(choice.identifier)}"${semanticAttributes(
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

function contentElementName(name: string): string {
  const qti = name.startsWith("qti-") ? name.slice(4) : name;
  return qti.replace(/-([a-z])/g, (_match, character: string) => character.toUpperCase());
}
