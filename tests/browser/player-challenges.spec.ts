import { expect, test, type Page } from "@playwright/test";
import { challengeFixtures } from "../../packages/fixtures/src/challenges/index.js";
import { expectNoAxeViolationsOnPlayer } from "./axe-helpers.js";
import {
  assignGap,
  assignMatch,
  clickAuthoredCoordinate,
  selectFixtureById,
  waitForPlayerLoad,
} from "./player-helpers.js";
import {
  playerLocator,
  resetThenRestorePlayerState,
  scorePlayerAttempt,
  serializePlayer,
} from "./player-test-api.js";

async function enter(page: Page, identifier: string, value: string): Promise<void> {
  const input = playerLocator(page).locator(`[data-response-identifier="${identifier}"] input`);
  await input.fill(value);
  await input.press("Tab");
}

for (const fixture of challengeFixtures) {
  test(`${fixture.title}: answer, score, restore, and accessibility`, async ({ page }) => {
    await page.goto("/");
    await waitForPlayerLoad(page);
    await selectFixtureById(page, fixture.id);
    await waitForPlayerLoad(page, fixture.id);
    const player = playerLocator(page);
    await expect(player).not.toContainText("Unable to");
    await expectNoAxeViolationsOnPlayer(page, fixture.id);
    let expectedScore: number;
    switch (fixture.id) {
      case "challenge-garden": {
        const math = player.locator("math");
        await expect(math.locator("mn")).toHaveText(["3", "4"]);
        expect(await math.evaluate((node) => node.namespaceURI)).toBe(
          "http://www.w3.org/1998/Math/MathML",
        );
        await enter(page, "AREA", "12");
        await enter(page, "PERIMETER", "14");
        expectedScore = 3;
        break;
      }
      case "challenge-sensor": {
        await enter(page, "TEMPERATURE", "99.5");
        const unit = player.locator('[data-response-identifier="UNIT"]');
        await unit.locator(".qti3-inline-choice-trigger").click();
        await unit.getByRole("option", { name: "Celsius", exact: true }).click();
        expect((await scorePlayerAttempt(page))?.outcomes.SCORE).toBe(1);
        await enter(page, "TEMPERATURE", "101");
        expectedScore = 3;
        break;
      }
      case "challenge-flight-order": {
        // Move each stage to the front in reverse order, using only keyboard controls.
        for (const identifier of ["LANDING", "ORBIT", "LIFTOFF", "IGNITION"]) {
          const handle = player.locator(
            `.qti3-reorder-handle[data-choice-identifier="${identifier}"]`,
          );
          await handle.focus();
          for (let move = 0; move < 3; move++) await handle.press("ArrowUp");
        }
        expect((await serializePlayer(page))?.responses.FLIGHT).toEqual([
          "IGNITION",
          "LIFTOFF",
          "ORBIT",
          "LANDING",
        ]);
        expectedScore = 4;
        break;
      }
      case "challenge-planet-types":
        await assignMatch(page, "MERCURY", "ROCKY");
        await assignMatch(page, "VENUS", "ROCKY");
        await assignMatch(page, "JUPITER", "GAS");
        expectedScore = 9;
        break;
      case "challenge-water-cycle":
        await assignGap(page, "Gap match", "WATER", "START");
        await assignGap(page, "Gap match", "VAPOR", "GAS");
        await assignGap(page, "Gap match", "WATER", "END");
        expect((await serializePlayer(page))?.responses.CYCLE).toEqual(
          expect.arrayContaining(["WATER START", "VAPOR GAS", "WATER END"]),
        );
        expectedScore = 3;
        break;
      case "challenge-unicode":
        await enter(page, "SYMBOL", "CO");
        await enter(page, "CITY", "QUÉBEC");
        expect((await scorePlayerAttempt(page))?.outcomes.SCORE).toBe(1);
        await enter(page, "SYMBOL", "Co");
        expectedScore = 3;
        break;
      case "challenge-target": {
        const surface = player.locator(".qti3-point-surface");
        await expect(surface.locator("img")).toBeVisible();
        await expect
          .poll(() =>
            surface.locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth),
          )
          .toBe(160);
        await clickAuthoredCoordinate(surface, 80, 80);
        await clickAuthoredCoordinate(surface, 30, 30);
        expectedScore = 3;
        break;
      }
      case "challenge-lab-badge":
        await enter(page, "RESULT", "80");
        expect((await scorePlayerAttempt(page))?.outcomes.BADGE).toBe("SILVER");
        await expect(player.getByText("Silver badge earned.", { exact: true })).toBeVisible();
        await expect(player.getByText("Gold badge earned.", { exact: true })).not.toBeVisible();
        await enter(page, "RESULT", "81");
        expectedScore = 81;
        break;
      case "challenge-weather-statistics":
        await enter(page, "MEAN", "2");
        await enter(page, "VARIANCE", "14");
        expect((await scorePlayerAttempt(page))?.outcomes.SCORE).toBe(1);
        await enter(page, "VARIANCE", "21");
        expectedScore = 3;
        break;
      case "challenge-mission": {
        await expect(player.locator('[data-response-identifier="MOONS"] input')).not.toBeVisible();
        await player.locator('[data-choice-identifier="MARS"] input').check();
        await player.getByRole("button", { name: "Check mission", exact: true }).click();
        const stage = await serializePlayer(page);
        expect(stage?.outcomes).toMatchObject({ SCORE: 1, STAGE: "MOONS" });
        if (!stage) throw new Error("Missing mission state");
        await resetThenRestorePlayerState(page, stage);
        await expect(player.locator('[data-response-identifier="MOONS"] input')).toBeVisible();
        await enter(page, "MOONS", "2");
        await player.getByRole("button", { name: "Check mission", exact: true }).click();
        expect((await serializePlayer(page))?.outcomes).toMatchObject({
          SCORE: 3,
          STAGE: "COMPLETE",
          completionStatus: "completed",
        });
        await expect(
          player.getByRole("button", { name: "Check mission", exact: true }),
        ).toBeDisabled();
        await expectNoAxeViolationsOnPlayer(page, "completed mission");
        return;
      }
      default:
        throw new Error(`Missing browser answer for ${fixture.id}`);
    }
    const result = await scorePlayerAttempt(page);
    expect(result?.diagnostics).toEqual([]);
    expect(result?.outcomes.SCORE).toBe(expectedScore);
    const saved = await serializePlayer(page);
    if (!saved) throw new Error("Missing saved challenge state");
    await resetThenRestorePlayerState(page, saved);
    expect((await serializePlayer(page))?.responses).toEqual(saved.responses);
    expect((await scorePlayerAttempt(page))?.outcomes.SCORE).toBe(expectedScore);
    await expectNoAxeViolationsOnPlayer(page, `${fixture.id} restored`);
  });
}
