import { isResolvableAssetUrl, normalizePackagePath } from "@longsightgroup/qti3-core";

/** Resolve only package-relative references against host-owned object URLs. */
export function resolvePackageAssetUrl(
  itemPath: string,
  reference: string,
  assetUrls: ReadonlyMap<string, string>,
): string | undefined {
  if (!isResolvableAssetUrl(reference)) return undefined;
  const trimmed = reference.trim();
  const href = trimmed.split(/[?#]/, 1)[0] ?? "";
  const base = itemPath.includes("/") ? itemPath.slice(0, itemPath.lastIndexOf("/") + 1) : "";
  const path = normalizePackagePath(`${base}${href}`, "asset reference", []);
  if (!path) return undefined;
  const resolved = assetUrls.get(path);
  if (!resolved) return undefined;
  const hash = trimmed.indexOf("#");
  return resolved + (hash < 0 ? "" : trimmed.slice(hash));
}
