export function isResolvableAssetUrl(value: string): boolean {
  const normalized = value.trim();
  return (
    normalized.length > 0 &&
    !normalized.startsWith("#") &&
    !normalized.startsWith("/") &&
    !/^[a-z][a-z\d+.-]*:/i.test(normalized)
  );
}
