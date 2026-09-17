import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeQti3PackageZip } from "@longsightgroup/qti3-writer";
import { describe, expect, it } from "vitest";
import { runQti3BasicImportItemOnlyCertification } from "./basic-import-items.js";

const assetBytes = new Uint8Array([137, 80, 78, 71]);
const xml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="asset" title="Synthetic resource" time-dependent="false"><qti-response-declaration identifier="R" cardinality="single" base-type="string"/><qti-item-body><img src="image.png" alt="Synthetic image"/><qti-extended-text-interaction response-identifier="R"/></qti-item-body></qti-assessment-item>`;

describe("package resource evidence", () => {
  it.each(["preserved", "changed", "missing"])(
    "checks %s resource bytes through real ZIP import",
    async (state) => {
      const root = await mkdtemp(join(tmpdir(), "qti-assets-"));
      try {
        await mkdir(join(root, "bank"));
        await writeFile(
          join(root, "bank/items.zip"),
          writeQti3PackageZip({
            identifier: "synthetic-assets",
            items: [
              {
                kind: "xml",
                path: "item.xml",
                identifier: "asset",
                xml,
                assets: [{ path: "image.png", data: assetBytes }],
              },
            ],
          }),
        );
        if (state !== "missing")
          await writeFile(
            join(root, "bank/image.png"),
            state === "preserved" ? assetBytes : new Uint8Array([0]),
          );
        const report = await runQti3BasicImportItemOnlyCertification({
          qtiRoot: root,
          criteria: [
            {
              acId: "synthetic-assets",
              featureId: "A-1",
              label: "Preserve image asset",
              packagePath: "bank/items.zip",
              sourcePath: "bank/item.xml",
              expectation: "stores-alt-text",
            },
          ],
        });
        expect(report.ok).toBe(state === "preserved");
        expect(report.packages[0]?.assets[0]).toMatchObject({
          href: "image.png",
          referencedBy: expect.arrayContaining(["item.xml"]),
          ok: state === "preserved",
        });
        if (state !== "preserved")
          expect(report.rows[0]?.diagnostics).toContainEqual(
            expect.objectContaining({ code: "certification.package.assetPreservation" }),
          );
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );
});
