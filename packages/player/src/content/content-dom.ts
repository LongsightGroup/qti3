import type { QtiContentNode, QtiValue } from "@longsightgroup/qti3-core";
import { isResolvableAssetUrl } from "@longsightgroup/qti3-core";
import {
  parseAuthoredAssetUrl,
  parseResolvedAssetUrl,
  type QtiRenderedAssetUrlContext,
} from "../asset-url-policy.js";

export { isResolvableAssetUrl };

const htmlContentElements = new Set([
  "a",
  "abbr",
  "article",
  "audio",
  "b",
  "bdi",
  "bdo",
  "blockquote",
  "br",
  "caption",
  "cite",
  "code",
  "dd",
  "dfn",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "kbd",
  "li",
  "ol",
  "p",
  "picture",
  "pre",
  "q",
  "rb",
  "rbc",
  "rp",
  "rt",
  "rtc",
  "ruby",
  "samp",
  "section",
  "small",
  "span",
  "strong",
  "source",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "track",
  "ul",
  "var",
  "video",
]);

export const unsafeContentElements = new Set(["script", "style"]);

const mathMlElements = new Set([
  "math",
  "annotation",
  "annotation-xml",
  "maction",
  "maligngroup",
  "malignmark",
  "menclose",
  "merror",
  "mfenced",
  "mfrac",
  "mglyph",
  "mi",
  "mlabeledtr",
  "mlongdiv",
  "mmultiscripts",
  "mn",
  "mo",
  "mover",
  "mpadded",
  "mphantom",
  "mroot",
  "mrow",
  "ms",
  "mscarries",
  "mscarry",
  "msgroup",
  "msline",
  "mspace",
  "msqrt",
  "msrow",
  "mstack",
  "mstyle",
  "msub",
  "msubsup",
  "msup",
  "mtable",
  "mtd",
  "mtext",
  "mtr",
  "munder",
  "munderover",
  "semantics",
]);

export function contentElementName(qtiName: string): string | undefined {
  if (qtiName === "qti-content-body" || qtiName === "qti-prompt") return undefined;
  if (htmlContentElements.has(qtiName) || mathMlElements.has(qtiName)) return qtiName;
  if (qtiName === "object") return "object";
  if (qtiName === "qti-rubric-block") return "section";
  if (qtiName === "qti-template-block") return "div";
  if (qtiName === "qti-template-inline") return "span";
  return undefined;
}

export function createContentElement(name: string): HTMLElement | MathMLElement {
  if (mathMlElements.has(name)) {
    return document.createElementNS("http://www.w3.org/1998/Math/MathML", name) as MathMLElement;
  }
  return document.createElement(name);
}

export function copySafeAttributes(element: Element, attributes: Record<string, string>): void {
  for (const [name, value] of Object.entries(
    sanitizeContentAttributes(attributes, undefined, element.localName),
  )) {
    element.setAttribute(name, value);
    if (name === "xml:lang" && !Object.hasOwn(attributes, "lang")) {
      element.setAttribute("lang", value);
    }
  }
  applySharedAccessibilityVocabulary(element, attributes);
}

/** Produces an allowlisted attribute record and optionally resolves package-relative asset URLs. */
export function sanitizeContentAttributes(
  attributes: Record<string, string>,
  resolveAsset?: (url: string) => string,
  elementName?: string,
): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [name, value] of Object.entries(attributes)) {
    const urlContext = contentAttributeUrlContext(elementName, name);
    if (!isSafeContentAttribute(name, value, urlContext)) continue;
    const normalizedName = name.toLowerCase();
    if (
      resolveAsset &&
      (normalizedName === "href" || normalizedName === "src" || normalizedName === "data") &&
      isResolvableAssetUrl(value)
    ) {
      const resolved = resolveAsset(value);
      const safeResolved = parseResolvedAssetUrl(resolved, urlContext ?? "content");
      if (!safeResolved) continue;
      sanitized[name] = safeResolved;
      continue;
    }
    if (urlContext) {
      const safeAuthored = parseAuthoredAssetUrl(value, urlContext);
      if (safeAuthored) sanitized[name] = safeAuthored;
      continue;
    }
    sanitized[name] = value;
  }
  return sanitized;
}

export function applySharedAccessibilityVocabulary(
  element: Element,
  attributes: Record<string, string>,
): void {
  for (const [name, value] of Object.entries(attributes)) {
    const ariaName = qtiAriaAttributeName(name);
    if (!ariaName || hasAttributeName(attributes, ariaName)) continue;
    element.setAttribute(ariaName, value);
  }

  const suppressTts = attributeValue(attributes, "data-qti-suppress-tts");
  if (
    suppressesScreenReaderSpeech(suppressTts) &&
    !hasAttributeName(attributes, "aria-hidden") &&
    !hasAttributeName(attributes, "data-qti-aria-hidden")
  ) {
    element.setAttribute("aria-hidden", "true");
  }
}

