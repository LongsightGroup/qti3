import { basename, join } from "node:path";
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { expect, test } from "@playwright/test";
import { basicImportItemOnlyCriteria } from "../../packages/conformance/src/basic-import-items.js";
import { parseQtiPackage } from "../../packages/core/src/index.js";

// Only run locally with member-authorized inputs; public CI uses synthetic equivalents.
const externalDir = process.env.QTI3_EXTERNAL_QTI_DIR;
if (externalDir) {
  const packagePaths = new Set(
    basicImportItemOnlyCriteria.flatMap((criterion) =>
      criterion.origin !== "synthetic" && criterion.packagePath ? [criterion.packagePath] : [],
    ),
  );
  for (const packagePath of packagePaths) {
    const invalidItems = basicImportItemOnlyCriteria.filter(
      (criterion) =>
        criterion.packagePath === packagePath && criterion.expectation === "invalid-item",
    );
    test(`official library import: ${basename(packagePath)}`, async ({ page }) => {
      test.setTimeout(60_000);
      const inputPath = join(externalDir, packagePath);
      const parsed = parseQtiPackage(readFileSync(inputPath), {
        inflateRaw: (bytes) => inflateRawSync(bytes),
      });
      const accepted = parsed.items.filter(
        (item) =>
          item.document && !item.diagnostics.some((diagnostic) => diagnostic.severity === "error"),
      );
      expect(accepted.length).toBeGreaterThan(0);
      expect(parsed.ok).toBe(invalidItems.length === 0);
      await page.goto("/library.html");
      await page.getByLabel("Import package", { exact: true }).setInputFiles(inputPath);
      const status = page.getByRole("status", { name: "Package library status" });
      await expect(status).toContainText(`Saved ${basename(packagePath)}. Reopened`);
      await expect(page.locator("#package-items option")).toHaveCount(accepted.length);
      if (invalidItems.length) {
        await expect(status).toContainText(`Rejected ${invalidItems.length} question`);
        await expect(page.locator("#library-diagnostics")).toBeVisible();
        for (const item of invalidItems) {
          await expect(page.locator("#library-diagnostics")).toContainText(
            basename(item.sourcePath),
          );
          for (const code of item.expectedDiagnosticCodes ?? []) {
            await expect(page.locator("#library-diagnostics")).toContainText(code);
          }
        }
      }
      const id = await page.getByLabel("Saved package", { exact: true }).inputValue();
      await page.reload();
      await page.getByLabel("Saved package", { exact: true }).selectOption(id);
      await expect(status).toContainText(`Opened ${basename(packagePath)} from the database.`);
      await expect(page.locator("#package-items option")).toHaveCount(accepted.length);
      if (invalidItems.length) {
        await expect(status).toContainText(`Rejected ${invalidItems.length} question`);
        await expect(page.locator("#library-diagnostics")).toBeVisible();
      }
      for (const [index, item] of accepted.entries()) {
        await page.getByLabel("Question", { exact: true }).selectOption(String(index));
        expect(await page.locator("#item-source").textContent()).toBe(item.xml);
        await expect(page.locator("#question-title")).toHaveText(item.title ?? "Question");
        await expect(
          page.getByRole("button", { name: "Submit response", exact: true }),
        ).toBeEnabled();
      }
      for (const item of invalidItems) {
        await expect(page.locator("#library-diagnostics")).toContainText(basename(item.sourcePath));
        await expect(page.locator("#package-items")).not.toContainText(basename(item.sourcePath));
      }
    });
  }
}
