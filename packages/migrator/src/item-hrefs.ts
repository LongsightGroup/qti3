import { migrationPathIdentifier } from "./identifiers.js";

export function uniqueSiblingItemHref(
  sourceHref: string,
  suffix: string,
  usedPaths: Set<string>,
): string {
  const slashIndex = sourceHref.lastIndexOf("/");
  const directory = slashIndex >= 0 ? sourceHref.slice(0, slashIndex + 1) : "";
  const fileName = slashIndex >= 0 ? sourceHref.slice(slashIndex + 1) : sourceHref;
  const dotIndex = fileName.toLowerCase().endsWith(".xml")
    ? fileName.length - 4
    : fileName.lastIndexOf(".");
  const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName || "item";
  const extension = dotIndex > 0 ? fileName.slice(dotIndex) : ".xml";
  const safeSuffix = migrationPathIdentifier(suffix);
  let candidate = `${directory}${baseName}_${safeSuffix}${extension}`;
  for (let index = 2; usedPaths.has(candidate); index += 1) {
    candidate = `${directory}${baseName}_${safeSuffix}_${index}${extension}`;
  }
  usedPaths.add(candidate);
  return candidate;
}
