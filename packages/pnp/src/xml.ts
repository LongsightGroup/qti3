import { isDefined, isRecord, normalizeName, stringParam, stringProperty } from "./helpers.js";
import type {
  Qti3PnpDiagnostic,
  Qti3PnpElementLike,
  Qti3PnpParseResult,
  Qti3PnpXmlAdapter,
} from "./types.js";

export function parseQti3PnpXml(
  input: string | Qti3PnpElementLike | object,
  options: { xmlAdapter?: Qti3PnpXmlAdapter | undefined } = {},
): Qti3PnpParseResult {
  const diagnostics: Qti3PnpDiagnostic[] = [];
  const root =
    typeof input === "string" ? parseXmlString(input, options, diagnostics) : xmlLike(input);
  if (!root) {
    if (diagnostics.length === 0) {
      diagnostics.push({
        code: "PNP_XML_PARSE_ERROR",
        severity: "error",
        message: "PNP XML input could not be parsed.",
      });
    }
    return { ok: false, records: [], diagnostics };
  }

  const localName = normalizeName(root.name);
  if (localName === "access-for-all-pnp") {
    return {
      ok: diagnostics.length === 0,
      records: [{ elements: elementChildren(root) }],
      diagnostics,
    };
  }
  if (localName === "access-for-all-pnp-records") {
    const records = elementChildren(root)
      .filter((child) => normalizeName(child.name) === "access-for-all-pnp")
      .map((child) => ({
        identifier:
          stringParam(child.attributes ?? {}, "identifier") ??
          stringParam(child.attributes ?? {}, "id"),
        elements: elementChildren(child),
      }));
    return { ok: diagnostics.length === 0, records, diagnostics };
  }

  diagnostics.push({
    code: "PNP_UNKNOWN_ELEMENT",
    severity: "error",
    message: `Unsupported QTI 3 PNP root element ${localName}.`,
    source: { elementName: root.name },
  });
  return { ok: false, records: [], diagnostics };
}

export function elementChildren(element: Qti3PnpElementLike): Qti3PnpElementLike[] {
  return element.children ?? [];
}

function parseXmlString(
  xml: string,
  options: { xmlAdapter?: Qti3PnpXmlAdapter | undefined },
  diagnostics: Qti3PnpDiagnostic[],
): Qti3PnpElementLike | undefined {
  if (options.xmlAdapter) return xmlLike(options.xmlAdapter.parse(xml));
  const domParser = domParserConstructor();
  if (domParser) return xmlLike(new domParser().parseFromString(xml, "application/xml"));
  diagnostics.push({
    code: "PNP_XML_PARSE_ERROR",
    severity: "error",
    message: "XML string parsing requires globalThis.DOMParser or a caller-provided xmlAdapter.",
  });
  return undefined;
}

function domParserConstructor():
  | (new () => { parseFromString(xml: string, mimeType: string): unknown })
  | undefined {
  const value = (globalThis as { DOMParser?: unknown }).DOMParser;
  if (typeof value !== "function") return undefined;
  return value as new () => { parseFromString(xml: string, mimeType: string): unknown };
}

function xmlLike(input: unknown): Qti3PnpElementLike | undefined {
  if (!isRecord(input)) return undefined;
  const documentElement = input.documentElement;
  if (documentElement) return xmlLike(documentElement);
  const nodeType = input.nodeType;
  if (typeof nodeType === "number" && nodeType !== 1 && nodeType !== 9) return undefined;
  const localName = stringProperty(input, "localName");
  const prefix = stringProperty(input, "prefix");
  const name =
    prefix && localName
      ? `${prefix}:${localName}`
      : (localName ??
        stringProperty(input, "nodeName") ??
        stringProperty(input, "tagName") ??
        stringProperty(input, "name"));
  if (!name) return undefined;
  return {
    name,
    attributes: domAttributes(input),
    children: domChildren(input).map(xmlLike).filter(isDefined),
    text: stringProperty(input, "textContent") ?? stringProperty(input, "text") ?? "",
  };
}

function domAttributes(input: Record<string, unknown>): Record<string, string> {
  const attributes: Record<string, string> = {};
  const getAttributeNames = input.getAttributeNames;
  const getAttribute = input.getAttribute;
  if (typeof getAttributeNames === "function" && typeof getAttribute === "function") {
    for (const name of getAttributeNames.call(input) as unknown[]) {
      if (typeof name === "string") {
        const value = getAttribute.call(input, name);
        if (typeof value === "string") attributes[name] = value;
      }
    }
  }
  const plainAttributes = input.attributes;
  if (isRecord(plainAttributes)) {
    for (const [name, value] of Object.entries(plainAttributes)) {
      if (typeof value === "string") attributes[name] = value;
    }
  }
  return attributes;
}

function domChildren(input: Record<string, unknown>): unknown[] {
  const childNodes = input.childNodes;
  if (Array.isArray(childNodes)) return childNodes;
  if (isArrayLike(childNodes))
    return Array.from({ length: childNodes.length }, (_, index) => childNodes[index]);
  const children = input.children;
  if (Array.isArray(children)) return children;
  if (isArrayLike(children))
    return Array.from({ length: children.length }, (_, index) => children[index]);
  return [];
}

function isArrayLike(input: unknown): input is { length: number; [index: number]: unknown } {
  return isRecord(input) && typeof input.length === "number";
}
