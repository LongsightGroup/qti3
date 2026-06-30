import { deflateRawSync } from "node:zlib";

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

export function createStoredZip(files: Record<string, string | Buffer>): Buffer {
  return createZip(files, 0);
}

export function createDeflatedZip(files: Record<string, string | Buffer>): Buffer {
  return createZip(files, 8);
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
  return createZip(zipFiles, input.compression === "deflated" ? 8 : 0);
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

function createZip(files: Record<string, string | Buffer>, method: 0 | 8): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = Buffer.from(name);
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const compressed = method === 8 ? deflateRawSync(data) : data;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBytes, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBytes);

    offset += local.length + nameBytes.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}
