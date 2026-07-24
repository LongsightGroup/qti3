export function createStoredZip(entries: Record<string, string | Uint8Array>): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  let index = 0;
  for (const [path, value] of Object.entries(entries)) {
    const name = encoder.encode(path);
    const data = typeof value === "string" ? encoder.encode(value) : value;
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    localParts.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    centralParts.push(central);
    offset += local.length;
    index += 1;
  }
  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, index, true);
  endView.setUint16(10, index, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);
  return concat([...localParts, ...centralParts, end]);
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function assessmentPackageZip(
  itemTypes: readonly QtiInteractionType[] = ["choice", "order", "slider"],
  itemXmlOverrides: Readonly<Partial<Record<QtiInteractionType, string>>> = {},
): Uint8Array {
  const files = Object.fromEntries(
    itemTypes.map((interactionType) => [
      `items/${interactionType}.xml`,
      itemXmlOverrides[interactionType] ?? assessmentPackageItemXml(interactionType),
    ]),
  );
  const resources = itemTypes
    .map(
      (
        interactionType,
      ) => `    <resource identifier="${interactionType}" type="imsqti_item_xmlv3p0" href="items/${interactionType}.xml">
      <file href="items/${interactionType}.xml"/>
    </resource>`,
    )
    .join("\n");
  const dependencies = itemTypes
    .map((interactionType) => `      <dependency identifierref="${interactionType}"/>`)
    .join("\n");
  const itemRefs = itemTypes
    .map(
      (interactionType) =>
        `      <qti-assessment-item-ref identifier="${interactionType}-ref" href="../items/${interactionType}.xml"/>`,
    )
    .join("\n");
  const entries = {
    "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="package">
  <resources>
    <resource identifier="assessment" type="imsqti_test_xmlv3p0" href="tests/assessment.xml">
      <file href="tests/assessment.xml"/>
${dependencies}
    </resource>
${resources}
  </resources>
</manifest>`,
    "tests/assessment.xml": `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="assessment" title="Round trip">
  <qti-test-part identifier="part" navigation-mode="linear" submission-mode="individual">
    <qti-assessment-section identifier="section" title="Section" visible="true">
${itemRefs}
    </qti-assessment-section>
  </qti-test-part>
</qti-assessment-test>`,
    ...files,
  };
  return zipSync(
    Object.fromEntries(Object.entries(entries).map(([path, data]) => [path, strToU8(data)])),
    { level: 0 },
  );
}

function assessmentPackageItemXml(interactionType: QtiInteractionType): string {
  if (interactionType === "custom") {
    return writeQti3AssessmentItem({
      interactionType: "custom",
      identifier: "custom-reference",
      title: "Custom reference",
      bodyHtml: qti3TrustedXmlFragment("<p>Use the widget.</p>"),
      interactionMarkupHtml: qti3TrustedXmlFragment('<div class="widget">Ready</div>'),
    });
  }
  return readFileSync(`packages/fixtures/xml/${interactionType}-reference.xml`, "utf8");
}
import { readFileSync } from "node:fs";

import type { QtiInteractionType } from "@longsightgroup/qti3-core";
import { qti3TrustedXmlFragment, writeQti3AssessmentItem } from "@longsightgroup/qti3-writer";
import { strToU8, zipSync } from "fflate";
