import { deflateRawSync } from "node:zlib";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { basicImportTestCriteria, runQti3BasicImportTestCertification } from "./index.js";

const packagePath = "Basic/T4 and T7 - Test Structures/T4T7TestStructures.zip";

describe("QTI 3 Basic IMPORT test certification runner", () => {
  it("defines the Basic IMPORT test acceptance map", () => {
    expect(basicImportTestCriteria).toEqual([
      expect.objectContaining({ acId: "T4-L1-I1", featureId: "T-4" }),
      expect.objectContaining({ acId: "T4-L1-I2", featureId: "T-4" }),
      expect.objectContaining({ acId: "T7-L1-I1", featureId: "T-7" }),
      expect.objectContaining({ acId: "T7-L1-I2", featureId: "T-7" }),
    ]);
  });

  it("passes a package with one test, one test part, one section, and four item refs", async () => {
    const root = await writePackageRoot(packageEntries({}));
    try {
      const report = await runQti3BasicImportTestCertification({ qtiRoot: root });

      expect(report).toMatchObject({
        targetCapability: "IMPORT",
        targetLevel: "Basic",
        targetScope: "Test Structure Packages",
        checked: 4,
        failed: 0,
        ok: true,
        packageEvidence: {
          testResourceHref: "assessment.xml",
          itemRefHrefs: [
            "items/choice-single-cardinality.xml",
            "items/choice-multiple-cardinality.xml",
            "items/text-entry.xml",
            "items/extended-text.xml",
          ],
        },
      });
      expect(report.rows.every((row) => row.status === "passed")).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails when the assessment test identifier and title are missing", async () => {
    const root = await writePackageRoot(
      packageEntries({
        assessmentXml: assessmentXml()
          .replace(' identifier="t1-test-entry"', "")
          .replace(' title="T1 - test entry"', ""),
      }),
    );
    try {
      const report = await runQti3BasicImportTestCertification({ qtiRoot: root });

      expect(report.ok).toBe(false);
      expect(report.rows.find((row) => row.acId === "T4-L1-I1")).toMatchObject({
        status: "failed",
        diagnostics: [expect.objectContaining({ code: "certification.evidence.assessmentTest" })],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails when test part attributes are missing", async () => {
    const root = await writePackageRoot(
      packageEntries({
        assessmentXml: assessmentXml()
          .replace(' navigation-mode="linear"', "")
          .replace(' submission-mode="individual"', ""),
      }),
    );
    try {
      const report = await runQti3BasicImportTestCertification({ qtiRoot: root });

      expect(report.rows.find((row) => row.acId === "T4-L1-I2")).toMatchObject({
        status: "failed",
        diagnostics: expect.arrayContaining([
          expect.objectContaining({ code: "package.testPart.navigationMode.invalid" }),
          expect.objectContaining({ code: "package.testPart.submissionMode.invalid" }),
        ]),
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails when section attributes are missing", async () => {
    const root = await writePackageRoot(
      packageEntries({
        assessmentXml: assessmentXml()
          .replace(' title="Section 1"', "")
          .replace(' visible="true"', ""),
      }),
    );
    try {
      const report = await runQti3BasicImportTestCertification({ qtiRoot: root });

      expect(report.rows.find((row) => row.acId === "T7-L1-I1")).toMatchObject({
        status: "failed",
        diagnostics: [
          expect.objectContaining({ code: "certification.evidence.assessmentSection" }),
        ],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails when fewer than four item refs are imported", async () => {
    const root = await writePackageRoot(
      packageEntries({
        assessmentXml: assessmentXml().replace(
          '            <qti-assessment-item-ref identifier="t1-test-entry-item4" href="items/extended-text.xml"/>\n',
          "",
        ),
      }),
    );
    try {
      const report = await runQti3BasicImportTestCertification({ qtiRoot: root });

      expect(report.rows.find((row) => row.acId === "T7-L1-I2")).toMatchObject({
        status: "failed",
        diagnostics: [expect.objectContaining({ code: "certification.evidence.sectionItemRefs" })],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails when an item ref points to a missing item", async () => {
    const entries = packageEntries({});
    delete entries["items/extended-text.xml"];
    const root = await writePackageRoot(entries);
    try {
      const report = await runQti3BasicImportTestCertification({ qtiRoot: root });

      expect(report.ok).toBe(false);
      expect(report.packageEvidence.diagnostics).toContainEqual(
        expect.objectContaining({ code: "certification.package.itemRef.fileMissing" }),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

async function writePackageRoot(entries: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "qti-basic-import-tests-"));
  const output = join(root, packagePath);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, createStoredZip(entries));
  return root;
}

function packageEntries(options: {
  readonly assessmentXml?: string | undefined;
}): Record<string, string> {
  return {
    "imsmanifest.xml": manifestXml(),
    "assessment.xml": options.assessmentXml ?? assessmentXml(),
    "items/choice-single-cardinality.xml": itemXml(
      "choice-single",
      "identifier",
      choiceInteractionXml(),
    ),
    "items/choice-multiple-cardinality.xml": itemXml(
      "choice-multiple",
      "identifier",
      choiceInteractionXml(),
    ),
    "items/text-entry.xml": itemXml(
      "text-entry",
      "string",
      '<qti-text-entry-interaction response-identifier="RESPONSE"/>',
    ),
    "items/extended-text.xml": itemXml(
      "extended-text",
      "string",
      '<qti-extended-text-interaction response-identifier="RESPONSE"/>',
    ),
  };
}

function manifestXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="qti3-l1-T1-test-entry">
  <resources>
    <resource identifier="t1-test-entry-item1" type="imsqti_item_xmlv3p0" href="items/choice-single-cardinality.xml">
      <file href="items/choice-single-cardinality.xml"/>
    </resource>
    <resource identifier="t1-test-entry-item2" type="imsqti_item_xmlv3p0" href="items/choice-multiple-cardinality.xml">
      <file href="items/choice-multiple-cardinality.xml"/>
    </resource>
    <resource identifier="t1-test-entry-item3" type="imsqti_item_xmlv3p0" href="items/text-entry.xml">
      <file href="items/text-entry.xml"/>
    </resource>
    <resource identifier="t1-test-entry-item4" type="imsqti_item_xmlv3p0" href="items/extended-text.xml">
      <file href="items/extended-text.xml"/>
    </resource>
    <resource identifier="t1-test-entry" type="imsqti_test_xmlv3p0" href="assessment.xml">
      <file href="assessment.xml"/>
      <dependency identifierref="t1-test-entry-item1"/>
      <dependency identifierref="t1-test-entry-item2"/>
      <dependency identifierref="t1-test-entry-item3"/>
      <dependency identifierref="t1-test-entry-item4"/>
    </resource>
  </resources>
</manifest>`;
}

function assessmentXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="t1-test-entry" title="T1 - test entry">
    <qti-test-part identifier="testPart-1" navigation-mode="linear" submission-mode="individual">
        <qti-assessment-section identifier="assessmentSection-1" title="Section 1" visible="true">
            <qti-assessment-item-ref identifier="t1-test-entry-item1" href="items/choice-single-cardinality.xml"/>
            <qti-assessment-item-ref identifier="t1-test-entry-item2" href="items/choice-multiple-cardinality.xml"/>
            <qti-assessment-item-ref identifier="t1-test-entry-item3" href="items/text-entry.xml"/>
            <qti-assessment-item-ref identifier="t1-test-entry-item4" href="items/extended-text.xml"/>
        </qti-assessment-section>
    </qti-test-part>
</qti-assessment-test>`;
}

function itemXml(
  identifier: string,
  baseType: "identifier" | "string",
  interactionXml: string,
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${identifier}" title="${identifier}" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="${baseType}"/>
  <qti-item-body>
    ${interactionXml}
  </qti-item-body>
</qti-assessment-item>`;
}

function choiceInteractionXml(): string {
  return `<qti-choice-interaction response-identifier="RESPONSE" min-choices="0" max-choices="1">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
      <qti-simple-choice identifier="B">B</qti-simple-choice>
    </qti-choice-interaction>`;
}

function createStoredZip(entries: Record<string, string | Uint8Array>): Buffer {
  return createZip(entries, 0);
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
