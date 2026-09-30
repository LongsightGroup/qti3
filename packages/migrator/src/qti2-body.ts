import { migratedQti2ContentName } from "./qti-namespaces.js";
import { escapeXmlAttribute } from "@longsightgroup/qti3-core";
import { qti3TrustedXmlFragment } from "@longsightgroup/qti3-writer";
import { normalizeIdentifier } from "./text.js";
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

export function interactionPresentation(
  interaction: XmlElement,
  body: XmlElement,
  mode: "separate" | "prompt-only" = "separate",
): {
  readonly bodyHtml?: ReturnType<typeof qti3TrustedXmlFragment> | undefined;
  readonly itemBodyHtml?: ReturnType<typeof qti3TrustedXmlFragment> | undefined;
  readonly promptHtml?: ReturnType<typeof qti3TrustedXmlFragment> | undefined;
} {
  const promptHtml = prompt(interaction);
  if (mode === "prompt-only") return { promptHtml };
  return {
    itemBodyHtml: interactionBodyTemplate(body, interaction),
    promptHtml,
  };
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
      `<qti-inline-choice-interaction response-identifier="${escapeXmlAttribute(responseIdentifier)}"/>`,
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
    const attributes = [
      "base",
      "stringIdentifier",
      "expectedLength",
      "patternMask",
      "placeholderText",
    ].flatMap((name) => {
      const value = attr(interaction, name);
      if (value === null) return [];
      const qti3Name = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      return [`${qti3Name}="${escapeXmlAttribute(value)}"`];
    });
    replacements.set(
      interaction,
      `<qti-text-entry-interaction response-identifier="${escapeXmlAttribute(responseIdentifier)}"${attributes.length ? ` ${attributes.join(" ")}` : ""}/>`,
    );
  }
  return trusted(serializeChildrenReplacing(body, replacements));
}

export function bodyWithHottextPlaceholders(
  interaction: XmlElement,
  hottexts: readonly XmlElement[],
): ReturnType<typeof qti3TrustedXmlFragment> {
  const replacements = new Map<XmlElement, string>();
  const promptElement = findDescendantByLocalName(interaction, "prompt");
  if (promptElement) replacements.set(promptElement, "");
  for (const [index, hottext] of hottexts.entries()) {
    const identifier = normalizeIdentifier(attr(hottext, "identifier"), `H${index + 1}`);
    replacements.set(hottext, `<qti-hottext identifier="${escapeXmlAttribute(identifier)}"/>`);
  }
  return trusted(serializeChildrenReplacing(interaction, replacements) || "<p></p>");
}

export function bodyWithGapPlaceholders(
  interaction: XmlElement,
): ReturnType<typeof qti3TrustedXmlFragment> {
  const replacements = new Map<XmlElement, string>();
  const promptElement = findDescendantByLocalName(interaction, "prompt");
  if (promptElement) replacements.set(promptElement, "");
  for (const choice of findAllDescendantsByAnyLocalName(interaction, ["gaptext", "gapimg"])) {
    replacements.set(choice, "");
  }
  for (const gap of findAllDescendantsByLocalName(interaction, "gap")) {
    const identifier = normalizeIdentifier(attr(gap, "identifier"), "GAP");
    replacements.set(gap, `<qti-gap identifier="${escapeXmlAttribute(identifier)}"/>`);
  }
  return trusted(serializeChildrenReplacing(interaction, replacements) || "<p></p>");
}

export function trusted(html: string): ReturnType<typeof qti3TrustedXmlFragment> {
  return qti3TrustedXmlFragment(html.trim() || "<p></p>");
}

/** Translate QTI 2 audience controls in every body, prompt, and choice fragment. */
export function serializeQti2ContentChildren(element: XmlElement): string {
  return serializeChildrenReplacing(element, new Map());
}

function serializeChildrenReplacing(
  element: XmlElement,
  replacements: ReadonlyMap<XmlElement, string>,
): string {
  let out = "";
  for (let index = 0; index < element.childNodes.length; index += 1) {
    const child = element.childNodes.item(index);
    if (!child) continue;
    out += serializeReplacing(child, replacements);
  }
  return out;
}

function serializeReplacing(node: XmlNode, replacements: ReadonlyMap<XmlElement, string>): string {
  if (!isXmlElement(node)) return serializeNode(node);
  const element = node;
  const name = migratedQti2ContentName(element.namespaceURI, element.localName ?? element.nodeName);
  if (name === undefined) return serializeNode(element);
  const replacement = replacements.get(element);
  if (replacement !== undefined) return replacement;
  const children = serializeChildrenReplacing(element, replacements);
  if (name === "qti-rubric-block")
    return `<qti-rubric-block${attributesXml(element)} use="instructions"><qti-content-body>${children}</qti-content-body></qti-rubric-block>`;
  return `<${name}${attributesXml(element)}>${children}</${name}>`;
}

function attributesXml(element: XmlElement): string {
  const attrs: string[] = [];
  for (let index = 0; index < element.attributes.length; index += 1) {
    const attribute = element.attributes.item(index);
    if (!attribute) continue;
    if (attribute.name === "xmlns" || attribute.name.startsWith("xmlns:")) continue;
    attrs.push(`${attribute.name}="${escapeXmlAttribute(attribute.value)}"`);
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

/** Preserve the original interaction position and surrounding item content. */
export function interactionBodyTemplate(
  body: XmlElement,
  interaction: XmlElement,
): ReturnType<typeof qti3TrustedXmlFragment> {
  return trusted(
    serializeChildrenReplacing(body, new Map([[interaction, "<qti-interaction-placeholder/>"]])),
  );
}
