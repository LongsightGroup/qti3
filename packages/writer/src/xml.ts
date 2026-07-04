export function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function xmlAttributes(
  attrs: Record<string, string | number | boolean | undefined>,
): string {
  const parts: string[] = [];
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined) continue;
    parts.push(`${name}="${xmlEscape(String(value))}"`);
  }
  return parts.length ? ` ${parts.join(" ")}` : "";
}

export function classAttribute(classNames: readonly string[]): string {
  const unique = uniqueTokens(classNames);
  return unique.length ? ` class="${xmlEscape(unique.join(" "))}"` : "";
}

export function xmlAttributeList(attrs: readonly string[]): string {
  return attrs.filter((attr) => attr.trim().length > 0).join(" ");
}

export function xmlLines(lines: readonly (string | undefined | false)[]): string {
  return lines.filter((line): line is string => typeof line === "string").join("\n");
}

export function indentXml(xml: string, spaces: number): string {
  const prefix = " ".repeat(spaces);
  return xml
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

export function uniqueTokens(tokens: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokens) {
    const trimmed = token.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}
