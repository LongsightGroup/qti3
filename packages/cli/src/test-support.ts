import { deflateRawSync } from "node:zlib";
import { interactionFixtures } from "@longsightgroup/qti3-fixtures";
import { vi } from "vitest";
import { main } from "./index.js";

interface CliPackageJsonReport {
  packageErrors?: unknown;
  checked?: number;
  failed?: number;
  assessmentTestFiles?: unknown;
}

interface CliResultJsonReport {
  diagnostics?: unknown;
}

interface CliJsonReport {
  ok?: boolean;
  target?: unknown;
  interactions?: unknown;
  manualAssistiveTechnologyScripts?: unknown;
  assetFiles?: unknown;
  basicFeatures?: unknown;
  packageErrors?: unknown;
  missingPackageFeatures?: unknown;
  packages: CliPackageJsonReport[];
  results: CliResultJsonReport[];
}

/** Run the public CLI seam and parse its final JSON output for behavior assertions. */
export async function runCliJson(args: string[]): Promise<{ code: number; report: CliJsonReport }> {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    const code = await main(args);
    const payload: unknown = JSON.parse(String(log.mock.calls.at(-1)?.[0]));
    if (!isCliJsonReport(payload)) {
      throw new Error("CLI output must be a JSON report object.");
    }
    const report: CliJsonReport = {
      packages: [],
      results: [],
      ...payload,
    };
    return { code, report };
  } finally {
    log.mockRestore();
    vi.restoreAllMocks();
  }
}

function isCliJsonReport(value: unknown): value is Partial<CliJsonReport> {
  if (!isJsonObject(value)) return false;
  const packages = value.packages;
  const results = value.results;
  return (
    (packages === undefined ||
      (Array.isArray(packages) && packages.every((entry) => isJsonObject(entry)))) &&
    (results === undefined ||
      (Array.isArray(results) && results.every((entry) => isJsonObject(entry))))
  );
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Return the Basic item-player feature identifiers expected in complete package evidence. */
export function basicFeatureIds(): string[] {
  return [
    "Q-2",
    "Q-5",
    "Q-13",
    "Q-20",
    "I-0",
    "I-1",
    "I-2",
    "I-7",
    "I-8",
    "I-9b",
    "I-17",
    "I-18",
    "I-19",
    "A-1",
    "P-4",
  ];
}

/** Build a minimal conforming Basic IMPORT assessment-test package. */
export function basicImportTestPackageEntries(): Record<string, string> {
  return {
    "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="qti3-l1-T1-test-entry">
  <resources>
    <resource identifier="t1-test-entry-item1" type="imsqti_item_xmlv3p0" href="items/choice-single-cardinality.xml"><file href="items/choice-single-cardinality.xml"/></resource>
    <resource identifier="t1-test-entry-item2" type="imsqti_item_xmlv3p0" href="items/choice-multiple-cardinality.xml"><file href="items/choice-multiple-cardinality.xml"/></resource>
    <resource identifier="t1-test-entry-item3" type="imsqti_item_xmlv3p0" href="items/text-entry.xml"><file href="items/text-entry.xml"/></resource>
    <resource identifier="t1-test-entry-item4" type="imsqti_item_xmlv3p0" href="items/extended-text.xml"><file href="items/extended-text.xml"/></resource>
    <resource identifier="t1-test-entry" type="imsqti_test_xmlv3p0" href="assessment.xml"><file href="assessment.xml"/></resource>
  </resources>
</manifest>`,
    "assessment.xml": `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="t1-test-entry" title="T1 - test entry">
  <qti-test-part identifier="testPart-1" navigation-mode="linear" submission-mode="individual">
    <qti-assessment-section identifier="assessmentSection-1" title="Section 1" visible="true">
      <qti-assessment-item-ref identifier="t1-test-entry-item1" href="items/choice-single-cardinality.xml"/>
      <qti-assessment-item-ref identifier="t1-test-entry-item2" href="items/choice-multiple-cardinality.xml"/>
      <qti-assessment-item-ref identifier="t1-test-entry-item3" href="items/text-entry.xml"/>
      <qti-assessment-item-ref identifier="t1-test-entry-item4" href="items/extended-text.xml"/>
    </qti-assessment-section>
  </qti-test-part>
</qti-assessment-test>`,
    "items/choice-single-cardinality.xml": basicImportTestItemXml(
      "choice-single",
      "identifier",
      '<qti-choice-interaction response-identifier="RESPONSE" min-choices="0" max-choices="1"><qti-simple-choice identifier="A">A</qti-simple-choice><qti-simple-choice identifier="B">B</qti-simple-choice></qti-choice-interaction>',
    ),
    "items/choice-multiple-cardinality.xml": basicImportTestItemXml(
      "choice-multiple",
      "identifier",
      '<qti-choice-interaction response-identifier="RESPONSE" min-choices="0" max-choices="2"><qti-simple-choice identifier="A">A</qti-simple-choice><qti-simple-choice identifier="B">B</qti-simple-choice></qti-choice-interaction>',
    ),
    "items/text-entry.xml": basicImportTestItemXml(
      "text-entry",
      "string",
      '<qti-text-entry-interaction response-identifier="RESPONSE"/>',
    ),
    "items/extended-text.xml": basicImportTestItemXml(
      "extended-text",
      "string",
      '<qti-extended-text-interaction response-identifier="RESPONSE"/>',
    ),
  };
}

function basicImportTestItemXml(
  identifier: string,
  baseType: "identifier" | "string",
  interactionXml: string,
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${identifier}" title="${identifier}" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="${baseType}"/>
  <qti-item-body>${interactionXml}</qti-item-body>
</qti-assessment-item>`;
}

/** Return the canonical choice interaction fixture XML used by CLI tests. */
export function choiceFixtureXml(): string {
  const fixture = interactionFixtures.find((entry) => entry.interactionType === "choice");
  if (fixture === undefined) throw new Error("Choice fixture is required for CLI tests.");
  return fixture.xml;
}

/** Build an adaptive item that exercises server-materialized delivery. */
export function adaptiveDeliveryXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="adaptive" title="Adaptive" adaptive="true" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
      <qti-simple-choice identifier="B">B</qti-simple-choice>
    </qti-choice-interaction>
    <qti-feedback-block outcome-identifier="FEEDBACK" identifier="yes" show-hide="show">Visible feedback.</qti-feedback-block>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`;
}

/** Encode package entries in a ZIP using stored entries. */
export function createStoredZip(entries: Record<string, string | Uint8Array>): Buffer {
  return createZip(entries, 0);
}

/** Encode package entries in a ZIP using raw-deflate entries. */
export function createDeflatedZip(entries: Record<string, string | Uint8Array>): Buffer {
  return createZip(entries, 8);
}

function createZip(entries: Record<string, string | Uint8Array>, method: 0 | 8): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  let index = 0;

  for (const [name, content] of Object.entries(entries)) {
    const nameBuffer = Buffer.from(name);
    const data = typeof content === "string" ? Buffer.from(content) : Buffer.from(content);
    const compressed = method === 8 ? deflateRawSync(data) : data;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    localParts.push(local, nameBuffer, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);

    offset += local.length + nameBuffer.length + compressed.length;
    index += 1;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(index, 8);
  eocd.writeUInt16LE(index, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
