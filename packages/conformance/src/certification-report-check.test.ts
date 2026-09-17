import { describe, expect, it } from "vitest";
import {
  runQti3BasicImportItemOnlyCertification,
  type QtiBasicImportItemOnlyCertificationReport,
} from "./basic-import-items.js";
import { checkQti3BasicImportReport } from "./certification-report-check.js";

async function comparisonFixture(): Promise<QtiBasicImportItemOnlyCertificationReport> {
  const report = await runQti3BasicImportItemOnlyCertification({
    qtiRoot: "/nonexistent-certification-fixture",
    criteria: [],
  });
  // This comparison fixture tests the saved-report boundary. Real readiness is exercised by the external gate.
  return { ...report, automatedEvidenceReady: true };
}

describe("saved certification report check", () => {
  it("compares serialized evidence while ignoring collection time and machine location", async () => {
    const current = await comparisonFixture();
    const saved = {
      ...current,
      qtiRoot: "/another/checkout",
      identity: {
        ...current.identity,
        collectedAt: "different time",
        environment: { node: "other", platform: "other", arch: "other" },
      },
    };
    expect(checkQti3BasicImportReport(JSON.parse(JSON.stringify(saved)), current)).toEqual({
      ok: true,
      diagnostics: [],
    });
  });
  it("refuses to approve evidence when the fresh run is not ready", async () => {
    const current = { ...(await comparisonFixture()), automatedEvidenceReady: false };
    expect(checkQti3BasicImportReport(current, current).diagnostics).toContainEqual(
      expect.objectContaining({ code: "certification.report.currentNotReady" }),
    );
  });
  it("rejects mismatched source, code, scope, rows, and package hashes", async () => {
    const current = await comparisonFixture();
    const changes: readonly unknown[] = [
      { ...current, schemaVersion: 2 },
      { ...current, targetLevel: "Advanced" },
      { ...current, runScope: "selection-relabelled" },
      { ...current, rows: [{ status: "passed" }] },
      { ...current, packages: [{ packagePath: "other.zip", sha256: "changed" }] },
      { ...current, coverage: { ...current.coverage, rows: current.coverage.rows.slice(1) } },
      {
        ...current,
        identity: {
          ...current.identity,
          source: { ...current.identity.source, workbookSha256: "changed" },
        },
      },
      {
        ...current,
        identity: {
          ...current.identity,
          producer: { ...current.identity.producer, revision: "old-commit" },
        },
      },
      {
        ...current,
        identity: {
          ...current.identity,
          producer: { ...current.identity.producer, runtimeSha256: "old-build" },
        },
      },
    ];
    for (const saved of changes) expect(checkQti3BasicImportReport(saved, current).ok).toBe(false);
  });
});
