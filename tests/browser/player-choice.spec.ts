import { expect, test } from "@playwright/test";
import { interactionFixtures } from "../../packages/fixtures/src/index.js";
import { loadFixture, pasteXml } from "./player-helpers.js";

test.describe("player choice interactions", () => {
  test("renders item-body prompts before interactions", async ({ page }) => {
    const fixture =
      interactionFixtures.find((item) => item.interactionType === "choice") ??
      interactionFixtures[0];
    if (!fixture) throw new Error("Missing choice fixture.");
    const xml = fixture.xml.replace(
      "<p>Select one answer from a standard single-choice interaction.</p>",
      "<qti-prompt>Which president resigned after Watergate?</qti-prompt>",
    );

    await page.goto("/");
    await pasteXml(page, xml);

    const player = page.locator("qti-assessment-item-player");
    await expect(player.locator(".qti3-item-prompt")).toHaveText(
      "Which president resigned after Watergate?",
    );
    await expect(player.locator('[data-choice-identifier="A"] input[type="radio"]')).toBeVisible();
  });

  test("renders choice options as a vertical list", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "choice");

    const options = page.locator("qti-assessment-item-player .qti3-choice-option");
    const first = await options.nth(0).boundingBox();
    const second = await options.nth(1).boundingBox();
    if (!first || !second) throw new Error("Missing choice option boxes.");

    expect(second.y).toBeGreaterThan(first.y + first.height - 1);
    await expect(options.nth(0).locator(".qti3-choice-label")).toHaveText("A.");
    await expect(options.nth(1).locator(".qti3-choice-label")).toHaveText("B.");

    const firstControl = await options.nth(0).locator("input").boundingBox();
    const firstLabel = await options.nth(0).locator(".qti3-choice-label").boundingBox();
    const firstText = await options.nth(0).locator(".qti3-choice-text").boundingBox();
    if (!firstControl || !firstLabel || !firstText) throw new Error("Missing choice layout boxes.");
    expect(firstControl.x).toBeLessThan(firstLabel.x);
    expect(firstLabel.x).toBeLessThan(firstText.x);
  });
});
