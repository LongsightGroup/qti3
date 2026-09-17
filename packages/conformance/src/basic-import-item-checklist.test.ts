import { describe, expect, it } from "vitest";
import {
  basicImportItemOnlyCriteria,
  type QtiCertificationReportRow,
} from "./basic-import-items.js";
import {
  basicImportItemChecklist,
  evaluateBasicImportItemChecklist,
} from "./basic-import-item-checklist.js";

function passingResults(): QtiCertificationReportRow[] {
  return basicImportItemOnlyCriteria.map((entry) => ({
    ...entry,
    status: "passed",
    diagnostics: [],
  }));
}

describe("Basic IMPORT worksheet coverage", () => {
  it("keeps all 69 physical rows and their duplicate authored IDs", () => {
    const coverage = evaluateBasicImportItemChecklist(
      passingResults(),
      basicImportItemOnlyCriteria,
    );
    expect(coverage).toMatchObject({
      complete: true,
      required: 69,
      exercised: 69,
      passed: 69,
      failed: 0,
      missing: 0,
      diagnostics: [],
    });
    expect(new Set(coverage.rows.map((row) => row.key)).size).toBe(69);
    expect(new Set(coverage.rows.map((row) => row.originalAcId)).size).toBe(66);
    expect(
      coverage.rows.filter((row) => row.originalAcId === "Q2-L1-I1").map((row) => row.row),
    ).toEqual([6, 10]);
    expect(coverage.supplementalCaseIds).toEqual(["Q2-L1-I14", "Q20-L1-I11"]);
  });

  it("maps class requirements and spelling aliases without rewriting workbook IDs", () => {
    expect(basicImportItemChecklist.find((row) => row.row === 33)).toMatchObject({
      originalAcId: "Q2-L1-I202",
      caseIds: ["Q2-L1-I204"],
    });
    expect(basicImportItemChecklist.find((row) => row.row === 52)).toMatchObject({
      originalAcId: "Q5-L1-101",
      caseIds: ["Q5-L1-I101"],
    });
    expect(basicImportItemChecklist.find((row) => row.row === 10)?.caseIds).toEqual([
      "Q2-L1-I1",
      "Q2-L1-I11",
    ]);
  });

  it("does not count a missing requirement or an empty selection as complete", () => {
    const coverage = evaluateBasicImportItemChecklist(
      passingResults().filter((row) => row.acId !== "Q20-L1-I2"),
      basicImportItemOnlyCriteria,
    );
    expect(coverage).toMatchObject({ complete: false, missing: 1, exercised: 68 });
    expect(coverage.rows.find((row) => row.row === 58)?.status).toBe("missing");
    expect(evaluateBasicImportItemChecklist([], basicImportItemOnlyCriteria)).toMatchObject({
      complete: false,
      missing: 69,
      exercised: 0,
    });
  });

  it("rejects duplicate and unknown evidence IDs", () => {
    const results = passingResults();
    const first = results[0];
    if (!first) throw new Error("Missing test definition");
    const coverage = evaluateBasicImportItemChecklist(
      [...results, first, { ...first, acId: "unknown" }],
      basicImportItemOnlyCriteria,
    );
    expect(coverage.complete).toBe(false);
    expect(coverage.diagnostics.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "certification.coverage.duplicateCase",
        "certification.coverage.unknownCase",
      ]),
    );
    expect(coverage.rows[0]?.status).toBe("missing");
  });

  it("rejects replacing a required case with a weaker passing case under the same ID", () => {
    const coverage = evaluateBasicImportItemChecklist(
      passingResults().map((entry) =>
        entry.acId === "Q20-L1-I2" ? { ...entry, expectation: "valid-item" } : entry,
      ),
      basicImportItemOnlyCriteria,
    );
    expect(coverage).toMatchObject({ complete: false, missing: 1 });
  });

  it("distinguishes complete execution from successful evidence", () => {
    const coverage = evaluateBasicImportItemChecklist(
      passingResults().map((entry) =>
        entry.acId === "I9-L1-I2" ? { ...entry, status: "failed" } : entry,
      ),
      basicImportItemOnlyCriteria,
    );
    expect(coverage).toMatchObject({ complete: true, exercised: 69, passed: 68, failed: 1 });
    expect(coverage.rows.find((row) => row.row === 5)?.status).toBe("failed");
  });
});
