import { isResolvableAssetUrl } from "@longsightgroup/qti3-core";

export type QtiRenderedAssetUrlContext =
  | "content"
  | "image"
  | "media"
  | "navigation"
  | "object"
  | "track";

/** Parse an authored URL into a normalized value that is safe for the specified DOM sink. */
export function parseAuthoredAssetUrl(
  value: string,
  context: QtiRenderedAssetUrlContext,
): string | undefined {
  const normalized = value.trim();
  if (!normalized || hasForbiddenUrlCharacter(normalized)) return undefined;
  if (/^[\\/]{2}/.test(normalized)) return undefined;

  if (normalized.startsWith("#")) {
    return context === "content" || context === "image" || context === "navigation"
      ? normalized
      : undefined;
  }
  if (normalized.startsWith("/") || isResolvableAssetUrl(normalized)) return normalized;
  if (/^https?:\/\//i.test(normalized)) return normalized;

  if (context === "content" && /^data:(?:image|audio|video)\//i.test(normalized)) {
    return normalized;
  }
  if (context === "image" && /^data:image\//i.test(normalized)) return normalized;
  if (context === "media" && /^data:(?:audio|video)\//i.test(normalized)) return normalized;

  return undefined;
}

function hasForbiddenUrlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (character === "\\" || codePoint === undefined || codePoint <= 0x1f || codePoint === 0x7f) {
      return true;
    }
  }
  return false;
}

/** Parse a trusted host-resolved URL, additionally permitting blob URLs. */
export function parseResolvedAssetUrl(
  value: string,
  context: QtiRenderedAssetUrlContext,
): string | undefined {
  const normalized = value.trim();
  if (/^blob:/i.test(normalized)) return normalized;
  return parseAuthoredAssetUrl(normalized, context);
}
