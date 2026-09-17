import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { QtiDiagnostic } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import { createStoredZip } from "../../../tests/fixtures/package-zip.js";
import {
  collectImportableItemHrefs,
  parseOfficialQtiPackage,
  scopePackageDiagnostics,
} from "./certification-package.js";
import { runQti3BasicImportItemOnlyCertification } from "./index.js";

describe("certification diagnostic locations", () => {
  it("keeps only errors and scopes source-only XML locations without duplicate slashes", () => {
    const error: QtiDiagnostic = {
      code: "item.invalid",
      severity: "error",
      message: "Invalid item.",
      source: { line: 3, column: 2, offset: 15, path: "/qti-assessment-item" },
    };
    const diagnostics: readonly QtiDiagnostic[] = [
      { ...error, severity: "info" },
      error,
      { ...error, severity: "warning" },
    ];
    expect(scopePackageDiagnostics(diagnostics, "bank.zip")).toEqual([
      {
        ...error,
        path: "bank.zip/qti-assessment-item",
        source: { ...error.source, path: "bank.zip/qti-assessment-item" },
      },
    ]);
  });

  it("preserves item-file locations for importability failures", () => {
    const parsed = parseOfficialQtiPackage(invalidItemPackage());
    const diagnostics: QtiDiagnostic[] = [];
    const importable = collectImportableItemHrefs(
      parsed.items,
      ["item.xml"],
      "bank.zip",
      diagnostics,
    );
    expect(importable.size).toBe(0);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "assessmentItem.title.required",
        path: "bank.zip/item.xml",
        source: expect.objectContaining({ path: "bank.zip/item.xml", line: 1 }),
      }),
    );
  });

  it("aligns package evidence paths and source paths in item-only reports", async () => {
    const root = await mkdtemp(join(tmpdir(), "qti-diagnostic-path-"));
    try {
      await writeFile(join(root, "bank.zip"), invalidItemPackage());
      const report = await runQti3BasicImportItemOnlyCertification({
        qtiRoot: root,
        criteria: [
          {
            acId: "synthetic-invalid-title",
            featureId: "synthetic",
            label: "Missing item title",
            packagePath: "bank.zip",
            sourcePath: "item.xml",
            expectation: "invalid-item",
            expectedDiagnosticCodes: ["assessmentItem.title.required"],
          },
        ],
      });
      expect(report.packages[0]?.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "assessmentItem.title.required",
          path: "bank.zip/item.xml/qti-assessment-item",
          source: expect.objectContaining({
            path: "bank.zip/item.xml/qti-assessment-item",
            line: 1,
          }),
        }),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

function invalidItemPackage(): Uint8Array {
  return createStoredZip({
    "imsmanifest.xml":
      '<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="synthetic"><resources><resource identifier="item" type="imsqti_item_xmlv3p0" href="item.xml"><file href="item.xml"/></resource></resources></manifest>',
    "item.xml":
      '<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item" time-dependent="false"><qti-item-body/></qti-assessment-item>',
  });
}
