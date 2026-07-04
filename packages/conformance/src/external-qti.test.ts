import { describe, expect, it } from "vitest";
import {
  runQti3BasicImportItemOnlyCertification,
  runQti3BasicImportTestCertification,
} from "./index.js";

const externalDir = process.env.QTI3_EXTERNAL_QTI_DIR;
const requireExternal = process.env.QTI3_REQUIRE_EXTERNAL === "1";
const validatorReport = process.env.QTI3_EXTERNAL_VALIDATOR_REPORT;
const hasExternalDir = Boolean(externalDir);

describe("@longsightgroup/qti3-conformance external QTI directory", () => {
  it.runIf(requireExternal)("requires official external conformance content", () => {
    expect(externalDir).toBeTruthy();
  });

  it.runIf(hasExternalDir)(
    "runs Basic IMPORT item-only certification evidence against QTI3_EXTERNAL_QTI_DIR",
    async () => {
      const report = await runQti3BasicImportItemOnlyCertification({
        qtiRoot: externalDir!,
        validatorReport,
      });

      expect(report.checked).toBeGreaterThan(0);
      expect(report.rows.filter((row) => row.status === "failed")).toEqual([]);
      expect(report.ok).toBe(true);
    },
  );

  it.runIf(hasExternalDir)(
    "runs Basic IMPORT test certification evidence against QTI3_EXTERNAL_QTI_DIR",
    async () => {
      const report = await runQti3BasicImportTestCertification({
        qtiRoot: externalDir!,
      });

      expect(report.checked).toBe(4);
      expect(report.rows.filter((row) => row.status === "failed")).toEqual([]);
      expect(report.ok).toBe(true);
    },
  );
});
