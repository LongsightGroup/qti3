import type { QtiStandardAlignment } from "@longsightgroup/qti3-core";

import type { QtiTranscodeDiagnostic, QtiTranscodeFile } from "./types.js";
import { escapeXmlAttribute, escapeXmlText, safePackagePath } from "./xml.js";

export interface TargetPackageItemResource extends QtiTranscodeFile {
  readonly identifier: string;
  readonly data: string;
  readonly standards: readonly QtiStandardAlignment[];
}

export interface TargetPackageAssessmentResource extends QtiTranscodeFile {
  readonly identifier: string;
  readonly data: string;
}

export function manifestItemResourceIdentifier(index: number): string {
  return `RESOURCE_${index + 1}`;
}

export function packageManifest(
  resourceType: string,
  schemaVersion: string,
  items: readonly TargetPackageItemResource[],
  assets: readonly QtiTranscodeFile[],
  assetOwners: ReadonlyMap<string, readonly string[]>,
  assessmentTest: TargetPackageAssessmentResource | undefined,
  target: "qti12" | "qti21" | "qti22",
): string {
  const itemResources = items
    .map(
      (
        item,
      ) => `    <resource identifier="${escapeXmlAttribute(item.identifier)}" type="${resourceType}" href="${escapeXmlAttribute(item.path)}">
      <file href="${escapeXmlAttribute(item.path)}"/>
${assets
  .filter((asset) => assetOwners.get(asset.path)?.includes(item.path))
  .map((asset) => `      <file href="${escapeXmlAttribute(asset.path)}"/>`)
  .join("\n")}
${serializeStandardsMetadata(item.standards)}
    </resource>`,
    )
    .join("\n");
  const testResource = assessmentTest
    ? `    <resource identifier="${escapeXmlAttribute(assessmentTest.identifier)}" type="${
        target === "qti12"
          ? "imsqti_xmlv1p2"
          : `imsqti_test_xmlv${target === "qti21" ? "2p1" : "2p2"}`
      }" href="${escapeXmlAttribute(assessmentTest.path)}">
      <file href="${escapeXmlAttribute(assessmentTest.path)}"/>
${assets
  .filter((asset) => assetOwners.get(asset.path)?.includes(assessmentTest.path))
  .map((asset) => `      <file href="${escapeXmlAttribute(asset.path)}"/>`)
  .join("\n")}
${items
  .map((item) => `      <dependency identifierref="${escapeXmlAttribute(item.identifier)}"/>`)
  .join("\n")}
    </resource>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1" identifier="MANIFEST">
  <metadata><schema>QTI</schema><schemaversion>${schemaVersion}</schemaversion></metadata>
  <organizations/>
  <resources>
${testResource}
${itemResources}
  </resources>
</manifest>`;
}

function serializeStandardsMetadata(standards: readonly QtiStandardAlignment[]): string {
  if (standards.length === 0) return "";
  const alignments = standards
    .map((standard) => {
      const attributes = [
        ["identifier", standard.identifier],
        ["framework", standard.framework],
        ["target-name", standard.targetName],
        ["href", standard.targetUrl],
        ["provider-identifier", standard.providerIdentifier],
        ["resource-label", standard.resourceLabel],
        ["resource-part-identifier", standard.resourcePartIdentifier],
        ["weight", standard.weight],
      ]
        .filter((pair): pair is [string, string | number] => pair[1] !== undefined)
        .map(([name, value]) => ` ${name}="${escapeXmlAttribute(String(value))}"`)
        .join("");
      return `        <standard-alignment${attributes}>${escapeXmlText(standard.text ?? "")}</standard-alignment>`;
    })
    .join("\n");
  return `      <metadata>
${alignments}
      </metadata>`;
}

export function relativePackagePath(fromFile: string, toFile: string): string {
  const from = fromFile.split("/").slice(0, -1);
  const to = toFile.split("/");
  while (from[0] !== undefined && from[0] === to[0]) {
    from.shift();
    to.shift();
  }
  return [...from.map(() => ".."), ...to].join("/");
}

export function validatePaths(
  files: readonly QtiTranscodeFile[],
): QtiTranscodeDiagnostic | undefined {
  const unsafe = files.find((file) => !safePackagePath(file.path));
  return unsafe
    ? {
        code: "package.path.unsafe",
        severity: "error",
        message: `Package path ${unsafe.path} is not a safe relative path.`,
        path: unsafe.path,
      }
    : undefined;
}

export function findCollision(files: readonly QtiTranscodeFile[]): string | undefined {
  const dataByPath = new Map<string, string | Uint8Array>();
  for (const file of files) {
    const existing = dataByPath.get(file.path);
    if (existing !== undefined && !sameData(existing, file.data)) return file.path;
    dataByPath.set(file.path, file.data);
  }
  return undefined;
}

function sameData(left: string | Uint8Array, right: string | Uint8Array): boolean {
  if (typeof left === "string" || typeof right === "string") return left === right;
  return left.length === right.length && left.every((value, index) => right[index] === value);
}

export async function generatedAssetPath(data: string, extension: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  const hash = [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return `assets/generated/${hash}.${extension}`;
}
