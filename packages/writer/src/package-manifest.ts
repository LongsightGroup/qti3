import { QTI_ITEM_RESOURCE_TYPE } from "@longsightgroup/qti3-core";

import type { NormalizedPackage, NormalizedPackageItem } from "./package-build.js";
import { escapeXmlAttribute, escapeXmlText, xmlLines } from "./xml.js";

export function renderPackageManifest(input: NormalizedPackage): string {
  return xmlLines([
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="${escapeXmlAttribute(input.identifier)}">`,
    input.title
      ? `  <metadata>\n    <title>${escapeXmlText(input.title)}</title>\n  </metadata>`
      : undefined,
    `  <resources>`,
    ...input.items.map(renderManifestItemResource),
    `  </resources>`,
    `</manifest>`,
  ]);
}

function renderManifestItemResource(item: NormalizedPackageItem): string {
  const files = uniqueManifestFilePaths(
    item.path,
    item.assets.map((asset) => asset.path),
  );
  return xmlLines([
    `    <resource identifier="${escapeXmlAttribute(item.identifier)}" type="${QTI_ITEM_RESOURCE_TYPE}" href="${escapeXmlAttribute(item.path)}">`,
    ...files.map((path) => `      <file href="${escapeXmlAttribute(path)}"/>`),
    `    </resource>`,
  ]);
}

function uniqueManifestFilePaths(
  itemPath: string,
  assetPaths: readonly string[],
): readonly string[] {
  const files: string[] = [];
  const seen = new Set<string>();
  for (const path of [itemPath, ...assetPaths]) {
    if (!path || seen.has(path)) continue;
    seen.add(path);
    files.push(path);
  }
  return files;
}
