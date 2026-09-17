import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { verifyQtiValidatorEvidence } from "./validator-evidence.js";
import { runQti3BasicImportItemOnlyCertification } from "./basic-import-items.js";

const bytes = new Uint8Array([80, 75, 3, 4]);
const digest = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
function passingReport() {
  return {
    id: `qti3-sha256-${digest(bytes)}`,
    generated: "2026-09-17T17:00:02",
    generator: "Qti30Inspector",
    input: { name: "sample.zip", type: "ZIP" },
    specification: { pid: "qti3.pid", shortName: "qti", version: "3.0", title: "QTI 3.0" },
    summary: {
      outcome: "VALID",
      fatals: 0,
      errors: 0,
      warnings: 0,
      exceptions: 0,
      notRun: 0,
      totalRun: 12,
      valid: 0,
    },
    valids: [],
    fatals: [],
    errors: [],
    warnings: [],
    notRun: [],
    exceptions: [],
    objects: [],
  };
}
async function withFiles(
  run: (
    root: string,
    reportPath: string,
    packagePath: string,
    trustedDigest: string,
  ) => Promise<void>,
  report: unknown = passingReport(),
): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "qti-validator-"));
  try {
    const reportPath = join(root, "report.json");
    const packagePath = join(root, "sample.zip");
    const json = JSON.stringify(report);
    await writeFile(reportPath, json);
    await writeFile(packagePath, bytes);
    await run(root, reportPath, packagePath, digest(json));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("official member validator evidence", () => {
  it("accepts a scoped successful report under the explicit operator trust boundary", async () => {
    await withFiles(async (_root, report, packagePath, trustedReportSha256) => {
      const result = await verifyQtiValidatorEvidence({
        report,
        package: packagePath,
        trustedReportSha256,
      });
      expect(result).toMatchObject({
        status: "verified-pass",
        trust: "operator-attested-download",
        artifactSha256: digest(bytes),
        diagnostics: [],
        scope: { generator: "Qti30Inspector", capability: "content-validation" },
      });
    });
  });

  it("does not infer authenticated provenance from parseable JSON or a package hash", async () => {
    await withFiles(async (_root, report, packagePath) => {
      const result = await verifyQtiValidatorEvidence({ report, package: packagePath });
      expect(result.status).toBe("unverified");
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({ code: "certification.validator.provenance" }),
      );
      expect(
        (
          await verifyQtiValidatorEvidence({
            report,
            package: packagePath,
            trustedReportSha256: "0".repeat(64),
          })
        ).status,
      ).toBe("unverified");
    });
  });

  const base = passingReport();
  it.each([
    ["self-asserted verdict", { ok: true }],
    ["other inspector", { ...base, generator: "Qti30SbacInspector" }],
    ["other QTI version", { ...base, specification: { ...base.specification, version: "2.2" } }],
    ["failed verdict", { ...base, summary: { ...base.summary, outcome: "ERROR" } }],
    ["partial execution", { ...base, summary: { ...base.summary, notRun: 1 }, notRun: [{}] }],
    ["empty execution", { ...base, summary: { ...base.summary, totalRun: 0 } }],
    ["contradictory error count", { ...base, summary: { ...base.summary, errors: 1 } }],
    ["contradictory error list", { ...base, errors: [{}] }],
    ["errors despite VALID", { ...base, summary: { ...base.summary, errors: 1 }, errors: [{}] }],
    [
      "warnings requiring review",
      { ...base, summary: { ...base.summary, warnings: 1 }, warnings: [{}] },
    ],
    ["invalid counts", { ...base, summary: { ...base.summary, errors: -1 } }],
    ["wrong package name", { ...base, input: { ...base.input, name: "different.zip" } }],
    ["wrong package digest", { ...base, id: `qti3-sha256-${"0".repeat(64)}` }],
  ])("rejects %s", async (_name, reportValue) => {
    await withFiles(async (_root, report, packagePath, trustedReportSha256) => {
      expect(
        (await verifyQtiValidatorEvidence({ report, package: packagePath, trustedReportSha256 }))
          .status,
      ).toBe("rejected");
    }, reportValue);
  });

  it("rejects changed content and missing package scope", async () => {
    await withFiles(async (_root, report, packagePath, trustedReportSha256) => {
      expect((await verifyQtiValidatorEvidence({ report, trustedReportSha256 })).status).toBe(
        "rejected",
      );
      await writeFile(packagePath, "changed bytes");
      const result = await verifyQtiValidatorEvidence({
        report,
        package: packagePath,
        trustedReportSha256,
      });
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({ code: "certification.validator.artifactMismatch" }),
      );
    });
  });

  it("returns diagnostics for unreadable, oversized, empty, and malformed reports", async () => {
    await withFiles(async (root, report) => {
      expect((await verifyQtiValidatorEvidence({ report: root })).status).toBe("unavailable");
      expect((await verifyQtiValidatorEvidence({ report: join(root, "missing") })).status).toBe(
        "unavailable",
      );
      await writeFile(report, "");
      expect((await verifyQtiValidatorEvidence({ report })).status).toBe("unavailable");
      await writeFile(report, "{".repeat(8 * 1024 * 1024 + 1));
      expect((await verifyQtiValidatorEvidence({ report })).status).toBe("unavailable");
      await writeFile(report, "not JSON");
      expect((await verifyQtiValidatorEvidence({ report })).status).toBe("rejected");
    });
  });

  it("allows the required-evidence gate to pass without overriding a failed import row", async () => {
    await withFiles(
      async (root, validatorReport, validatorPackage, trustedValidatorReportSha256) => {
        await writeFile(join(root, "invalid.xml"), "<qti-assessment-item");
        const options = {
          qtiRoot: root,
          validatorReport,
          validatorPackage,
          trustedValidatorReportSha256,
          requireValidatorEvidence: true,
        };
        const criterion = {
          acId: "synthetic-rejection",
          featureId: "Q-2",
          label: "Reject invalid XML",
          sourcePath: "invalid.xml",
          expectation: "invalid-item",
          expectedDiagnosticCodes: ["xml.parse"],
        } as const;
        const passing = await runQti3BasicImportItemOnlyCertification({
          ...options,
          criteria: [criterion],
        });
        expect(passing).toMatchObject({
          ok: true,
          runScope: "selection",
          validatorEvidence: { status: "verified-pass" },
        });
        const failing = await runQti3BasicImportItemOnlyCertification({
          ...options,
          criteria: [{ ...criterion, expectation: "valid-item" }],
        });
        expect(failing).toMatchObject({
          ok: false,
          validatorEvidence: { status: "verified-pass" },
        });
      },
    );
  });
});
