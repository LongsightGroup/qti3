import { basename, join } from "node:path";
import { expect, test } from "@playwright/test";
import { basicImportItemOnlyCriteria } from "../../packages/conformance/src/basic-import-items.js";

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
      await page.goto("/library.html");
      await page
        .getByLabel("Import package", { exact: true })
        .setInputFiles(join(externalDir, packagePath));
      const status = page.getByRole("status", { name: "Package library status" });
      if (invalidItems.length) {
        await expect(status).toContainText("Package import failed. Nothing was saved.");
        await expect(page.locator("#library-diagnostics")).toBeVisible();
        for (const item of invalidItems) {
          await expect(page.locator("#library-diagnostics")).toContainText(
            basename(item.sourcePath),
          );
          for (const code of item.expectedDiagnosticCodes ?? []) {
            await expect(page.locator("#library-diagnostics")).toContainText(code);
          }
        }
        await expect(page.locator("#saved-packages option")).toHaveCount(1);
        await expect(
          page.getByRole("button", { name: "Submit response", exact: true }),
        ).toBeDisabled();
        await page.reload();
        await expect(status).toContainText("No saved packages.");
      } else {
        await expect(status).toContainText(`Saved ${basename(packagePath)}. Reopened`);
        const id = await page.getByLabel("Saved package", { exact: true }).inputValue();
        const questionCount = await page.locator("#package-items option").count();
        expect(questionCount).toBeGreaterThan(0);
        const xml = await page.locator("#item-source").textContent();
        await page.reload();
        await page.getByLabel("Saved package", { exact: true }).selectOption(id);
        await expect(status).toContainText(`Opened ${basename(packagePath)} from the database.`);
        await expect(page.locator("#package-items option")).toHaveCount(questionCount);
        expect(await page.locator("#item-source").textContent()).toBe(xml);
      }
    });
  }
}
