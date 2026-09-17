import { createStoredZip, createDeflatedZip } from "../fixtures/package-zip.js";
export { createStoredZip, createDeflatedZip };

export interface QtiTestPackageResource {
  readonly identifier: string;
  readonly type: string;
  readonly href?: string;
  readonly files?: readonly string[];
}

export interface QtiTestItemPackageZipInput {
  readonly resources: readonly QtiTestPackageResource[];
  readonly files: Record<string, string | Buffer>;
  readonly compression?: "stored" | "deflated";
}

export function qtiItemResource(
  identifier: string,
  href: string,
  additionalFiles: readonly string[] = [],
): QtiTestPackageResource {
  return {
    identifier,
    type: "imsqti_item_xmlv3p0",
    href,
    files: [href, ...additionalFiles],
  };
}

export function qtiAssessmentTestResource(
  identifier: string,
  href: string,
): QtiTestPackageResource {
  return {
    identifier,
    type: "imsqti_test_xmlv3p0",
    href,
    files: [href],
  };
}

export function createItemPackageZip(input: QtiTestItemPackageZipInput): Buffer {
  const zipFiles = {
    "imsmanifest.xml": packageManifestXml(input.resources),
    ...input.files,
  };
  return input.compression === "deflated" ? createDeflatedZip(zipFiles) : createStoredZip(zipFiles);
}

function packageManifestXml(resources: readonly QtiTestPackageResource[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
${resources.map(packageResourceXml).join("\n")}
  </resources>
</manifest>`;
}

function packageResourceXml(resource: QtiTestPackageResource): string {
  const href = resource.href === undefined ? "" : ` href="${escapeXmlAttribute(resource.href)}"`;
  const files = resource.files ?? [];
  if (files.length === 0) {
    return `    <resource identifier="${escapeXmlAttribute(resource.identifier)}" type="${escapeXmlAttribute(resource.type)}"${href}/>`;
  }
  return `    <resource identifier="${escapeXmlAttribute(resource.identifier)}" type="${escapeXmlAttribute(resource.type)}"${href}>
${files.map((file) => `      <file href="${escapeXmlAttribute(file)}"/>`).join("\n")}
    </resource>`;
}

function escapeXmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
