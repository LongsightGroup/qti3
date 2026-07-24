import type { QtiTranscodeDiagnostic, QtiTranscodeFile } from "./types.js";
import { escapeXml, safePackagePath } from "./xml.js";

export function packageManifest(
  resourceType: string,
  schemaVersion: string,
  items: readonly QtiTranscodeFile[],
  assets: readonly QtiTranscodeFile[],
  assetOwners: ReadonlyMap<string, readonly string[]>,
  assessmentTest: QtiTranscodeFile | undefined,
  target: "qti12" | "qti21" | "qti22",
): string {
  const itemResources = items
    .map(
      (
        item,
        index,
      ) => `    <resource identifier="RESOURCE_${index + 1}" type="${resourceType}" href="${escapeXml(item.path)}">
      <file href="${escapeXml(item.path)}"/>
${assets
  .filter((asset) => assetOwners.get(asset.path)?.includes(item.path))
  .map((asset) => `      <file href="${escapeXml(asset.path)}"/>`)
  .join("\n")}
    </resource>`,
    )
    .join("\n");
  const testResource = assessmentTest
    ? `    <resource identifier="ASSESSMENT_TEST" type="${
        target === "qti12"
          ? "imsqti_xmlv1p2"
          : `imsqti_test_xmlv${target === "qti21" ? "2p1" : "2p2"}`
      }" href="${escapeXml(assessmentTest.path)}">
      <file href="${escapeXml(assessmentTest.path)}"/>
${assets
  .filter((asset) => assetOwners.get(asset.path)?.includes(assessmentTest.path))
  .map((asset) => `      <file href="${escapeXml(asset.path)}"/>`)
  .join("\n")}
${items
  .map((_item, index) => `      <dependency identifierref="RESOURCE_${index + 1}"/>`)
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
