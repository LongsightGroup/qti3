import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  createItemPackageZip,
  qtiAssessmentTestResource,
  qtiItemResource,
} from "./player-helpers.js";
import { installAxe } from "./axe-helpers.js";

const itemXml = readFileSync(
  "packages/fixtures/packages/basic-item-player/valid-item-only/items/choice.xml",
  "utf8",
);
const testXml =
  '<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="test" title="Subset"><qti-test-part identifier="part" navigation-mode="linear" submission-mode="individual"><qti-assessment-section identifier="section" title="Section" visible="true"><qti-assessment-item-ref identifier="selected" href="selected.xml"/></qti-assessment-section></qti-test-part></qti-assessment-test>';

function mixedPackage(extraXml: string): Buffer {
  return createItemPackageZip({
    resources: [
      qtiItemResource("extra", "extra.xml"),
      qtiItemResource("selected", "selected.xml"),
      qtiAssessmentTestResource("test", "test.xml"),
    ],
    files: { "extra.xml": extraXml, "selected.xml": itemXml, "test.xml": testXml },
  });
}

for (const [defect, xml, code] of [
  ["unterminated declaration", '<?xml version="1.0"?', "xml.parse"],
  ["wrong namespace", itemXml.replaceAll("imsqtiasi_v3p0", "imsqti_v2p2"), "qti.root"],
  ["trailing content", `${itemXml}stray text`, "xml.parse"],
] as const) {
  test(`rejects an unreferenced manifest item with ${defect} before saving`, async ({ page }) => {
    await page.goto("/library.html");
    await page
      .getByLabel("Import package", { exact: true })
      .setInputFiles({ name: "mixed.zip", mimeType: "application/zip", buffer: mixedPackage(xml) });
    await expect(page.getByRole("status", { name: "Package library status" })).toContainText(
      "Package import failed. Nothing was saved.",
    );
    await expect(page.locator("#library-diagnostics")).toBeVisible();
    await expect(page.locator("#library-diagnostics")).toContainText(code);
    await expect(page.locator("#library-diagnostics")).toContainText("extra.xml");
    await expect(page.locator("#saved-packages option")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Submit response", exact: true })).toBeDisabled();
    await expect(page.getByRole("radio")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("status", { name: "Package library status" })).toContainText(
      "No saved packages.",
    );
  });
}

test("reopening an older saved package revalidates every manifest item without deleting it", async ({
  page,
}) => {
  await page.goto("/library.html");
  const zip = mixedPackage(`${itemXml}stray text`);
  // Seed a record saved by the old importer through the actual storage API.
  const saved = await page.evaluate(
    async (bytes) => {
      const packagePath = "/src/package-library/browser-package.ts";
      const storePath = "/src/package-library/store.ts";
      const extracted = await (
        await import(/* @vite-ignore */ packagePath)
      ).readBrowserPackageZip(new Uint8Array(bytes));
      if (!extracted.ok) return extracted;
      return (await import(/* @vite-ignore */ storePath)).savePackage({
        id: "previous-import",
        title: "Previous import",
        filename: "old.zip",
        importedAt: "2026-09-17T12:00:00Z",
        entries: extracted.entries,
      });
    },
    [...zip],
  );
  expect(saved.ok).toBe(true);
  await page.reload();
  await page.getByLabel("Saved package", { exact: true }).selectOption("previous-import");
  await expect(page.getByRole("status", { name: "Package library status" })).toContainText(
    "Saved package failed validation and was not opened.",
  );
  await expect(page.locator("#library-diagnostics")).toBeVisible();
  await expect(page.locator("#library-diagnostics")).toContainText("extra.xml");
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Submit response", exact: true })).toBeDisabled();
  await expect(page.locator("#saved-packages option")).toHaveCount(2);
  await installAxe(page);
  expect(
    await page.evaluate(async () => {
      if (!window.axe) throw new Error("axe unavailable");
      return (await window.axe.run(document.documentElement)).violations;
    }),
  ).toEqual([]);
});

test("retains a good saved package after a rejected import and includes valid extra items", async ({
  page,
}) => {
  await page.goto("/library.html");
  await page.getByLabel("Import package", { exact: true }).setInputFiles({
    name: "good.zip",
    mimeType: "application/zip",
    buffer: mixedPackage(itemXml.replaceAll("basic-choice", "extra-choice")),
  });
  await expect(page.getByRole("status", { name: "Package library status" })).toContainText(
    "Reopened 2 questions",
  );
  await expect(page.locator("#package-items option").first()).toContainText("selected.xml");
  await page.getByLabel("Question", { exact: true }).selectOption("1");
  await expect(page.locator("#item-source")).toContainText('identifier="extra-choice"');
  const id = await page.getByLabel("Saved package", { exact: true }).inputValue();
  await page.getByLabel("Import package", { exact: true }).setInputFiles({
    name: "bad.zip",
    mimeType: "application/zip",
    buffer: mixedPackage("<broken"),
  });
  await expect(page.getByRole("status", { name: "Package library status" })).toContainText(
    "Nothing was saved.",
  );
  await expect(page.locator("#saved-packages option")).toHaveCount(2);
  await page.reload();
  await page.getByLabel("Saved package", { exact: true }).selectOption(id);
  await expect(page.getByRole("status", { name: "Package library status" })).toContainText(
    "Opened good.zip",
  );
  await expect(page.locator("#package-items option")).toHaveCount(2);
});
