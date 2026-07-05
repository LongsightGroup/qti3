import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

export type XmlDocument = Document;
export type XmlElement = Element;
export type XmlNode = Node;

const parser = new DOMParser();
const serializer = new XMLSerializer();

export function parseXml(xml: string, context: string): XmlDocument {
  const doc = parser.parseFromString(normalizeXml(xml), "text/xml");
  if (doc.documentElement.nodeName === "parsererror") {
    throw new Error(`Failed to parse XML (${context}).`);
  }
  return doc;
}

export function serializeNode(node: XmlNode): string {
  return serializer.serializeToString(node);
}

export function serializeChildren(element: XmlElement): string {
  let out = "";
  for (let index = 0; index < element.childNodes.length; index += 1) {
    const child = element.childNodes.item(index);
    out += serializeNode(child);
  }
  return out;
}

export function attr(element: XmlElement | null | undefined, key: string): string | null {
  if (!element) return null;
  const alternate = key.includes("-")
    ? key.replace(/-([a-z])/g, (_match, char: string) => char.toUpperCase())
    : key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
  const target = key.toLowerCase();
  for (let index = 0; index < element.attributes.length; index += 1) {
    const attribute = element.attributes.item(index);
    if (!attribute) continue;
    if (
      attribute.name === key ||
      attribute.name === alternate ||
      attribute.name.toLowerCase() === target
    ) {
      return attribute.value;
    }
  }
  return null;
}

export function localName(element: XmlElement | null | undefined): string {
  const raw = element?.localName ?? element?.nodeName ?? "";
  return (raw.includes(":") ? (raw.split(":").pop() ?? raw) : raw).toLowerCase();
}

export function childElements(node: XmlElement): XmlElement[] {
  const out: XmlElement[] = [];
  for (let index = 0; index < node.childNodes.length; index += 1) {
    const child = node.childNodes.item(index);
    if (isXmlElement(child)) out.push(child);
  }
  return out;
}

export function findDescendantByLocalName(
  root: XmlElement | null | undefined,
  tag: string,
): XmlElement | null {
  if (!root) return null;
  const target = tag.toLowerCase();
  for (const child of childElements(root)) {
    if (localName(child) === target) return child;
    const nested = findDescendantByLocalName(child, target);
    if (nested) return nested;
  }
  return null;
}

export function findAllDescendantsByLocalName(
  root: XmlElement | null | undefined,
  tag: string,
): XmlElement[] {
  return findAllDescendantsByAnyLocalName(root, [tag]);
}

export function findAllDescendantsByAnyLocalName(
  root: XmlElement | null | undefined,
  tags: readonly string[],
): XmlElement[] {
  if (!root) return [];
  const tagSet = new Set(tags.map((tag) => tag.toLowerCase()));
  const matches: XmlElement[] = [];
  const walk = (node: XmlElement): void => {
    for (const child of childElements(node)) {
      if (tagSet.has(localName(child))) matches.push(child);
      if (child.childNodes.length) walk(child);
    }
  };
  walk(root);
  return matches;
}

export function toNumber(value: string | null | undefined): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

export function textOf(element: XmlElement | null | undefined): string {
  return (element?.textContent ?? "").trim();
}

function isXmlElement(node: XmlNode | null): node is XmlElement {
  return node?.nodeType === 1;
}

function normalizeXml(xml: string): string {
  return xml.replace(/^\uFEFF/, "").trimStart();
}
