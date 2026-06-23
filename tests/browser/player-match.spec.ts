import { expect, test } from "@playwright/test";
import { assignMatch, expectResponse, loadFixture } from "./player-helpers.js";

test.describe("player match interactions", () => {
  test("creates match pairs", async ({ page }) => {
    await page.goto("/");

    await loadFixture(page, "match");
    await expect(page.locator("qti-assessment-item-player .qti3-match-selector")).toBeVisible();
    await expect(page.locator("qti-assessment-item-player .qti3-pair-selector")).toHaveCount(0);
    await expect(page.locator("qti-assessment-item-player .qti3-match-source-bank")).toContainText(
      "Response declaration",
    );
    await expect(page.locator("qti-assessment-item-player .qti3-match-source")).toHaveCount(3);
    await expect(page.locator("qti-assessment-item-player .qti3-match-target")).toHaveCount(3);
    const matchStyles = await page.locator("qti-assessment-item-player").evaluate((player) => {
      const source = player.querySelector<HTMLElement>(".qti3-match-source");
      const target = player.querySelector<HTMLElement>(".qti3-match-target");
      if (!source || !target) throw new Error("Missing match source or target.");
      const sourceStyle = getComputedStyle(source);
      const targetStyle = getComputedStyle(target);
      return {
        sourceBackground: sourceStyle.backgroundColor,
        sourceBorder: sourceStyle.borderColor,
        sourceColor: sourceStyle.color,
        targetBackground: targetStyle.backgroundColor,
        targetBorder: targetStyle.borderColor,
        targetWeight: Number(targetStyle.fontWeight),
      };
    });
    expect(matchStyles.sourceBorder).toBe(matchStyles.sourceColor);
    expect(matchStyles.targetBorder).not.toBe(matchStyles.sourceBorder);
    expect(matchStyles.targetBackground).not.toBe(matchStyles.sourceBackground);
    expect(matchStyles.targetWeight).toBeGreaterThanOrEqual(600);
    await assignMatch(page, "A", "G1");
    await expectResponse(page, ["A G1"]);
    await expect(
      page.locator("qti-assessment-item-player .qti3-pair-chip span").first(),
    ).toHaveText("Response declaration to Candidate response value");
  });
});
