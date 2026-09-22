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
  it.each([
    ["invalid ZIP item", "<broken", undefined, true],
    [
      "valid ZIP item with invalid loose XML",
      '<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="valid" title="Valid" time-dependent="false"><qti-item-body/></qti-assessment-item>',
      "<broken",
      false,
    ],
    ["missing ZIP item with invalid loose XML", undefined, "<broken", false],
  ])(
    "uses the package import result for %s omitted from its assessment",
    async (_name, zippedXml, looseXml, passes) => {
      const root = await mkdtemp(join(tmpdir(), "qti-negative-package-"));
      try {
        const files: Record<string, string> = {
          "imsmanifest.xml":
            '<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="inventory"><resources><resource identifier="test" type="imsqti_test_xmlv3p0" href="test.xml"><file href="test.xml"/></resource><resource identifier="item" type="imsqti_item_xmlv3p0" href="item.xml"><file href="item.xml"/></resource></resources></manifest>',
          "test.xml":
            '<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="test" title="Empty"><qti-test-part identifier="part" navigation-mode="linear" submission-mode="individual"><qti-assessment-section identifier="section" title="Empty" visible="true"/></qti-test-part></qti-assessment-test>',
        };
        if (zippedXml !== undefined) files["item.xml"] = zippedXml;
        await writeFile(join(root, "bank.zip"), createStoredZip(files));
        if (looseXml !== undefined) await writeFile(join(root, "item.xml"), looseXml);
        const report = await runQti3BasicImportItemOnlyCertification({
          qtiRoot: root,
          criteria: [
            {
              acId: "synthetic-invalid",
              featureId: "synthetic",
              label: "Invalid XML is diagnosed in the package",
              packagePath: "bank.zip",
              sourcePath: "item.xml",
              expectation: "invalid-item",
              expectedDiagnosticCodes: ["xml.parse"],
            },
          ],
        });
        expect(report.ok).toBe(passes);
        expect(report.rows[0]?.status).toBe(passes ? "passed" : "failed");
        if (passes) {
          expect(report.packages[0]?.diagnostics).toContainEqual(
            expect.objectContaining({
              code: "xml.parse",
              path: "bank.zip/item.xml",
              severity: "error",
            }),
          );
          expect(report.rows[0]?.diagnostics).toContainEqual(
            expect.objectContaining({ code: "xml.parse", path: "item.xml", severity: "error" }),
          );
        }
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );

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
