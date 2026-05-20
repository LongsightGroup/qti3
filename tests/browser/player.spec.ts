import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { expect, test } from "@playwright/test";
import { interactionFixtures } from "../../packages/fixtures/src/index.js";

const require = createRequire(import.meta.url);

test.describe("manual harness", () => {
  test("loads every reference interaction fixture without axe violations", async ({ page }) => {
    await page.goto("/");
    const axeSource = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");

    for (const fixture of interactionFixtures) {
      await page.locator("#fixture").selectOption(fixture.id);
      await page.locator("#load-fixture").click();
      await expect(page.locator("qti-assessment-item-player")).toContainText(fixture.id);
      await expect(
        page.locator(`[data-interaction-type="${fixture.interactionType}"]`),
      ).toBeVisible();

      await page.addScriptTag({ content: axeSource });
      const result = await page.evaluate(async () => {
        return await window.axe.run(document.querySelector("qti-assessment-item-player"));
      });
      expect(result.violations, fixture.id).toEqual([]);
    }
  });

  test("accepts pasted QTI XML and emits score state", async ({ page }) => {
    const fixture =
      interactionFixtures.find((item) => item.interactionType === "choice") ??
      interactionFixtures[0];
    if (!fixture) throw new Error("Missing choice fixture.");

    await page.goto("/");
    await page.locator("#xml").fill(fixture.xml);
    await page.locator("#load-xml").click();
    await page.getByRole("checkbox", { name: "A" }).check();
    await page.getByRole("button", { name: "Score" }).click();
    await expect(page.locator("#events")).toContainText("qti3.attempt-state.v1");
  });
});

declare global {
  interface Window {
    axe: {
      run: (context: Element | null) => Promise<{ violations: unknown[] }>;
    };
  }
}
