import { expect, test } from "@playwright/test";
import { processingFixtures } from "../../packages/fixtures/src/index.js";
import {
  formatRandomIntegerTemplatePrompt,
  RANDOM_INTEGER_TEMPLATE_REFERENCE_VALUES,
} from "../../packages/fixtures/src/random-integer-template.fixture.js";
import { TEMPLATE_PROCESSING_CORRECT_RESPONSE } from "../../packages/fixtures/src/template-processing.fixture.js";
import { expectDebugTemplateValues, loadCanonicalFixture } from "./player-helpers.js";

test.describe("processing fixtures", () => {
  test("loads template-processing reference from the picker", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("#fixture optgroup[label='Processing references']")).toHaveCount(1);

    const fixture = processingFixtures.find((item) => item.id === "template-processing-reference");
    if (!fixture) throw new Error("Missing template-processing-reference fixture.");

    await loadCanonicalFixture(page, fixture.id);
    await expect(page.locator("qti-assessment-item-player")).toContainText(
      "Template processing generates the correct numeric response before delivery.",
    );
    await expectDebugTemplateValues(page, {
      BASE: 2,
      ANSWER: TEMPLATE_PROCESSING_CORRECT_RESPONSE,
    });
  });

  test("loads random-integer template reference from the picker", async ({ page }) => {
    await page.goto("/");

    const fixture = processingFixtures.find(
      (item) => item.id === "random-integer-template-reference",
    );
    if (!fixture) throw new Error("Missing random-integer-template-reference fixture.");

    await loadCanonicalFixture(page, fixture.id);
    await expect(page.locator("qti-assessment-item-player")).toContainText(
      formatRandomIntegerTemplatePrompt(),
    );
    await expectDebugTemplateValues(page, RANDOM_INTEGER_TEMPLATE_REFERENCE_VALUES);
  });

  test("scores mapping-processing reference from the picker", async ({ page }) => {
    await page.goto("/");

    const fixture = processingFixtures.find((item) => item.id === "mapping-processing-reference");
    if (!fixture) throw new Error("Missing mapping-processing-reference fixture.");

    await loadCanonicalFixture(page, fixture.id);
    await page.locator('qti-assessment-item-player [data-choice-identifier="A"] input').check();
    await page.locator("#debug-score").click();

    await expect(page.locator("#debug-outcomes")).toContainText('"SCORE": 2');
    await expect(page.locator("#debug-action-log")).toContainText("qti-score");
  });

  test("scores generic-match-processing reference from the picker", async ({ page }) => {
    await page.goto("/");

    const fixture = processingFixtures.find(
      (item) => item.id === "generic-match-processing-reference",
    );
    if (!fixture) throw new Error("Missing generic-match-processing-reference fixture.");

    await loadCanonicalFixture(page, fixture.id);
    await page.locator('qti-assessment-item-player [data-choice-identifier="A"] input').check();
    await page.locator("#debug-score").click();

    await expect(page.locator("#debug-outcomes")).toContainText('"SCORE": 1');
    await expect(page.locator("#debug-outcomes")).toContainText('"FEEDBACK": "matched"');
    await expect(page.locator("#debug-action-log")).toContainText("qti-score");
  });

  test("scores advanced processing fixtures through the manual debugger", async ({ page }) => {
    await page.goto("/");

    const fixture = processingFixtures.find((item) => item.id === "advanced-processing-reference");
    if (!fixture) throw new Error("Missing advanced processing fixture.");

    await loadCanonicalFixture(page, fixture.id);
    await page.locator('qti-assessment-item-player [data-choice-identifier="A"] input').check();
    await page.locator("#debug-score").click();

    await expect(page.locator("#debug-outcomes")).toContainText('"ROUNDED": true');
    await expect(page.locator("#debug-outcomes")).toContainText('"GCD_VALUE": 6');
    await expect(page.locator("#debug-outcomes")).toContainText('"LCM_VALUE": 12');
    await expect(page.locator("#debug-outcomes")).toContainText('"MEAN_VALUE": 4');
    await expect(page.locator("#debug-outcomes")).toContainText('"ANY_INSIDE": true');
    await expect(page.locator("#debug-outcomes")).toContainText('"NONE_INSIDE": false');
    await expect(page.locator("#debug-outcomes")).toContainText('"IN_POLY": true');
    await expect(page.locator("#debug-action-log")).toContainText("qti-score");
  });

  test("renders template block and inline content from the template-content-reference fixture", async ({
    page,
  }) => {
    await page.goto("/");

    await loadCanonicalFixture(page, "template-content-reference");

    const player = page.locator("qti-assessment-item-player");
    await expect(
      player.locator(".qti3-template-block", { hasText: "reference branch" }),
    ).toContainText("The generated reference branch is visible.");
    await expect(
      player.locator(".qti3-template-block", { hasText: "distractor branch" }),
    ).toBeHidden();
    await expect(
      player.locator(".qti3-template-inline", { hasText: "generated reference" }),
    ).toBeVisible();
    await expect(
      player.locator(".qti3-template-inline", { hasText: "hidden fallback" }),
    ).toBeHidden();
  });
});
