import { QTI_ITEM_RESOURCE_TYPE } from "@longsightgroup/qti3-core";

import type { NormalizedPackage, NormalizedPackageItem } from "./package-build.js";
import { xmlEscape, xmlLines } from "./xml.js";

export function renderPackageManifest(input: NormalizedPackage): string {
  return xmlLines([
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="${xmlEscape(input.identifier)}">`,
    input.title
      ? `  <metadata>\n    <title>${xmlEscape(input.title)}</title>\n  </metadata>`
      : undefined,
    `  <resources>`,
    ...input.items.map(renderManifestItemResource),
    `  </resources>`,
    `</manifest>`,
  ]);
}

function renderManifestItemResource(item: NormalizedPackageItem): string {
  const files = [item.path, ...item.assets.map((asset) => asset.path)];
  return xmlLines([
    `    <resource identifier="${xmlEscape(item.identifier)}" type="${QTI_ITEM_RESOURCE_TYPE}" href="${xmlEscape(item.path)}">`,
    ...files.map((path) => `      <file href="${xmlEscape(path)}"/>`),
    `    </resource>`,
  ]);
}
