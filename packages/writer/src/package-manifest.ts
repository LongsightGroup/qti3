import { QTI_ITEM_RESOURCE_TYPE } from "@longsightgroup/qti3-core";

import type { NormalizedPackage, NormalizedPackageItem } from "./package-build.js";
import { escapeXmlAttribute, escapeXmlText, xmlLines } from "./xml.js";

export function renderPackageManifest(input: NormalizedPackage): string {
  return xmlLines([
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:lom="http://ltsc.ieee.org/xsd/LOM" xsi:schemaLocation="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1 https://purl.imsglobal.org/spec/qti/v3p0/schema/xsd/imsqtiv3p0p1_imscpv1p2_v1p0.xsd http://ltsc.ieee.org/xsd/LOM https://purl.imsglobal.org/spec/md/v1p3/schema/xsd/imsmd_loose_v1p3p2.xsd" identifier="${escapeXmlAttribute(input.identifier)}">`,
    `  <metadata>`,
    `    <schema>QTI Item Bank</schema>`,
    `    <schemaversion>3.0.1</schemaversion>`,
    input.title
      ? `    <lom:lom><lom:general><lom:title><lom:string>${escapeXmlText(input.title)}</lom:string></lom:title></lom:general></lom:lom>`
      : undefined,
    `  </metadata>`,
    `  <organizations/>`,
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
