import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  basicImportItemOnlyCriteria,
  runQti3BasicImportItemOnlyCertification,
  type QtiBasicImportAcceptanceCriterion,
} from "./index.js";

describe("QTI 3 Basic IMPORT item-only certification runner", () => {
  it("defines the Basic IMPORT item-only acceptance map", () => {
    expect(basicImportItemOnlyCriteria.length).toBeGreaterThan(50);
    expect(basicImportItemOnlyCriteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ acId: "A1-L1-I1", featureId: "A-1" }),
        expect.objectContaining({ acId: "Q2-L1-I14", expectation: "invalid-item" }),
        expect.objectContaining({ acId: "Q20-L1-I111", featureId: "Q-20" }),
      ]),
    );
  });

  it("passes valid rows and expected invalid rows with validator evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "qti-basic-import-"));
    try {
      await writeFixture(root, "items/choice.xml", validChoiceXml());
      await writeFixture(root, "items/invalid.xml", "<qti-assessment-item");
      const validatorReport = join(root, "validator-report.json");
      await writeFile(validatorReport, '{"ok":true}\n', "utf8");

      const criteria: QtiBasicImportAcceptanceCriterion[] = [
        {
          acId: "Q2-L1-I13",
          featureId: "Q-2",
          label: "single-cardinality min/max choices are retained",
          sourcePath: "items/choice.xml",
          expectation: "stores-choice-cardinality",
        },
        {
          acId: "Q2-L1-I14",
          featureId: "Q-2",
          label: "invalid XML is rejected",
          sourcePath: "items/invalid.xml",
          expectation: "invalid-item",
          expectedDiagnosticCodes: ["xml.parse"],
        },
      ];

      const report = await runQti3BasicImportItemOnlyCertification({
        qtiRoot: root,
        validatorReport,
        requireValidatorEvidence: true,
        criteria,
      });

      expect(report).toMatchObject({
        targetCapability: "IMPORT",
        targetLevel: "Basic",
        targetScope: "Item Only Packages",
        checked: 2,
        failed: 0,
        ok: true,
        validatorEvidence: { ok: true },
      });
      expect(report.rows.every((row) => row.status === "passed")).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails when required validator evidence is missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "qti-basic-import-"));
    try {
      await writeFixture(root, "items/choice.xml", validChoiceXml());

      const report = await runQti3BasicImportItemOnlyCertification({
        qtiRoot: root,
        requireValidatorEvidence: true,
        criteria: [
          {
            acId: "Q2-L1-I13",
            featureId: "Q-2",
            label: "single-cardinality min/max choices are retained",
            sourcePath: "items/choice.xml",
            expectation: "stores-choice-cardinality",
          },
        ],
      });

      expect(report.ok).toBe(false);
      expect(report.failed).toBe(1);
      expect(report.validatorEvidence).toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports failed evidence rows without throwing", async () => {
    const root = await mkdtemp(join(tmpdir(), "qti-basic-import-"));
    try {
      await writeFixture(
        root,
        "items/choice.xml",
        validChoiceXml().replace(' max-choices="1"', ""),
      );

      const report = await runQti3BasicImportItemOnlyCertification({
        qtiRoot: root,
        criteria: [
          {
            acId: "Q2-L1-I13",
            featureId: "Q-2",
            label: "single-cardinality min/max choices are retained",
            sourcePath: "items/choice.xml",
            expectation: "stores-choice-cardinality",
          },
        ],
      });

      expect(report.ok).toBe(false);
      expect(report.rows[0]).toMatchObject({
        status: "failed",
        diagnostics: [
          expect.objectContaining({ code: "certification.evidence.choiceCardinality" }),
        ],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

async function writeFixture(root: string, path: string, contents: string): Promise<void> {
  const output = join(root, path);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, contents, "utf8");
}

function validChoiceXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="choice" title="choice" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" min-choices="0" max-choices="1">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
      <qti-simple-choice identifier="B">B</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>`;
}
