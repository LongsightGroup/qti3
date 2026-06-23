import { expect, test } from "@playwright/test";
import { adaptiveFixtures } from "../../packages/fixtures/src/index.js";

test.describe("adaptive fixtures", () => {
  test("loads adaptive canonical fixture from the picker", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("#fixture optgroup[label='Adaptive references']")).toHaveCount(1);

    const adaptiveFixture = adaptiveFixtures.find(
      (fixture) => fixture.id === "adaptive-feedback-reference",
    );
    if (!adaptiveFixture) throw new Error("Missing canonical fixtures.");

    await page.locator("#fixture").selectOption(adaptiveFixture.id);
    await page.locator("#load-fixture").click();
    await expect(page.locator("qti-assessment-item-player")).toContainText(
      "Use the hint control or answer the item.",
    );
    await page.getByRole("button", { name: "Show hint" }).click();
    await expect(page.locator("qti-assessment-item-player .qti3-feedback-block")).toContainText(
      "Hint feedback is visible",
    );
  });
});
