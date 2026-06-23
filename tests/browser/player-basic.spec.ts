import { expect, test } from "@playwright/test";
import {
  basicItemPlayerFixtures,
  basicItemPlayerToleranceFixtures,
  interactionFixtures,
} from "../../packages/fixtures/src/index.js";
import {
  assignMatch,
  expectResponse,
  loadFixture,
  pasteXml,
  scoreCurrentAttempt,
  suspendRestoreCurrentAttempt,
} from "./player-helpers.js";

test.describe("Basic item player readiness", () => {
  test("renders Basic interaction and item-feature fixtures", async ({ page }) => {
    await page.goto("/");

    const interactionEvidence = interactionFixtures.filter((fixture) =>
      ["choice", "extendedText", "match", "textEntry"].includes(fixture.interactionType ?? ""),
    );

    for (const fixture of [
      ...interactionEvidence,
      ...basicItemPlayerFixtures,
      ...basicItemPlayerToleranceFixtures,
    ]) {
      await pasteXml(page, fixture.xml);
      await expect(page.locator("qti-assessment-item-player .qti3-item-body")).toBeVisible();
      if (fixture.interactionType) {
        await expect(
          page.locator(`[data-interaction-type="${fixture.interactionType}"]`).first(),
          fixture.id,
        ).toBeVisible();
      }
    }
  });

  test("responds, suspends, restores, and scores Basic scorable fixtures", async ({ page }) => {
    await page.goto("/");

    await loadFixture(page, "choice");
    await page.locator('qti-assessment-item-player [data-choice-identifier="A"] input').check();
    await suspendRestoreCurrentAttempt(page);
    await expect(
      page.locator('qti-assessment-item-player [data-choice-identifier="A"] input'),
    ).toBeChecked();
    let score = await scoreCurrentAttempt(page);
    expect(score?.outcomes.SCORE).toBe(1);

    await loadFixture(page, "match");
    await assignMatch(page, "A", "G1");
    await assignMatch(page, "B", "G2");
    await suspendRestoreCurrentAttempt(page);
    await expectResponse(page, ["A G1", "B G2"]);
    score = await scoreCurrentAttempt(page);
    expect(score?.outcomes.SCORE).toBe(1);

    await loadFixture(page, "textEntry");
    await page
      .locator('qti-assessment-item-player input:not([type="file"]):not([type="range"])')
      .fill("SCORE");
    await suspendRestoreCurrentAttempt(page);
    await expect(
      page.locator('qti-assessment-item-player input:not([type="file"]):not([type="range"])'),
    ).toHaveValue("SCORE");
    score = await scoreCurrentAttempt(page);
    expect(score?.outcomes.SCORE).toBe(1);
  });

  test("restores Basic extended text response without requiring positive auto-score", async ({
    page,
  }) => {
    await page.goto("/");
    await loadFixture(page, "extendedText");

    await page.locator("qti-assessment-item-player textarea").fill("A concise answer");
    await suspendRestoreCurrentAttempt(page);
    await expect(page.locator("qti-assessment-item-player textarea")).toHaveValue(
      "A concise answer",
    );

    const score = await scoreCurrentAttempt(page);
    expect(score?.state.responses.RESPONSE).toBe("A concise answer");
    expect(score?.outcomes.SCORE).toBe(0);
  });

  test("preserves Basic graphic alt text in rendered output", async ({ page }) => {
    const fixture = basicItemPlayerFixtures.find((item) => item.id === "basic-alt-text");
    if (!fixture) throw new Error("Missing Basic alt text fixture.");

    await page.goto("/");
    await pasteXml(page, fixture.xml);

    await expect(
      page.locator('qti-assessment-item-player img[alt="Timeline diagram with two milestones"]'),
    ).toBeVisible();
  });

  test("tolerates extra non-Basic item features without breaking Basic scoring", async ({
    page,
  }) => {
    const fixture = basicItemPlayerToleranceFixtures.find(
      (item) => item.id === "basic-extra-item-feature-tolerance",
    );
    if (!fixture) throw new Error("Missing Basic extra feature tolerance fixture.");

    await page.goto("/");
    await pasteXml(page, fixture.xml);

    const player = page.locator("qti-assessment-item-player");
    await expect(player).toContainText("Optional rubric guidance remains visible.");
    await expect(player).not.toContainText("stimulus-extra");
    await expect(player.locator("qti-assessment-stimulus-ref")).toHaveCount(0);
    await expect(page.locator("#debug-stylesheets")).toContainText('"href": "../styles/extra.css"');
    await expect(page.locator("#debug-catalogs")).toContainText('"id": "term-extra"');
    await expect(page.locator("#debug-catalogs")).toContainText(
      "Extra means beyond the Basic evidence target.",
    );

    await player.locator('[data-choice-identifier="A"] input').check();
    const score = await scoreCurrentAttempt(page);
    expect(score?.outcomes.SCORE).toBe(1);
  });
});
