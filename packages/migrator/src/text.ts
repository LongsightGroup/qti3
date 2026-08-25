export function normalizeIdentifier(value: string | null | undefined, fallback = "ID"): string {
  const source = (value ?? "").trim() || fallback;
  const normalized = source.replace(/[^A-Za-z0-9_]/g, "_").replace(/^[^A-Za-z_]+/, "");
  return normalized || fallback;
}

export function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

export function trustedFragment(html: string): string {
  return html.trim();
}
