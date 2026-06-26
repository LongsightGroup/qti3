import { expect, test } from "@playwright/test";
import { basicItemPlayerFixtures } from "../../packages/fixtures/src/index.js";
import { loadFixture, pasteXml, scoreCurrentAttempt } from "./player-helpers.js";

test.describe("player inline choice", () => {
  test("renders parent prose as the interaction label", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "inlineChoice");

    const player = page.locator("qti-assessment-item-player");
    await expect(player.locator(".qti3-inlineChoice")).toHaveCount(2);
    await expect(player.locator(".qti3-item-body p").nth(1)).toContainText(
      "After a three-week pilot, the cafeteria team reported that the reusable tray program",
    );
    await expect(player.locator(".qti3-item-body p").nth(1)).toContainText(
      "and the strongest evidence was the",
    );
    await expect(
      player.locator(
        '[data-response-identifier="RESPONSE_DECLARATION"] .qti3-inline-choice-control',
      ),
    ).toBeVisible();
    await expect(
      player.locator('[data-response-identifier="RESPONSE_OUTCOME"] .qti3-inline-choice-control'),
    ).toBeVisible();
    await expect(player.locator('[data-interaction-type="inlineChoice"] select')).toHaveCount(0);
  });

  test("renders placeholder text and clears to null", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "inlineChoice");

    const interaction = page.locator(
      'qti-assessment-item-player [data-response-identifier="RESPONSE_DECLARATION"]',
    );
    const trigger = interaction.locator(".qti3-inline-choice-trigger");
    await expect(trigger).toHaveAttribute("name", "RESPONSE_DECLARATION");
    await expect(trigger).toContainText("Choose...");
    await expect(trigger).toHaveAttribute("data-value", "");

    await trigger.click();
    await expect(interaction.locator('[role="option"]').first()).toHaveText("Choose...");
    await interaction.locator('[role="option"][data-choice-identifier="A"]').click();
    await expect(trigger).toHaveAttribute("data-value", "A");
    let state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(state.responses.RESPONSE_DECLARATION).toBe("A");

    await trigger.click();
    await interaction.locator('[role="option"][data-choice-identifier=""]').click();
    await expect(trigger).toHaveAttribute("data-value", "");
    state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(state.responses.RESPONSE_DECLARATION).toBeNull();
  });

  test("renders rich content with the unified control", async ({ page }) => {
    const fixture = basicItemPlayerFixtures.find((item) => item.id === "basic-rich-inline-choice");
    if (!fixture) throw new Error("Missing rich inline choice fixture.");

    await page.goto("/");
    await pasteXml(page, fixture.xml);

    const player = page.locator("qti-assessment-item-player");
    await expect(player.locator('[data-interaction-type="inlineChoice"] select')).toHaveCount(0);
    await expect(player.locator(".qti3-inline-choice-control")).toHaveCount(3);

    const mathInteraction = player.locator('[data-response-identifier="RICH_MATH_RESPONSE"]');
    await mathInteraction.locator(".qti3-inline-choice-trigger").click();
    await expect(mathInteraction.locator('[role="option"] math')).toHaveCount(3);
    await expect(
      mathInteraction.locator('[role="option"][data-choice-identifier="C"]'),
    ).toContainText("÷");
    await expect(
      mathInteraction.locator('[role="option"][data-choice-identifier="C"]'),
    ).toHaveAccessibleName("fourteen divided by two equals seven dollars");
    await mathInteraction.locator('[role="option"][data-choice-identifier="C"]').click();
    await expect(mathInteraction.locator(".qti3-inline-choice-trigger math")).toHaveCount(1);
    await expect(mathInteraction.locator(".qti3-inline-choice-trigger")).toHaveAccessibleName(
      /fourteen divided by two equals seven dollars/,
    );

    const textInteraction = player.locator('[data-response-identifier="RICH_TEXT_RESPONSE"]');
    await textInteraction.locator(".qti3-inline-choice-trigger").click();
    await expect(textInteraction.locator('[role="option"] math')).toHaveCount(3);
    await textInteraction.locator('[role="option"][data-choice-identifier="B"]').click();

    const imageInteraction = player.locator('[data-response-identifier="RICH_IMAGE_RESPONSE"]');
    await imageInteraction.locator(".qti3-inline-choice-trigger").click();
    await expect(imageInteraction.locator('[role="option"] img')).toHaveCount(3);
    await expect(
      imageInteraction.locator('[role="option"][data-choice-identifier="A"]'),
    ).toHaveAccessibleName("circle divided into equal sections with one section shaded");
    await imageInteraction.locator('[role="option"][data-choice-identifier="A"]').click();

    const state = await player.evaluate((element) => element.serialize());
    expect(state.responses.RICH_MATH_RESPONSE).toBe("C");
    expect(state.responses.RICH_TEXT_RESPONSE).toBe("B");
    expect(state.responses.RICH_IMAGE_RESPONSE).toBe("A");

    const score = await scoreCurrentAttempt(page);
    expect(score?.outcomes.SCORE).toBe(1);
  });
});
