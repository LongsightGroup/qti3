import { expect, test } from "@playwright/test";
import { processingFixtures } from "../../packages/fixtures/src/index.js";
import {
  formatRandomIntegerTemplatePrompt,
  RANDOM_INTEGER_TEMPLATE_REFERENCE_ID,
  RANDOM_INTEGER_TEMPLATE_REFERENCE_VALUES,
} from "../../packages/fixtures/src/random-integer-template.fixture.js";
import {
  formatTemplateProcessingPrompt,
  TEMPLATE_PROCESSING_BASE,
  TEMPLATE_PROCESSING_CORRECT_RESPONSE,
  TEMPLATE_PROCESSING_RESPONSE_PROMPT,
} from "../../packages/fixtures/src/template-processing.fixture.js";
import { expectDebugTemplateValues, selectFixtureById, pasteXml } from "./player-helpers.js";
import {
  playerLocator,
  resetThenRestorePlayerState,
  scorePlayerAttempt,
  serializePlayer,
} from "./player-test-api.js";

const choiceScoringCases = [
  {
    fixtureId: "mapping-processing-reference",
    expectedOutcomes: ['"SCORE": 2'],
  },
  {
    fixtureId: "generic-match-processing-reference",
    expectedOutcomes: ['"SCORE": 1', '"FEEDBACK": "matched"'],
  },
  {
    fixtureId: "advanced-processing-reference",
    expectedOutcomes: [
      '"ROUNDED": true',
      '"GCD_VALUE": 6',
      '"LCM_VALUE": 12',
      '"MEAN_VALUE": 4',
      '"ANY_INSIDE": true',
      '"NONE_INSIDE": false',
      '"IN_POLY": true',
    ],
  },
] as const;

test.describe("processing fixtures", () => {
  test("preserves a directly randomized answer key through player restore", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="direct-random-restore" title="Direct random restore" time-dependent="false">
      <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
      <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
      <qti-template-processing>
        <qti-set-default-value identifier="RESPONSE"><qti-random-integer min="1" max="1000000"/></qti-set-default-value>
        <qti-set-correct-response identifier="RESPONSE"><qti-default identifier="RESPONSE"/></qti-set-correct-response>
      </qti-template-processing>
      <qti-item-body><p>Keep the generated answer: <qti-text-entry-interaction response-identifier="RESPONSE"/></p></qti-item-body>
      <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
    </qti-assessment-item>`,
    );
    const input = playerLocator(page).getByRole("textbox");
    const answer = await input.inputValue();
    expect(Number(answer)).toBeGreaterThan(0);
    await input.fill(answer);
    const scored = await scorePlayerAttempt(page);
    expect(scored?.outcomes.SCORE).toBe(1);
    const state = await serializePlayer(page);
    if (!state) throw new Error("Expected saved attempt");
    for (let attempt = 0; attempt < 2; attempt++) {
      await resetThenRestorePlayerState(page, state);
      await expect(input).toHaveValue(answer);
      expect((await scorePlayerAttempt(page))?.outcomes.SCORE).toBe(1);
    }
  });
  test("loads template-processing reference from the picker", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("#fixture optgroup[label='Processing references']")).toHaveCount(1);

    const fixture = processingFixtures.find((item) => item.id === "template-processing-reference");
    if (!fixture) throw new Error("Missing template-processing-reference fixture.");

    await selectFixtureById(page, fixture.id);
    await expect(playerLocator(page)).toContainText(formatTemplateProcessingPrompt());
    await expect(playerLocator(page)).toContainText(TEMPLATE_PROCESSING_RESPONSE_PROMPT);
    await expectDebugTemplateValues(page, {
      BASE: TEMPLATE_PROCESSING_BASE,
      ANSWER: TEMPLATE_PROCESSING_CORRECT_RESPONSE,
    });
  });

  test("loads random-integer template reference from the picker", async ({ page }) => {
    await page.goto("/");

    const fixture = processingFixtures.find(
      (item) => item.id === RANDOM_INTEGER_TEMPLATE_REFERENCE_ID,
    );
    if (!fixture) throw new Error("Missing random-integer-template-reference fixture.");

    await selectFixtureById(page, fixture.id);
    await expect(playerLocator(page)).toContainText(formatRandomIntegerTemplatePrompt());
    await expectDebugTemplateValues(page, RANDOM_INTEGER_TEMPLATE_REFERENCE_VALUES);
  });

  test("restores random-integer template reference from serialized state", async ({ page }) => {
    await page.goto("/");
    await selectFixtureById(page, RANDOM_INTEGER_TEMPLATE_REFERENCE_ID);

    const savedState = await serializePlayer(page);
    if (!savedState) throw new Error("Expected serialized state.");

    await resetThenRestorePlayerState(page, {
      ...savedState,
      status: "interacting",
      responses: { RESPONSE: RANDOM_INTEGER_TEMPLATE_REFERENCE_VALUES.TARGET },
    });

    const player = playerLocator(page);
    await expect(player).toContainText(formatRandomIntegerTemplatePrompt());
    await expectDebugTemplateValues(page, RANDOM_INTEGER_TEMPLATE_REFERENCE_VALUES);

    const scored = await scorePlayerAttempt(page);
    expect(scored?.outcomes.SCORE).toBe(1);
    expect(scored?.state.templateValues).toEqual(RANDOM_INTEGER_TEMPLATE_REFERENCE_VALUES);
  });

  for (const scoringCase of choiceScoringCases) {
    test(`scores ${scoringCase.fixtureId} from the picker`, async ({ page }) => {
      await page.goto("/");

      const fixture = processingFixtures.find((item) => item.id === scoringCase.fixtureId);
      if (!fixture) throw new Error(`Missing ${scoringCase.fixtureId} fixture.`);

      await selectFixtureById(page, fixture.id);
      await page.locator('qti-assessment-item-player [data-choice-identifier="A"] input').check();
      await page.locator("#debug-score").click();

      for (const outcome of scoringCase.expectedOutcomes) {
        await expect(page.locator("#debug-outcomes")).toContainText(outcome);
      }
      await expect(page.locator("#debug-action-log")).toContainText("qti-score");
    });
  }

  test("renders template block and inline content from the template-content-reference fixture", async ({
    page,
  }) => {
    await page.goto("/");

    await selectFixtureById(page, "template-content-reference");

    const player = playerLocator(page);
    await expect(player.locator(".qti3-template-block", { hasText: "north marsh" })).toContainText(
      "The selected field site is the north marsh, where students recorded three bird species during the morning count.",
    );
    await expect(
      player.locator(".qti3-template-block", { hasText: "alternate field site" }),
    ).toBeHidden();
    await expect(
      player.locator(".qti3-template-inline", { hasText: "north marsh observation" }),
    ).toBeVisible();
    await expect(
      player.locator(".qti3-template-inline", { hasText: "south meadow observation" }),
    ).toBeHidden();
  });
});
