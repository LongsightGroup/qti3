import { parseQtiPackageXmlTree, type QtiPackageXmlNode } from "@longsightgroup/qti3-core";
import type { Qti3TrustedXmlFragment, Qti3WriterDiagnostic } from "./types.js";

// Ignore examples inside comments/CDATA when locating the actual insertion point.
const tokens = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<qti-interaction-placeholder\s*\/>/g;
const isSlot = (token: string) => token.startsWith("<qti-interaction-placeholder");

/** Item-level placement keeps surrounding content separate from interaction-owned content. */
export function validateItemBodyTemplate(
  template: Qti3TrustedXmlFragment | undefined,
): Qti3WriterDiagnostic[] {
  if (template === undefined) return [];
  const parsed = parseQtiPackageXmlTree(`<wrapper>${template}</wrapper>`);
  const slots: QtiPackageXmlNode[] = [];
  const visit = (node: QtiPackageXmlNode): void => {
    if (node.localName === "qti-interaction-placeholder") slots.push(node);
    node.children.forEach(visit);
  };
  if (parsed.root) visit(parsed.root);
  const [slot] = slots;
  if (
    !parsed.errors.length &&
    slots.length === 1 &&
    slot &&
    !slot.children.length &&
    !slot.text.trim() &&
    !Object.keys(slot.attributes).length &&
    [...template.matchAll(tokens)].filter(([token]) => isSlot(token)).length === 1
  )
    return [];
  return [
    {
      code: "invalid_item_body_template",
      path: "itemBodyHtml",
      message:
        "Item body must be well-formed XML with exactly one empty, unprefixed qti-interaction-placeholder.",
    },
  ];
}

export function placeRenderedBody(
  body: string,
  template: Qti3TrustedXmlFragment | undefined,
): string {
  return template === undefined
    ? body
    : template.replace(tokens, (token) => (isSlot(token) ? body : token));
}
