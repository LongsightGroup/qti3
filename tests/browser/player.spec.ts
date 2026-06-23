import { expect, test } from "@playwright/test";
import { interactionFixtures } from "../../packages/fixtures/src/index.js";
import { loadFixture, pasteXml } from "./player-helpers.js";

test.describe("player smoke", () => {
  test("accepts pasted QTI XML and emits score state", async ({ page }) => {
    const fixture =
      interactionFixtures.find((item) => item.interactionType === "choice") ??
      interactionFixtures[0];
    if (!fixture) throw new Error("Missing choice fixture.");

    await page.goto("/");
    await pasteXml(page, fixture.xml);
    await page.locator('qti-assessment-item-player [data-choice-identifier="A"] input').check();
    await page.locator("#debug-score").click();
    await expect(page.locator("#events")).toContainText("qti3.attempt-state.v1");
    await expect(page.locator("#score-panel")).toHaveAttribute("data-status", "scored");
    await expect(page.locator("#score-status")).toHaveText("Scored successfully.");
    await expect(page.locator("#score-value")).toHaveText("1");
    await expect(page.locator("#score-details")).toContainText('"SCORE": 1');
  });
  test("updates manual harness debug panels and action log", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "choice");

    await expect(page.locator("#debug-state")).toContainText("qti3.attempt-state.v1");
    await expect(page.locator("#debug-responses")).toHaveText("{}");
    await page.locator('qti-assessment-item-player [data-choice-identifier="A"] input').check();
    await expect(page.locator("#debug-responses")).toContainText('"RESPONSE": "A"');
    await expect(page.locator("#debug-action-log")).toContainText("qti-responsechange");

    await page.locator("#debug-score").click();
    await expect(page.locator("#debug-outcomes")).toContainText('"SCORE": 1');
    await expect(page.locator("#debug-validation")).toHaveText("[]");
    await expect(page.locator("#debug-action-log")).toContainText("qti-score");

    await page.locator("#debug-suspend").click();
    await expect(page.locator("#debug-state")).toContainText('"status": "suspended"');
    await page.locator("#debug-end").click();
    await expect(page.locator("#debug-state")).toContainText('"status": "completed"');
    await page.locator("#debug-reset").click();
    await expect(page.locator("#debug-state")).toContainText('"status": "initialized"');
  });
});
