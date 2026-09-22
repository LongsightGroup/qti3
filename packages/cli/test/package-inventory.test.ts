import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createStoredZip } from "../../../tests/fixtures/package-zip.js";
import { runCliJson } from "./cli-harness.js";

it.each([
  [
    "valid",
    '<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item" title="Item" time-dependent="false"><qti-item-body/></qti-assessment-item>',
    0,
  ],
  ["invalid", "<broken", 1],
])(
  "validates a %s manifest item omitted from the convenience assessment",
  async (_name, xml, exitCode) => {
    const root = await mkdtemp(join(tmpdir(), "qti3-cli-inventory-"));
    try {
      const path = join(root, "package.zip");
      await writeFile(
        path,
        createStoredZip({
          "imsmanifest.xml":
            '<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="package"><resources><resource identifier="test" type="imsqti_test_xmlv3p0" href="test.xml"/><resource identifier="item" type="imsqti_item_xmlv3p0" href="item.xml"/></resources></manifest>',
          "test.xml":
            '<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="test" title="Empty"><qti-test-part identifier="part" navigation-mode="linear" submission-mode="individual"><qti-assessment-section identifier="section" title="Empty" visible="true"/></qti-test-part></qti-assessment-test>',
          "item.xml": xml,
        }),
      );
      const { code, report } = await runCliJson(["validate-package", path]);
      expect(code).toBe(exitCode);
      expect(report).toMatchObject({
        checked: 1,
        failed: exitCode,
        discoveredReferences: ["item.xml"],
        packageDiagnostics: [],
        results: [
          expect.objectContaining({ file: "item.xml", source: "manifest", ok: exitCode === 0 }),
        ],
      });
      if (exitCode)
        expect(report.results[0]?.diagnostics).toContainEqual(
          expect.objectContaining({ code: "xml.parse", path: "item.xml" }),
        );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
