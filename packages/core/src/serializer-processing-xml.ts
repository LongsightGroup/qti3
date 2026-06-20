import { escapeXmlAttribute } from "./xml.js";

export type XmlAttribute = readonly [name: string, value: string | number | boolean | undefined];

export interface SerializationContext {
  diagnostics: import("./types.js").QtiDiagnostic[];
}

export function renderElement(
  name: string,
  attrs: readonly XmlAttribute[],
  content: readonly string[] | string,
  indent: number,
): string[] {
  const prefix = "  ".repeat(indent);
  const attributeText = renderAttributes(attrs);
  if (typeof content === "string") {
    return [`${prefix}<${name}${attributeText}>${content}</${name}>`];
  }
  if (content.length === 0) return [`${prefix}<${name}${attributeText}/>`];
  return [`${prefix}<${name}${attributeText}>`, ...content, `${prefix}</${name}>`];
}

export function renderAttributes(attrs: readonly XmlAttribute[]): string {
  return attrs
    .filter((attr): attr is readonly [string, string | number | boolean] => attr[1] !== undefined)
    .map(([name, value]) => ` ${name}="${escapeXmlAttribute(String(value))}"`)
    .join("");
}

export function knownAttributesWithBagFallback(
  bag: Record<string, string> | undefined,
  known: readonly { name: string; fallback?: string | number | boolean | undefined }[],
): XmlAttribute[] {
  const knownNames = new Set(known.map((entry) => entry.name));
  const resolved: XmlAttribute[] = known.flatMap(({ name, fallback }) => {
    const bagValue = bag?.[name];
    if (bagValue !== undefined) return [[name, bagValue] as const];
    if (fallback !== undefined) return [[name, fallback] as const];
    return [];
  });
  const extras = Object.entries(bag ?? {})
    .filter(([name]) => !knownNames.has(name))
    .toSorted(([left], [right]) => left.localeCompare(right));
  return [...resolved, ...extras];
}

export function sortedBagAttributes(bag: Record<string, string> | undefined): XmlAttribute[] {
  return Object.entries(bag ?? {})
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => [name, value] as const);
}

export function addSerializerDiagnostic(
  context: SerializationContext,
  code: string,
  diagnostic: Omit<import("./types.js").QtiDiagnostic, "code" | "severity"> & {
    severity?: import("./types.js").QtiDiagnostic["severity"];
  },
): void {
  context.diagnostics.push({
    code,
    severity: diagnostic.severity ?? "error",
    message: diagnostic.message,
    ...(diagnostic.source !== undefined ? { source: diagnostic.source } : {}),
  });
}
