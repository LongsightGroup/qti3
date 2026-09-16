import { expect, test } from "@playwright/test";
import { adaptiveFixtures } from "../../packages/fixtures/src/index.js";
import { loadFixture, suspendRestoreCurrentAttempt } from "./player-helpers.js";
import { expectNoAxeViolationsOnPlayer } from "./axe-helpers.js";

test.describe("adaptive fixtures", () => {
  test("planning hints reveal help without awarding credit or completing the answer", async ({
    page,
  }) => {
    await page.goto("/");
    await loadFixture(page, "endAttempt");
    const player = page.locator("qti-assessment-item-player");
    const hint = player.getByRole("button", { name: "Show planning hint" });
    await hint.focus();
    await page.keyboard.press("Enter");
    let state = await player.evaluate((element) => element.serialize());
    expect(state.responses.HINT).toBe(true);
    expect(state.outcomes).toMatchObject({ SCORE: 0, completionStatus: "incomplete" });
    expect(state.status).toBe("interacting");
    await expect(player.locator(".qti3-feedback-block")).toContainText(
      "Compare how wetland soil and pavement",
    );
    await expect(player.locator(".qti3-feedback-block")).toBeVisible();
    await expectNoAxeViolationsOnPlayer(page);
    await suspendRestoreCurrentAttempt(page);
    await expect(player.locator(".qti3-feedback-block")).toBeVisible();
    await player.locator('[data-choice-identifier="B"] input').check();
    await page.locator("#debug-score").click();
    state = await player.evaluate((element) => element.serialize());
    expect(state.outcomes.SCORE).toBe(0);
    expect(state.status).toBe("interacting");
    await player.locator('[data-choice-identifier="A"] input').check();
    await page.locator("#debug-score").click();
    state = await player.evaluate((element) => element.serialize());
    expect(state.outcomes.SCORE).toBe(1);
    expect(state.status).toBe("completed");
  });

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
      "A student is revising a claim about an ecosystem",
    );
    await page.getByRole("button", { name: "Show hint" }).click();
    await expect(page.locator("qti-assessment-item-player .qti3-feedback-block")).toContainText(
      "Compare the rows with the lowest plant cover",
    );
  });
});
