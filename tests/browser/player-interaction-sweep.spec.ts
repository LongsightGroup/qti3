import { expect, test } from "@playwright/test";
import { interactionFixtures } from "../../packages/fixtures/src/index.js";
import { provideResponse } from "./player-helpers.js";
import { expectNoAxeViolationsOnPlayer } from "./axe-helpers.js";

test.describe("player interaction sweep", () => {
  test("captures and scores every reference interaction fixture", async ({ page }) => {
    await page.goto("/");

    for (const fixture of interactionFixtures) {
      await page.locator("#fixture").selectOption(fixture.id);
      await page.locator("#load-fixture").click();

      const attempt = fixture.attempts[0];
      if (!attempt) throw new Error(`Missing attempt for ${fixture.id}.`);

      for (const [responseIdentifier, response] of Object.entries(attempt.responses)) {
        await provideResponse(page, fixture.interactionType, response, responseIdentifier);
      }

      const stateBeforeScore = await page
        .locator("qti-assessment-item-player")
        .evaluate((element) => {
          return element.serialize();
        });
      if (stateBeforeScore.status !== "completed") {
        await page.locator("#debug-score").click();
      }
      const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
        return element.serialize();
      });

      expect(state.schema, fixture.id).toBe("qti3.attempt-state.v1");
      for (const [identifier, expected] of Object.entries(attempt.expectedOutcomes)) {
        expect(state.outcomes[identifier], `${fixture.id} ${identifier}`).toEqual(expected);
      }
    }
  });

  test("reflows every reference interaction in a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/");

    for (const fixture of interactionFixtures) {
      await page.locator("#fixture").selectOption(fixture.id);
      await page.locator("#load-fixture").click();
      await expect(
        page.locator(`[data-interaction-type="${fixture.interactionType}"]`).first(),
      ).toBeVisible();

      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth - window.innerWidth;
      });
      expect(overflow, fixture.id).toBeLessThanOrEqual(1);

      await expectNoAxeViolationsOnPlayer(page, fixture.id);
    }
  });
});
