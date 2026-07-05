import { qti3TrustedXmlFragment } from "@longsightgroup/qti3-writer";
import { escapeText, normalizeIdentifier } from "./text.js";
import {
  attr,
  childElements,
  findAllDescendantsByAnyLocalName,
  findAllDescendantsByLocalName,
  findDescendantByLocalName,
  isXmlElement,
  localName,
  serializeNode,
  type XmlElement,
  type XmlNode,
} from "./xml.js";

export function prompt(
  interaction: XmlElement,
): ReturnType<typeof qti3TrustedXmlFragment> | undefined {
  const promptElement = findDescendantByLocalName(interaction, "prompt");
  const html = promptElement ? serializeChildrenReplacing(promptElement, new Map()).trim() : "";
  return html ? trusted(html) : undefined;
}

export function bodyWithoutInteraction(
  body: XmlElement,
  interaction: XmlElement,
): ReturnType<typeof qti3TrustedXmlFragment> {
  return trusted(
    serializeChildrenReplacing(body, new Map([[interaction, ""]])).trim() || "<p></p>",
  );
}

export function bodyWithInlineChoicePlaceholders(
  body: XmlElement,
  interactions: readonly XmlElement[],
  responseIdentifierFor: (interaction: XmlElement, fallback?: string) => string,
): ReturnType<typeof qti3TrustedXmlFragment> {
  const replacements = new Map<XmlElement, string>();
  for (const [index, interaction] of interactions.entries()) {
    const responseIdentifier = responseIdentifierFor(interaction, `RESPONSE_${index + 1}`);
    replacements.set(
      interaction,
      `<qti-inline-choice-interaction response-identifier="${escapeText(responseIdentifier)}"/>`,
    );
  }
  return trusted(serializeChildrenReplacing(body, replacements));
}

export function bodyWithTextEntryPlaceholders(
  body: XmlElement,
  interactions: readonly XmlElement[],
  responseIdentifierFor: (interaction: XmlElement, fallback?: string) => string,
): ReturnType<typeof qti3TrustedXmlFragment> {
  const replacements = new Map<XmlElement, string>();
  for (const [index, interaction] of interactions.entries()) {
    const responseIdentifier = responseIdentifierFor(interaction, `RESPONSE_${index + 1}`);
    replacements.set(
      interaction,
      `<qti-text-entry-interaction response-identifier="${escapeText(responseIdentifier)}"/>`,
    );
  }
  return trusted(serializeChildrenReplacing(body, replacements));
}

export function bodyWithHottextPlaceholders(
  interaction: XmlElement,
  hottexts: readonly XmlElement[],
): ReturnType<typeof qti3TrustedXmlFragment> {
  const replacements = new Map<XmlElement, string>();
  for (const [index, hottext] of hottexts.entries()) {
    const identifier = normalizeIdentifier(attr(hottext, "identifier"), `H${index + 1}`);
    replacements.set(hottext, `<qti-hottext identifier="${escapeText(identifier)}"/>`);
  }
  return trusted(serializeChildrenReplacing(interaction, replacements) || "<p></p>");
}

export function bodyWithGapPlaceholders(
  interaction: XmlElement,
): ReturnType<typeof qti3TrustedXmlFragment> {
  const replacements = new Map<XmlElement, string>();
  for (const choice of findAllDescendantsByAnyLocalName(interaction, ["gaptext", "gapimg"])) {
    replacements.set(choice, "");
  }
  for (const gap of findAllDescendantsByLocalName(interaction, "gap")) {
    const identifier = normalizeIdentifier(attr(gap, "identifier"), "GAP");
    replacements.set(gap, `<qti-gap identifier="${escapeText(identifier)}"/>`);
  }
  return trusted(serializeChildrenReplacing(interaction, replacements) || "<p></p>");
}

export function trusted(html: string): ReturnType<typeof qti3TrustedXmlFragment> {
  return qti3TrustedXmlFragment(html.trim() || "<p></p>");
}

function serializeChildrenReplacing(
  element: XmlElement,
  replacements: ReadonlyMap<XmlElement, string>,
): string {
  let out = "";
  for (let index = 0; index < element.childNodes.length; index += 1) {
    out += serializeReplacing(element.childNodes.item(index), replacements);
  }
  return out;
}

function serializeReplacing(node: XmlNode, replacements: ReadonlyMap<XmlElement, string>): string {
  if (!isXmlElement(node)) return serializeNode(node);
  const element = node;
  const replacement = replacements.get(element);
  if (replacement !== undefined) return replacement;
  return `<${element.nodeName}${attributesXml(element)}>${serializeChildrenReplacing(
    element,
    replacements,
  )}</${element.nodeName}>`;
}

function attributesXml(element: XmlElement): string {
  const attrs: string[] = [];
  for (let index = 0; index < element.attributes.length; index += 1) {
    const attribute = element.attributes.item(index);
    if (!attribute) continue;
    if (attribute.name === "xmlns" || attribute.name.startsWith("xmlns:")) continue;
    attrs.push(`${attribute.name}="${escapeText(attribute.value)}"`);
  }
  return attrs.length ? ` ${attrs.join(" ")}` : "";
}

export function collectInteractionElements(root: XmlElement): XmlElement[] {
  const out: XmlElement[] = [];
  const walk = (element: XmlElement): void => {
    for (const child of childElements(element)) {
      if (localName(child).endsWith("interaction")) out.push(child);
      walk(child);
    }
  };
  walk(root);
  return out;
}