function qtiAriaAttributeName(name: string): string | undefined {
  const normalizedName = name.toLowerCase();
  const prefix = "data-qti-aria-";
  if (!normalizedName.startsWith(prefix)) return undefined;
  const suffix = normalizedName.slice(prefix.length);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(suffix)) return undefined;
  return `aria-${suffix}`;
}

function attributeValue(attributes: Record<string, string>, name: string): string | undefined {
  const normalizedName = name.toLowerCase();
  const entry = Object.entries(attributes).find(
    ([attributeName]) => attributeName.toLowerCase() === normalizedName,
  );
  return entry?.[1];
}

function hasAttributeName(attributes: Record<string, string>, name: string): boolean {
  return attributeValue(attributes, name) !== undefined;
}

function suppressesScreenReaderSpeech(value: string | undefined): boolean {
  if (!value) return false;
  const tokens = value
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean);
  return tokens.includes("all") || tokens.includes("screen-reader");
}

function isSafeContentAttribute(
  name: string,
  value: string,
  urlContext: QtiRenderedAssetUrlContext | undefined,
): boolean {
  const normalizedName = name.toLowerCase();
  if (normalizedName.startsWith("on")) return false;
  if (normalizedName === "style") return false;
  if (normalizedName === "href" || normalizedName === "src" || normalizedName === "data") {
    return parseAuthoredAssetUrl(value, urlContext ?? "content") !== undefined;
  }
  return (
    normalizedName === "alt" ||
    normalizedName === "controls" ||
    normalizedName === "class" ||
    normalizedName === "colspan" ||
    normalizedName === "dir" ||
    normalizedName === "headers" ||
    normalizedName === "height" ||
    normalizedName === "id" ||
    normalizedName === "kind" ||
    normalizedName === "label" ||
    normalizedName === "lang" ||
    normalizedName === "poster" ||
    normalizedName === "preload" ||
    normalizedName === "role" ||
    normalizedName === "rowspan" ||
    normalizedName === "scope" ||
    normalizedName === "srclang" ||
    normalizedName === "title" ||
    normalizedName === "type" ||
    normalizedName === "width" ||
    normalizedName === "xml:lang" ||
    mathMlAttributeNames.has(normalizedName) ||
    normalizedName.startsWith("aria-") ||
    normalizedName.startsWith("data-")
  );
}

function contentAttributeUrlContext(
  elementName: string | undefined,
  attributeName: string,
): QtiRenderedAssetUrlContext | undefined {
  const normalizedAttribute = attributeName.toLowerCase();
  if (normalizedAttribute === "href") return "navigation";
  if (normalizedAttribute === "data" && elementName === "object") return "object";
  if (normalizedAttribute !== "src") return normalizedAttribute === "data" ? "content" : undefined;
  if (elementName === "img" || elementName === "image") return "image";
  if (elementName === "track") return "track";
  if (elementName === "audio" || elementName === "video") return "media";
  return "content";
}

const mathMlAttributeNames = new Set([
  "accent",
  "accentunder",
  "align",
  "columnalign",
  "display",
  "encoding",
  "fence",
  "largeop",
  "lspace",
  "mathbackground",
  "mathcolor",
  "mathsize",
  "mathvariant",
  "movablelimits",
  "rowalign",
  "rspace",
  "separator",
  "stretchy",
]);

export function isSafeUrl(value: string): boolean {
  return parseAuthoredAssetUrl(value, "content") !== undefined;
}

/** Returns whether a URL is safe to retain as rendered content or a package-relative asset. */
export function isSafeContentUrl(value: string): boolean {
  return isSafeUrl(value) || isResolvableAssetUrl(value);
}

/** Returns whether a trusted host resolver produced a renderable asset URL. */
export function isSafeResolvedAssetUrl(value: string): boolean {
  return parseResolvedAssetUrl(value, "content") !== undefined;
}

export function formatPrintedValue(value: QtiValue, format?: string): string {
  if (value === null) return "";
  const numericValue =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (Number.isFinite(numericValue) && format) {
    const fixed = /^%\.(\d+)f$/.exec(format);
    if (fixed) return numericValue.toFixed(Number(fixed[1]));
    if (format === "%d" || format === "%i") return String(Math.trunc(numericValue));
  }
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function contentNodeText(node: QtiContentNode): string {
  if (node.kind === "text") return node.text;
  if ("children" in node) return node.children.map(contentNodeText).join("");
  return "";
}
