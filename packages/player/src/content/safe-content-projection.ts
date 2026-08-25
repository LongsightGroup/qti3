import type { QtiContentNode } from "@longsightgroup/qti3-core";
import {
  contentElementName,
  sanitizeContentAttributes,
  unsafeContentElements,
} from "./content-dom.js";
import type { QtiPlayerResolveAsset } from "../player-types.js";

/** A sanitized content node tree safe for host delivery or inspection without DOM parsing. */
export type SafeProjectedContentNode =
  | { readonly kind: "text"; readonly text: string }
  | {
      readonly kind: "element";
      readonly name: string;
      readonly attributes: Readonly<Record<string, string>>;
      readonly children: readonly SafeProjectedContentNode[];
    };

/** Projects parsed content nodes into an allowlisted, asset-resolved tree. */
export function projectSafeContentNodes(
  nodes: readonly QtiContentNode[],
  resolveAsset?: QtiPlayerResolveAsset,
): SafeProjectedContentNode[] {
  const projected: SafeProjectedContentNode[] = [];
  for (const node of nodes) {
    if (node.kind === "text") {
      projected.push({ kind: "text", text: node.text });
      continue;
    }
    if (node.kind !== "element" || unsafeContentElements.has(node.qtiName)) continue;
    const children = projectSafeContentNodes(node.children, resolveAsset);
    const name = contentElementName(node.qtiName);
    if (!name) {
      projected.push(...children);
      continue;
    }
    projected.push({
      kind: "element",
      name,
      attributes: sanitizeContentAttributes(node.attributes, resolveAsset, name),
      children,
    });
  }
  return projected;
}
