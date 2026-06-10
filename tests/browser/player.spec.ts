import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  adaptiveFixtures,
  basicItemPlayerFixtures,
  basicItemPlayerToleranceFixtures,
  interactionFixtures,
  processingFixtures,
} from "../../packages/fixtures/src/index.js";
import {
  assignGap,
  assignMatch,
  expectImageLoaded,
  expectResponse,
  loadFixture,
  pasteXml,
  provideResponse,
  scoreCurrentAttempt,
  suspendRestoreCurrentAttempt,
} from "./player-helpers.js";

const require = createRequire(import.meta.url);

async function loadedItemIdentifier(player: Locator): Promise<string | undefined> {
  return player.evaluate((element) => {
    const qtiPlayer = element as HTMLElement & {
      serialize: () => { itemIdentifier?: string } | null;
    };
    return qtiPlayer.serialize()?.itemIdentifier;
  });
}

async function videoBottomStripLuma(page: Page, video: Locator): Promise<number> {
  const image = await video.screenshot();
  return page.evaluate(
    async (dataUrl) => {
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas 2D context unavailable.");
      context.drawImage(image, 0, 0);
      const height = Math.min(36, canvas.height);
      const data = context.getImageData(0, canvas.height - height, canvas.width, height).data;
      let total = 0;
      for (let index = 0; index < data.length; index += 4) {
        const red = data[index] ?? 0;
        const green = data[index + 1] ?? 0;
        const blue = data[index + 2] ?? 0;
        total += 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      }
      return total / (data.length / 4);
    },
    `data:image/png;base64,${image.toString("base64")}`,
  );
}

test.describe("Basic item player readiness", () => {
  test("renders Basic interaction and item-feature fixtures without axe violations", async ({
    page,
  }) => {
    await page.goto("/");
    const axeSource = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");
    await page.addScriptTag({ content: axeSource });

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

      const result = await page.evaluate(async () => {
        return await window.axe.run(document.querySelector("qti-assessment-item-player"));
      });
      expect(result.violations, fixture.id).toEqual([]);
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

test.describe("manual harness", () => {
  test("loads every reference interaction fixture without axe violations", async ({ page }) => {
    await page.goto("/");
    const axeSource = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");

    for (const fixture of interactionFixtures) {
      await page.locator("#fixture").selectOption(fixture.id);
      await page.locator("#load-fixture").click();
      await expect(
        page.locator(`[data-interaction-type="${fixture.interactionType}"]`).first(),
      ).toBeVisible();

      await page.addScriptTag({ content: axeSource });
      const result = await page.evaluate(async () => {
        return await window.axe.run(document.querySelector("qti-assessment-item-player"));
      });
      expect(result.violations, fixture.id).toEqual([]);
    }
  });

  test("does not render generic fieldset or legend wrappers around interactions", async ({
    page,
  }) => {
    await page.goto("/");

    for (const fixture of interactionFixtures) {
      await page.locator("#fixture").selectOption(fixture.id);
      await page.locator("#load-fixture").click();

      const player = page.locator("qti-assessment-item-player");
      await expect(player.locator("fieldset"), fixture.id).toHaveCount(0);
      await expect(player.locator("legend"), fixture.id).toHaveCount(0);
    }
  });

  test("does not render host scoring controls inside the item player", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "choice");

    const player = page.locator("qti-assessment-item-player");
    await expect(player.locator(".qti3-actions")).toHaveCount(0);
    await expect(player.getByRole("button", { name: "Score", exact: true })).toHaveCount(0);
    await expect(page.locator("#debug-score")).toHaveText("Score attempt");
  });

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

  test("shows dormant catalog metadata in the manual debugger", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="catalog-debug" title="catalog-debug" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
          <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <p data-catalog-idref="term-help">Select the accurate statement.</p>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">QTI items may include dormant support-specific content.</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
        <qti-catalog-info>
          <qti-catalog id="term-help">
            <qti-card support="linguistic-guidance">
              <qti-html-content>Accurate means correct.</qti-html-content>
            </qti-card>
          </qti-catalog>
        </qti-catalog-info>
      </qti-assessment-item>
    `,
    );

    await expect(page.locator("#debug-catalogs")).toContainText('"id": "term-help"');
    await expect(page.locator("#debug-catalogs")).toContainText('"support": "linguistic-guidance"');
    await expect(page.locator("#debug-catalogs")).toContainText("Accurate means correct.");
  });

  test("exposes resolved catalog supports for media alternatives", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="media-catalog" title="media-catalog" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
        <qti-item-body>
          <p data-catalog-idref="audio-transcript">Listen to the recording.</p>
          <qti-media-interaction response-identifier="RESPONSE" data-catalog-idref="video-alternatives">
            <qti-prompt>Watch the clip.</qti-prompt>
            <video width="320" height="180">
              <source src="clips/presentation.mp4" type="video/mp4"/>
              <track kind="captions" src="captions/presentation.vtt" srclang="en" label="English"/>
            </video>
          </qti-media-interaction>
        </qti-item-body>
        <qti-catalog-info>
          <qti-catalog id="audio-transcript">
            <qti-card support="transcript">
              <qti-card-entry xml:lang="en" default="true">
                <qti-html-content><p>English transcript.</p></qti-html-content>
              </qti-card-entry>
              <qti-card-entry xml:lang="es">
                <qti-html-content><p>Transcripción en español.</p></qti-html-content>
              </qti-card-entry>
            </qti-card>
          </qti-catalog>
          <qti-catalog id="video-alternatives">
            <qti-card support="audio-description">
              <qti-card-entry default="true">
                <qti-file-href mime-type="audio/mpeg">audio/presentation-description.mp3</qti-file-href>
              </qti-card-entry>
            </qti-card>
            <qti-card support="sign-language">
              <qti-card-entry xml:lang="ase" default="true">
                <qti-html-content><p>ASL interpretation clip.</p></qti-html-content>
              </qti-card-entry>
            </qti-card>
          </qti-catalog>
        </qti-catalog-info>
      </qti-assessment-item>
    `,
    );

    const resolution = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return (
        element as HTMLElement & {
          getCatalogSupportResolution: (options?: { languages?: string[]; supports?: string[] }) =>
            | {
                references: Array<{
                  idref: string;
                  matches: Array<{
                    fileHrefs: Array<{ href: string; mimeType?: string }>;
                    htmlContent?: { text: string };
                    language?: string;
                    support: string;
                  }>;
                }>;
              }
            | undefined;
        }
      ).getCatalogSupportResolution({
        supports: ["transcript", "audio-description", "sign-language"],
        languages: ["es", "ase"],
      });
    });

    expect(resolution?.references.map((reference) => reference.idref)).toEqual([
      "audio-transcript",
      "video-alternatives",
    ]);
    expect(resolution?.references[0]?.matches).toEqual([
      expect.objectContaining({
        language: "es",
        support: "transcript",
        htmlContent: expect.objectContaining({ text: "Transcripción en español." }),
      }),
    ]);
    expect(resolution?.references[1]?.matches).toEqual([
      expect.objectContaining({
        support: "audio-description",
        fileHrefs: [
          expect.objectContaining({
            href: "audio/presentation-description.mp3",
            mimeType: "audio/mpeg",
          }),
        ],
      }),
      expect.objectContaining({
        language: "ase",
        support: "sign-language",
        htmlContent: expect.objectContaining({ text: "ASL interpretation clip." }),
      }),
    ]);
  });

  test("shows item stylesheet references in the manual debugger", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="stylesheet-debug" title="stylesheet-debug" time-dependent="false">
        <qti-stylesheet href="style/item.css" type="text/css" media="screen"/>
        <qti-item-body><p>Styled item body.</p></qti-item-body>
      </qti-assessment-item>
    `,
    );

    await expect(page.locator("#debug-stylesheets")).toContainText('"href": "style/item.css"');
    await expect(page.locator("#debug-stylesheets")).toContainText('"type": "text/css"');
    await expect(page.locator("#debug-stylesheets")).toContainText('"media": "screen"');
  });

  test("shows accessibility proof and manual assistive technology scripts", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "associate");

    await expect(page.locator("#debug-a11y-proof")).toContainText(
      "associate accessibility contract",
    );
    await expect(page.locator("#debug-a11y-proof")).toContainText("Keyboard model");
    await expect(page.locator("#debug-a11y-proof")).toContainText(
      "Remove buttons delete selected pairs.",
    );
    await expect(page.locator("#debug-at-scripts")).toContainText("VoiceOver on macOS");
    await expect(page.locator("#debug-at-scripts")).toContainText("NVDA on Windows");
    await expect(page.locator("#debug-at-scripts")).toContainText("JAWS on Windows");
    await expect(page.locator("#debug-at-scripts ol li").first()).toContainText(
      "Navigate from the item body",
    );
  });

  test("loads the manual qti-gap-img graphic gap match example", async ({ page }) => {
    await page.goto("/");
    await page.locator("#fixture").selectOption("graphic-gap-img-example");
    await page.locator("#load-fixture").click();

    const source = page
      .locator("qti-assessment-item-player .qti3-graphic-gap-source-region")
      .getByRole("button", { name: "Civil War marker" });
    const sourceB = page
      .locator("qti-assessment-item-player .qti3-graphic-gap-source-region")
      .getByRole("button", { name: "Reconstruction marker" });
    const target = page.locator('qti-assessment-item-player [data-gap-identifier="TargetA"]');
    const targetB = page.locator('qti-assessment-item-player [data-gap-identifier="TargetB"]');
    await expect(
      page.locator("qti-assessment-item-player .qti3-graphic-gap-source-region button"),
    ).toHaveCount(2);
    await expect(page.locator("qti-assessment-item-player .qti3-graphic-gap-hotspot")).toHaveCount(
      2,
    );
    await expectImageLoaded(source.locator("img"));
    await expectImageLoaded(sourceB.locator("img"));

    await source.click();
    await target.click();
    await sourceB.click();
    await targetB.click();

    await expectResponse(page, ["DraggerA TargetA", "DraggerB TargetB"]);
    await expect(target).toHaveAccessibleName("Target 1, assigned Civil War marker");
    await expect(targetB).toHaveAccessibleName("Target 2, assigned Reconstruction marker");
  });

  test("does not render qti-assessment-item title metadata as candidate content", async ({
    page,
  }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `
      <qti-assessment-item
        xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
        identifier="candidate-visible-item"
        title="Internal Item Bank Title" time-dependent="false">
        <qti-item-body>
          <p>Candidate-visible item body.</p>
        </qti-item-body>
      </qti-assessment-item>
    `,
    );

    const player = page.locator("qti-assessment-item-player");
    await expect(player).toContainText("Candidate-visible item body.");
    await expect(player).not.toContainText("Internal Item Bank Title");
    await expect(player.locator("#qti3-item-title")).toHaveCount(0);
  });

  test("loads processing and adaptive canonical fixtures from the picker", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("#fixture optgroup[label='Processing references']")).toHaveCount(1);
    await expect(page.locator("#fixture optgroup[label='Adaptive references']")).toHaveCount(1);

    const templateFixture = processingFixtures.find(
      (fixture) => fixture.id === "template-processing-reference",
    );
    const adaptiveFixture = adaptiveFixtures.find(
      (fixture) => fixture.id === "adaptive-feedback-reference",
    );
    if (!templateFixture || !adaptiveFixture) throw new Error("Missing canonical fixtures.");

    await page.locator("#fixture").selectOption(templateFixture.id);
    await page.locator("#load-fixture").click();
    await expect(page.locator("qti-assessment-item-player")).toContainText(
      "Template processing generates the correct numeric response before delivery.",
    );
    await expect(page.locator("#debug-template-values")).toContainText('"ANSWER": 5');

    await page.locator("#fixture").selectOption(adaptiveFixture.id);
    await page.locator("#load-fixture").click();
    await expect(page.locator("qti-assessment-item-player")).toContainText(
      "Use the hint control or answer the item.",
    );
    await page.getByRole("button", { name: "Show hint" }).click();
    await expect(page.locator("qti-assessment-item-player .qti3-feedback-block")).toContainText(
      "Hint feedback is visible",
    );
  });

  test("keeps manual harness load options in a native exclusive disclosure group", async ({
    page,
  }) => {
    await page.goto("/");

    const reference = page.locator("details.load-option").filter({ hasText: "Reference fixture" });
    const packageLoader = page.locator("#package-loader");
    const xmlLoader = page.locator("#xml-loader");
    await expect(reference).toHaveAttribute("open", "");
    await expect(packageLoader).not.toHaveAttribute("open", "");
    await expect(xmlLoader).not.toHaveAttribute("open", "");

    await packageLoader.locator("summary").click();
    await expect(packageLoader).toHaveAttribute("open", "");
    await expect(reference).not.toHaveAttribute("open", "");

    await xmlLoader.locator("summary").click();
    await expect(xmlLoader).toHaveAttribute("open", "");
    await expect(packageLoader).not.toHaveAttribute("open", "");

    await pasteXml(page, "<qti-assessment-item/>");
    await expect(xmlLoader).toHaveAttribute("open", "");
  });

  test("loads adjacent reference fixtures from the manual harness arrows", async ({ page }) => {
    await page.goto("/");

    const fixtureIds = await page
      .locator("#fixture option")
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value).filter(Boolean),
      );
    const firstFixtureId = fixtureIds[0];
    const secondFixtureId = fixtureIds[1];
    const previousLastFixtureId = fixtureIds.at(-2);
    const lastFixtureId = fixtureIds.at(-1);
    if (!firstFixtureId || !secondFixtureId || !previousLastFixtureId || !lastFixtureId) {
      throw new Error("Missing selectable fixtures.");
    }

    const player = page.locator("qti-assessment-item-player");
    const previousFixture = page.getByRole("button", { name: "Load previous fixture" });
    const nextFixture = page.getByRole("button", { name: "Load next fixture" });

    await expect(page.locator("#fixture")).toHaveValue(firstFixtureId);
    await expect(previousFixture).toBeDisabled();

    await nextFixture.click();
    await expect(page.locator("#fixture")).toHaveValue(secondFixtureId);
    await expect.poll(() => loadedItemIdentifier(player)).toBe(secondFixtureId);
    await expect(previousFixture).toBeEnabled();

    await page.locator("#fixture").selectOption(lastFixtureId);
    await expect(nextFixture).toBeDisabled();

    await previousFixture.click();
    await expect(page.locator("#fixture")).toHaveValue(previousLastFixtureId);
    await expect.poll(() => loadedItemIdentifier(player)).toBe(previousLastFixtureId);
    await expect(nextFixture).toBeEnabled();
  });

  test("scores advanced processing fixtures through the manual debugger", async ({ page }) => {
    await page.goto("/");

    const fixture = processingFixtures.find((item) => item.id === "advanced-processing-reference");
    if (!fixture) throw new Error("Missing advanced processing fixture.");

    await page.locator("#fixture").selectOption(fixture.id);
    await page.locator("#load-fixture").click();
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

  test("renders inline choice parent prose as the interaction label", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "inlineChoice");

    const player = page.locator("qti-assessment-item-player");
    await expect(player.locator(".qti3-inlineChoice")).toHaveCount(2);
    await expect(player.locator(".qti3-item-body p").nth(1)).toContainText(
      "In QTI 3.0, an interaction writes a candidate answer to a",
    );
    await expect(player.locator(".qti3-item-body p").nth(1)).toContainText(
      "and response processing writes derived values such as SCORE to an",
    );
    await expect(
      player.locator('[data-response-identifier="RESPONSE_DECLARATION"] select'),
    ).toBeVisible();
    await expect(
      player.locator('[data-response-identifier="RESPONSE_OUTCOME"] select'),
    ).toBeVisible();
  });

  test("renders inline choice placeholder text and clears to null", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "inlineChoice");

    const select = page.locator(
      'qti-assessment-item-player [data-response-identifier="RESPONSE_DECLARATION"] select',
    );
    await expect(select).toHaveAttribute("name", "RESPONSE_DECLARATION");
    await expect(select.locator("option").first()).toHaveText("Choose...");
    const placeholderValue = await select
      .locator("option")
      .first()
      .evaluate((option) => (option as HTMLOptionElement).value);
    expect(placeholderValue).toBe("");
    await expect(select).toHaveValue("");

    await select.selectOption("A");
    await expect(select).toHaveValue("A");
    let state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(state.responses.RESPONSE_DECLARATION).toBe("A");

    await select.selectOption("");
    await expect(select).toHaveValue("");
    state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(state.responses.RESPONSE_DECLARATION).toBeNull();
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

  test("renders hottext choices as selectable inline passage text", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "hottext");

    const player = page.locator("qti-assessment-item-player");
    const passage = player.locator(".qti3-hottext-passage");
    await expect(passage).toContainText(
      "A response declaration defines the variable used by an interaction.",
    );
    await expect(player.locator(".qti3-choice-option")).toHaveCount(0);

    const token = player.locator('.qti3-hottext-token[data-choice-identifier="A"]');
    await expect(player.getByRole("button", { name: "response declaration" })).toBeVisible();
    await expect(token).toHaveText("response declaration");
    await token.click();
    await expect(token).toHaveAttribute("aria-pressed", "true");
    await expectResponse(page, "A");
  });

  test("keeps hottext punctuation attached to authored prose", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="hottext-punctuation" title="hottext-punctuation" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <qti-hottext-interaction response-identifier="RESPONSE">
            <qti-prompt>Select the term before the comma.</qti-prompt>
            <p>Select <qti-hottext identifier="A">response declaration</qti-hottext>, then continue.</p>
          </qti-hottext-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `,
    );

    const passage = page.locator("qti-assessment-item-player .qti3-hottext-passage");
    await expect(passage).toContainText("Select response declaration, then continue.");
  });

  test("renders outcome-gated modal feedback after scoring", async ({ page }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="feedback" title="feedback" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
      <qti-simple-choice identifier="B">B</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-match>
          <qti-variable identifier="RESPONSE"/>
          <qti-correct identifier="RESPONSE"/>
        </qti-match>
        <qti-set-outcome-value identifier="FEEDBACK">
          <qti-base-value base-type="identifier">correct</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-if>
      <qti-response-else>
        <qti-set-outcome-value identifier="FEEDBACK">
          <qti-base-value base-type="identifier">incorrect</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-else>
    </qti-response-condition>
  </qti-response-processing>
  <qti-modal-feedback outcome-identifier="FEEDBACK" identifier="correct" show-hide="show">Correct feedback.</qti-modal-feedback>
  <qti-modal-feedback outcome-identifier="FEEDBACK" identifier="incorrect" show-hide="show">Incorrect feedback.</qti-modal-feedback>
</qti-assessment-item>`;

    await page.goto("/");
    await pasteXml(page, xml);
    await page.getByRole("radio", { name: "A" }).check();
    await page.locator("#debug-score").click();

    const feedback = page.locator("qti-assessment-item-player .qti3-feedback");
    await expect(feedback).toBeVisible();
    await expect(feedback).toContainText("Correct feedback.");
    await expect(feedback).not.toContainText("Incorrect feedback.");
    await expect(feedback).toHaveAttribute("aria-live", "polite");
  });

  test("renders printed variables and body feedback from current outcomes", async ({ page }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="body-feedback" title="body-feedback" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <p>Choose the correct response.</p>
    <qti-choice-interaction response-identifier="RESPONSE">
      <qti-simple-choice identifier="A">Correct</qti-simple-choice>
      <qti-simple-choice identifier="B">Incorrect</qti-simple-choice>
    </qti-choice-interaction>
    <p>Current score: <qti-printed-variable identifier="SCORE" format="%.2f"/></p>
    <qti-feedback-block outcome-identifier="FEEDBACK" identifier="correct" show-hide="show">
      <qti-content-body><p>Body feedback is now visible.</p></qti-content-body>
    </qti-feedback-block>
  </qti-item-body>
  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-match><qti-variable identifier="RESPONSE"/><qti-correct identifier="RESPONSE"/></qti-match>
        <qti-set-outcome-value identifier="SCORE"><qti-base-value base-type="float">1</qti-base-value></qti-set-outcome-value>
        <qti-set-outcome-value identifier="FEEDBACK"><qti-base-value base-type="identifier">correct</qti-base-value></qti-set-outcome-value>
      </qti-response-if>
    </qti-response-condition>
  </qti-response-processing>
</qti-assessment-item>`;

    await page.goto("/");
    await pasteXml(page, xml);
    await expect(
      page.locator('qti-assessment-item-player .qti3-printed-variable[data-identifier="SCORE"]'),
    ).toHaveText("0.00");
    await expect(page.locator("qti-assessment-item-player .qti3-feedback-block")).toBeHidden();
    await expect(page.getByRole("radio", { name: "A. Correct" })).toHaveCount(1);
    await expect(page.getByRole("radio", { name: "Correct", exact: true })).toHaveCount(0);

    await page.getByRole("radio", { name: "A. Correct" }).check();
    await page.locator("#debug-score").click();

    await expect(
      page.locator('qti-assessment-item-player .qti3-printed-variable[data-identifier="SCORE"]'),
    ).toHaveText("1.00");
    await expect(page.locator("qti-assessment-item-player .qti3-feedback-block")).toContainText(
      "Body feedback is now visible.",
    );
  });

  test("renders template block and inline content from generated template values", async ({
    page,
  }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="template-content" title="template-content" time-dependent="false">
  <qti-template-declaration identifier="PATH" cardinality="single" base-type="identifier"/>
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-template-processing>
    <qti-set-template-value identifier="PATH">
      <qti-base-value base-type="identifier">reference</qti-base-value>
    </qti-set-template-value>
  </qti-template-processing>
  <qti-item-body>
    <qti-template-block template-identifier="PATH" identifier="reference" show-hide="show" class="reference-path">
      <qti-content-body><p>The reference path is active.</p></qti-content-body>
    </qti-template-block>
    <qti-template-block template-identifier="PATH" identifier="distractor" show-hide="show">
      <qti-content-body><p>The distractor path is hidden.</p></qti-content-body>
    </qti-template-block>
    <p>This item uses the <qti-template-inline template-identifier="PATH" identifier="reference" show-hide="show">generated reference</qti-template-inline><qti-template-inline template-identifier="PATH" identifier="reference" show-hide="hide">hidden fallback</qti-template-inline> branch.</p>
    <qti-choice-interaction response-identifier="RESPONSE">
      <qti-simple-choice identifier="A">Continue</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>`;

    await page.goto("/");
    await pasteXml(page, xml);

    const player = page.locator("qti-assessment-item-player");
    await expect(player.locator(".qti3-template-block.reference-path")).toContainText(
      "The reference path is active.",
    );
    await expect(player.locator(".qti3-template-block", { hasText: "distractor" })).toBeHidden();
    await expect(
      player.locator(".qti3-template-inline", { hasText: "generated reference" }),
    ).toBeVisible();
    await expect(
      player.locator(".qti3-template-inline", { hasText: "hidden fallback" }),
    ).toBeHidden();
  });

  test("expands math-variable template values in MathML identifiers", async ({ page }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="math-template" title="math-template" time-dependent="false">
  <qti-template-declaration identifier="A" cardinality="single" base-type="integer" math-variable="true"/>
  <qti-template-declaration identifier="B" cardinality="single" base-type="identifier"/>
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-template-processing>
    <qti-set-template-value identifier="A"><qti-base-value base-type="integer">7</qti-base-value></qti-set-template-value>
    <qti-set-template-value identifier="B"><qti-base-value base-type="identifier">unchanged</qti-base-value></qti-set-template-value>
  </qti-template-processing>
  <qti-item-body>
    <p>Rendered formula: <math><mrow><mi>A</mi><mo>+</mo><mi>B</mi></mrow></math></p>
    <qti-choice-interaction response-identifier="RESPONSE">
      <qti-simple-choice identifier="A">Continue</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>`;

    await page.goto("/");
    await pasteXml(page, xml);

    const math = page.locator("qti-assessment-item-player math");
    await expect(math.locator("mi").nth(0)).toHaveText("7");
    await expect(math.locator("mi").nth(1)).toHaveText("B");
    expect(await math.evaluate((element) => element.namespaceURI)).toBe(
      "http://www.w3.org/1998/Math/MathML",
    );
  });

  test("preserves safe HTML and MathML body content", async ({ page }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="math-body" title="math-body" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-item-body>
    <p>Evaluate <math display="block"><mrow><mi mathvariant="normal">x</mi><mo stretchy="false">+</mo><mn>1</mn></mrow></math> when x is zero.</p>
    <table>
      <thead><tr><th scope="col">Value</th><th scope="col">Result</th></tr></thead>
      <tbody><tr><td>0</td><td>1</td></tr></tbody>
    </table>
    <qti-choice-interaction response-identifier="RESPONSE">
      <qti-simple-choice identifier="A">1</qti-simple-choice>
      <qti-simple-choice identifier="B">2</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>`;

    await page.goto("/");
    await pasteXml(page, xml);

    const math = page.locator("qti-assessment-item-player math");
    await expect(math).toHaveAttribute("display", "block");
    await expect(page.locator("qti-assessment-item-player mi")).toHaveAttribute(
      "mathvariant",
      "normal",
    );
    await expect(page.locator("qti-assessment-item-player mo")).toHaveAttribute(
      "stretchy",
      "false",
    );
    await expect(page.locator("qti-assessment-item-player th").first()).toHaveAttribute(
      "scope",
      "col",
    );
    await expect(page.locator("qti-assessment-item-player table")).toContainText("Result");
    expect(await math.evaluate((element) => element.namespaceURI)).toBe(
      "http://www.w3.org/1998/Math/MathML",
    );
  });

  test("preserves authored accessibility and internationalization semantics", async ({ page }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="semantic-body" title="semantic-body" time-dependent="false" xml:lang="ja">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-prompt id="prompt-label" aria-labelledby="heading-2">選びなさい</qti-prompt>
    <h1>Heading 1</h1>
    <h2 id="heading-2" xml:lang="en">Heading 2</h2>
    <h3>Heading 3</h3>
    <h4>Heading 4</h4>
    <h5>Heading 5</h5>
    <h6>Heading 6</h6>
    <p id="bidi-ruby" dir="rtl" aria-labelledby="heading-2" aria-details="long-desc">
      <bdi>ABC</bdi>
      <bdo dir="ltr">DEF</bdo>
      <ruby xml:lang="ja"><rb>漢</rb><rp>(</rp><rt>かん</rt><rp>)</rp></ruby>
    </p>
    <p id="long-desc" class="qti-visually-hidden" aria-hidden="true">Long description.</p>
    <qti-choice-interaction response-identifier="RESPONSE">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>`;

    await page.goto("/");
    await pasteXml(page, xml);

    const player = page.locator("qti-assessment-item-player");
    await expect(player.locator("article.qti3-player")).toHaveAttribute("lang", "ja");
    await expect(player.locator("article.qti3-player")).toHaveAttribute("xml:lang", "ja");
    await expect(player.locator("#prompt-label")).toHaveAttribute("aria-labelledby", "heading-2");

    for (const level of [1, 2, 3, 4, 5, 6]) {
      await expect(player.getByRole("heading", { level, name: `Heading ${level}` })).toBeVisible();
    }

    await expect(player.locator("#heading-2")).toHaveAttribute("xml:lang", "en");
    await expect(player.locator("#heading-2")).toHaveAttribute("lang", "en");
    await expect(player.locator("#bidi-ruby")).toHaveAttribute("dir", "rtl");
    await expect(player.locator("#bidi-ruby")).toHaveAttribute("aria-details", "long-desc");
    await expect(player.locator("#long-desc")).toHaveAttribute("aria-hidden", "true");
    await expect(player.locator("bdi")).toHaveText("ABC");
    await expect(player.locator("bdo")).toHaveAttribute("dir", "ltr");
    await expect(player.locator("ruby rb")).toHaveText("漢");
    await expect(player.locator("ruby rt")).toHaveText("かん");
    await expect(player.locator("ruby rp")).toHaveCount(2);
  });

  test("keeps unsafe authored content inert while preserving safe semantics", async ({ page }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="unsafe-body" title="unsafe-body" time-dependent="false">
  <qti-item-body>
    <p id="safe" aria-hidden="true" onclick="window.qtiUnsafe = true" style="color:red">Safe text</p>
    <a id="bad-link" href="javascript:window.qtiUnsafe = true">Bad link</a>
    <script>window.qtiUnsafe = true</script>
    <style>#safe { color: red }</style>
  </qti-item-body>
</qti-assessment-item>`;

    await page.goto("/");
    await page.evaluate(() => {
      window.qtiUnsafe = false;
    });
    await pasteXml(page, xml);

    const player = page.locator("qti-assessment-item-player");
    await expect(player.locator("#safe")).toHaveAttribute("aria-hidden", "true");
    await expect(player.locator("#safe")).not.toHaveAttribute("onclick", /.*/);
    await expect(player.locator("#safe")).not.toHaveAttribute("style", /.*/);
    await expect(player.locator("#bad-link")).not.toHaveAttribute("href", /.*/);
    await expect(player.locator("script")).toHaveCount(0);
    await expect(player.locator("style")).toHaveCount(1);
    await expect(player).not.toContainText("window.qtiUnsafe");
    await expect(player).not.toContainText("#safe { color: red }");
    expect(await page.evaluate(() => window.qtiUnsafe)).toBe(false);
  });

  test("applies shared QTI accessibility vocabulary semantics", async ({ page }) => {
    const image =
      "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2010%2010'%3E%3Crect%20width='10'%20height='10'%20fill='white'/%3E%3C/svg%3E";
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="shared-vocabulary" title="shared-vocabulary" time-dependent="false">
  <qti-item-body>
    <p id="hidden" class="qti-hidden">Hidden from everyone.</p>
    <p id="visually-hidden" class="qti-visually-hidden">Screen reader only text.</p>
    <span id="diagram-label">Diagram label</span>
    <img id="diagram" src="${image}" alt="Diagram" data-qti-aria-labelledby="diagram-label" data-qti-aria-details="long-desc"/>
    <div id="long-desc" class="qti-visually-hidden" data-qti-a11y-content-role="long-description">Long description content.</div>
    <span id="suppress-all" data-qti-suppress-tts="all">$25.00</span>
    <span id="suppress-screen-reader" data-qti-suppress-tts="screen-reader">Visual-only label</span>
    <span id="suppress-read-aloud" data-qti-suppress-tts="computer-read-aloud">Screen-reader-visible label</span>
    <span id="explicit-aria" aria-label="Explicit label" data-qti-aria-label="Backup label">Named content</span>
    <span id="explicit-qti-hidden" data-qti-suppress-tts="all" data-qti-aria-hidden="false">Explicitly exposed</span>
  </qti-item-body>
</qti-assessment-item>`;

    await page.goto("/");
    await pasteXml(page, xml);

    const player = page.locator("qti-assessment-item-player");
    await expect(player.locator("#hidden")).toHaveCSS("display", "none");

    const visuallyHiddenStyle = await player.locator("#visually-hidden").evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        blockSize: style.blockSize,
        display: style.display,
        inlineSize: style.inlineSize,
        overflow: style.overflow,
        position: style.position,
      };
    });
    expect(visuallyHiddenStyle).toMatchObject({
      blockSize: "1px",
      display: "block",
      inlineSize: "1px",
      overflow: "hidden",
      position: "absolute",
    });

    await expect(player.locator("#diagram")).toHaveAttribute("aria-labelledby", "diagram-label");
    await expect(player.locator("#diagram")).toHaveAttribute("aria-details", "long-desc");
    await expect(player.locator("#diagram")).toHaveAttribute("data-qti-aria-details", "long-desc");
    await expect(player.locator("#long-desc")).toHaveAttribute(
      "data-qti-a11y-content-role",
      "long-description",
    );
    await expect(player.locator("#suppress-all")).toHaveAttribute("aria-hidden", "true");
    await expect(player.locator("#suppress-screen-reader")).toHaveAttribute("aria-hidden", "true");
    await expect(player.locator("#suppress-read-aloud")).not.toHaveAttribute("aria-hidden", /.*/);
    await expect(player.locator("#explicit-aria")).toHaveAttribute("aria-label", "Explicit label");
    await expect(player.locator("#explicit-qti-hidden")).toHaveAttribute("aria-hidden", "false");
  });

  test("exposes Data-SSML read-aloud traversal metadata", async ({ page }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="data-ssml-player" title="data-ssml-player" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <p>Read <span id="mrna" data-ssml='{"sub":{"alias":"messenger RNA"}}'>mRNA</span>.</p>
    <p><span id="skip-read-aloud" data-qti-suppress-tts="computer-read-aloud">Visual pronunciation hint.</span></p>
    <qti-choice-interaction response-identifier="RESPONSE">
      <qti-prompt id="spoken-prompt" data-ssml='{"prosody":{"rate":"slow"}}'>Choose the spoken word.</qti-prompt>
      <qti-simple-choice identifier="A" data-ssml='{"phoneme":{"ph":"t@meItoU","alphabet":"x-sampa"}}'>tomato</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>`;

    await page.goto("/");
    await pasteXml(page, xml);

    const player = page.locator("qti-assessment-item-player");
    await expect(player.locator("#mrna")).toHaveAttribute(
      "data-ssml",
      '{"sub":{"alias":"messenger RNA"}}',
    );
    await expect(player.locator("#spoken-prompt")).toHaveAttribute(
      "data-ssml",
      '{"prosody":{"rate":"slow"}}',
    );

    const traversal = await player.evaluate((element) => {
      return (
        element as HTMLElement & {
          getTextToSpeechTraversal: () =>
            | {
                diagnostics: unknown[];
                segments: Array<{
                  choiceIdentifier?: string;
                  kind: string;
                  ssml?: unknown;
                  suppressTts?: string[];
                  text: string;
                }>;
              }
            | undefined;
        }
      ).getTextToSpeechTraversal();
    });

    expect(traversal?.diagnostics).toEqual([]);
    expect(traversal?.segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "content",
          text: "mRNA",
          ssml: { sub: { alias: "messenger RNA" } },
        }),
        expect.objectContaining({
          kind: "content",
          text: "Visual pronunciation hint.",
          suppressTts: ["computer-read-aloud"],
        }),
        expect.objectContaining({
          kind: "interactionPrompt",
          text: "Choose the spoken word.",
          ssml: { prosody: { rate: "slow" } },
        }),
        expect.objectContaining({
          choiceIdentifier: "A",
          kind: "choice",
          ssml: { phoneme: { ph: "t@meItoU", alphabet: "x-sampa" } },
          text: "tomato",
        }),
      ]),
    );
  });

  test("renders object-backed media interactions with native controls", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "media");

    const audio = page.locator("qti-assessment-item-player audio");
    await expect(audio).toBeVisible();
    await expect(audio).toHaveAttribute("controls", "");
    await expect(audio).toHaveAttribute("preload", "none");
    await expect(audio).toHaveAttribute("src", /^data:audio\/wav;base64,/);
    await expect(audio).toHaveAccessibleName("Silent WAV fixture audio");
    await expect(audio).toHaveAttribute("data-play-count", "0");
  });

  test("renders authored media sources and tracks with native controls", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="video-media" title="video-media" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
        <qti-item-body>
          <qti-media-interaction response-identifier="RESPONSE" autostart="false" loop="true">
            <qti-prompt>Watch the delivery clip.</qti-prompt>
            <video width="320" height="180" data-qti-media-player-controls="default">
              <source id="mp4-source" class="primary-source" src="clips/delivery.mp4" type="video/mp4" data-qti-media-variant="primary"/>
              <source src="clips/delivery.webm"/>
              <track id="captions-track" class="caption-track" kind="captions" src="captions/delivery.vtt" srclang="en" label="English" default="default" data-qti-a11y-content-role="captions"/>
            </video>
          </qti-media-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `,
    );

    const video = page.locator("qti-assessment-item-player video");
    await expect(video).toBeVisible();
    await expect(video).toHaveAttribute("controls", "");
    await expect(video).toHaveAttribute("loop", "");
    await expect(video).toHaveAttribute("width", "320");
    await expect(video).toHaveAttribute("height", "180");
    await expect(video).toHaveAccessibleName("Watch the delivery clip.");
    await expect(video.locator("source").first()).toHaveAttribute("src", "clips/delivery.mp4");
    await expect(video.locator("source").first()).toHaveAttribute("type", "video/mp4");
    await expect(video.locator("source").first()).toHaveAttribute("id", "mp4-source");
    await expect(video.locator("source").first()).toHaveAttribute("class", "primary-source");
    await expect(video.locator("source").first()).toHaveAttribute(
      "data-qti-media-variant",
      "primary",
    );
    await expect(video.locator("source").nth(1)).toHaveAttribute("src", "clips/delivery.webm");
    await expect(video.locator("track")).toHaveAttribute("src", "captions/delivery.vtt");
    await expect(video.locator("track")).toHaveAttribute("kind", "captions");
    await expect(video.locator("track")).toHaveAttribute("srclang", "en");
    await expect(video.locator("track")).toHaveAttribute("label", "English");
    await expect(video.locator("track")).toHaveAttribute("default", "");
    await expect(video.locator("track")).toHaveAttribute("id", "captions-track");
    await expect(video.locator("track")).toHaveAttribute("class", "caption-track");
    await expect(video.locator("track")).toHaveAttribute("data-qti-a11y-content-role", "captions");
  });

  test("honors authored media control suppression without custom chrome", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="media-controls-none" title="media-controls-none" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
        <qti-item-body>
          <qti-media-interaction response-identifier="RESPONSE" autostart="true">
            <object data="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=" type="audio/wav" data-qti-media-player-controls="none">Silent audio</object>
          </qti-media-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `,
    );

    const audio = page.locator("qti-assessment-item-player audio");
    await expect(audio).not.toHaveAttribute("controls", "");
    await expect(audio).toHaveAttribute("autoplay", "");
    await expect(audio).toHaveAttribute("data-qti-media-player-controls", "none");
    await expect(page.locator("qti-assessment-item-player .qti3-actions")).toHaveCount(0);
  });

  test("maps supported media player control tokens to native controls", async ({ page }) => {
    await page.goto("/");

    for (const token of ["default", "play", "rewind", "captions", "audioDescription"] as const) {
      await pasteXml(
        page,
        `
        <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="media-controls-${token}" title="media-controls-${token}" time-dependent="false">
          <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
          <qti-item-body>
            <qti-media-interaction response-identifier="RESPONSE">
              <audio data-qti-media-player-controls="${token}">
                <source src="audio-${token}.wav" type="audio/wav"/>
              </audio>
            </qti-media-interaction>
          </qti-item-body>
        </qti-assessment-item>
      `,
      );

      const audio = page.locator("qti-assessment-item-player audio");
      await expect(audio).toHaveAttribute("controls", "");
      await expect(audio).toHaveAttribute("data-qti-media-player-controls", token);
    }

    await pasteXml(
      page,
      `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="media-controls-combined" title="media-controls-combined" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
        <qti-item-body>
          <qti-media-interaction response-identifier="RESPONSE" data-qti-media-player-controls="play captions">
            <audio>
              <source src="combined.wav" type="audio/wav"/>
            </audio>
          </qti-media-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `,
    );

    const audio = page.locator("qti-assessment-item-player audio");
    await expect(audio).toHaveAttribute("controls", "");
    await expect(audio).toHaveAttribute("data-qti-media-player-controls", "play captions");
  });

  test("renders visible native video controls for default but not none", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="video-control-visibility" title="video-control-visibility" time-dependent="false">
        <qti-response-declaration identifier="DEFAULT_RESPONSE" cardinality="single" base-type="integer"/>
        <qti-response-declaration identifier="NONE_RESPONSE" cardinality="single" base-type="integer"/>
        <qti-item-body>
          <qti-media-interaction response-identifier="DEFAULT_RESPONSE">
            <qti-prompt>Default controls video.</qti-prompt>
            <video width="320" height="180" data-qti-media-player-controls="default">
              <source src="default-controls.mp4" type="video/mp4"/>
            </video>
          </qti-media-interaction>
          <qti-media-interaction response-identifier="NONE_RESPONSE">
            <qti-prompt>No controls video.</qti-prompt>
            <video width="320" height="180" data-qti-media-player-controls="none">
              <source src="no-controls.mp4" type="video/mp4"/>
            </video>
          </qti-media-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `,
    );

    const defaultVideo = page.locator("qti-assessment-item-player video").first();
    const noneVideo = page.locator("qti-assessment-item-player video").nth(1);
    await expect(defaultVideo).toHaveAttribute("controls", "");
    await expect(noneVideo).not.toHaveAttribute("controls", "");

    await defaultVideo.hover();
    const defaultBottom = await videoBottomStripLuma(page, defaultVideo);
    await noneVideo.hover();
    const noneBottom = await videoBottomStripLuma(page, noneVideo);
    expect(
      Math.abs(defaultBottom - noneBottom),
      `default native controls bottom luminance ${defaultBottom}, none ${noneBottom}`,
    ).toBeGreaterThan(4);
  });

  test("applies media pause delay and pause duration timers", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="media-pause-timing" title="media-pause-timing" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
        <qti-item-body>
          <qti-media-interaction response-identifier="RESPONSE">
            <audio data-qti-media-player-pause-delay="0.02" data-qti-media-player-pause-duration="0.03">
              <source src="timed.wav" type="audio/wav"/>
            </audio>
          </qti-media-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `,
    );

    const audio = page.locator("qti-assessment-item-player audio");
    const result = await audio.evaluate(async (element) => {
      const media = element as HTMLMediaElement & { __qtiCalls?: string[] };
      const calls: string[] = [];
      media.__qtiCalls = calls;
      media.pause = () => {
        calls.push("pause");
        media.dispatchEvent(new Event("pause"));
      };
      media.play = () => {
        calls.push("play");
        window.setTimeout(() => media.dispatchEvent(new Event("play")), 0);
        return Promise.resolve();
      };

      media.dispatchEvent(new Event("play"));
      const delayState = media.dataset.qtiMediaPlayerPauseState;
      await new Promise((resolve) => window.setTimeout(resolve, 40));
      const playCountAfterDelay = media.dataset.playCount;

      media.dispatchEvent(new Event("pause"));
      const pauseState = media.dataset.qtiMediaPlayerPauseState;
      const callsBeforeDuration = calls.length;
      await new Promise((resolve) => window.setTimeout(resolve, 20));
      const callsDuringDuration = calls.length;
      await new Promise((resolve) => window.setTimeout(resolve, 60));

      return {
        calls,
        delayState,
        pauseState,
        callsBeforeDuration,
        callsDuringDuration,
        finalState: media.dataset.qtiMediaPlayerPauseState,
        playCountAfterDelay,
      };
    });

    expect(result.delayState).toBe("delay");
    expect(result.playCountAfterDelay).toBe("1");
    expect(result.pauseState).toBe("pause");
    expect(result.callsDuringDuration).toBe(result.callsBeforeDuration);
    expect(result.calls).toEqual(["pause", "play", "play"]);
    expect(result.finalState).toBeUndefined();
  });

  test("counts media play experiences without counting pause resume", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="media-count" title="media-count" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer">
          <qti-correct-response><qti-value>2</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-media-interaction response-identifier="RESPONSE" autostart="false" max-plays="2">
            <object data="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=" type="audio/wav">Silent audio</object>
          </qti-media-interaction>
        </qti-item-body>
        <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
      </qti-assessment-item>
    `,
    );

    const audio = page.locator("qti-assessment-item-player audio");
    await audio.evaluate((element) => element.dispatchEvent(new Event("play")));
    await expectResponse(page, 1);

    await audio.evaluate((element) => {
      element.dispatchEvent(new Event("pause"));
      element.dispatchEvent(new Event("play"));
    });
    await expectResponse(page, 1);

    await audio.evaluate((element) => {
      element.dispatchEvent(new Event("ended"));
      element.dispatchEvent(new Event("play"));
    });
    await expectResponse(page, 2);

    await audio.evaluate((element) => {
      element.dispatchEvent(new Event("ended"));
      element.dispatchEvent(new Event("play"));
    });
    await expectResponse(page, 2);
    await expect(audio).toHaveAttribute("data-max-plays-reached", "true");
  });

  test("blocks scoring until media minimum plays are met", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="media-min" title="media-min" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer">
          <qti-correct-response><qti-value>2</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-media-interaction response-identifier="RESPONSE" autostart="false" min-plays="2">
            <object data="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=" type="audio/wav">Silent audio</object>
          </qti-media-interaction>
        </qti-item-body>
        <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
      </qti-assessment-item>
    `,
    );

    const audio = page.locator("qti-assessment-item-player audio");
    await audio.evaluate((element) => element.dispatchEvent(new Event("play")));
    await page.locator("#debug-score").click();
    await expect(page.locator("#score-panel")).toHaveAttribute("data-status", "blocked");
    await expect(page.locator("#events")).toContainText("requires at least 2 plays");

    await audio.evaluate((element) => {
      element.dispatchEvent(new Event("ended"));
      element.dispatchEvent(new Event("play"));
    });
    await page.locator("#debug-score").click();
    await expect(page.locator("#score-panel")).toHaveAttribute("data-status", "scored");
    await expectResponse(page, 2);
  });

  test("captures one directed pair per gap in gap match interactions", async ({ page }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="multi-gap" title="multi-gap" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair">
    <qti-correct-response>
      <qti-value>A G1</qti-value>
      <qti-value>B G2</qti-value>
    </qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <qti-gap-match-interaction response-identifier="RESPONSE">
      <qti-gap-text identifier="A" match-max="1">Nixon</qti-gap-text>
      <qti-gap-text identifier="B" match-max="1">Lincoln</qti-gap-text>
      <p><qti-gap identifier="G1"/> resigned. <qti-gap identifier="G2"/> issued the Emancipation Proclamation.</p>
    </qti-gap-match-interaction>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`;

    await page.goto("/");
    await pasteXml(page, xml);

    await assignGap(page, "Gap match", "A", "G1");
    await assignGap(page, "Gap match", "B", "G2");

    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(state.responses.RESPONSE).toEqual(["A G1", "B G2"]);

    await page.locator("#debug-score").click();
    const scored = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(scored.outcomes.SCORE).toBe(1);
  });

  test("honors load session controls and injected XML fetchers", async ({ page }) => {
    const fixture =
      interactionFixtures.find((item) => item.interactionType === "choice") ??
      interactionFixtures[0];
    if (!fixture) throw new Error("Missing choice fixture.");

    await page.goto("/");
    await page.locator("qti-assessment-item-player").evaluate(async (element, xml) => {
      await element.loadUrl("/items/choice.xml", {
        status: "interacting",
        sessionControl: { validateResponses: false, showFeedback: false },
        fetchXml: async (url: string) => {
          if (url !== "/items/choice.xml") throw new Error(`Unexpected URL ${url}`);
          return xml;
        },
      });
    }, fixture.xml);

    const loadedState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(loadedState.status).toBe("interacting");

    await page.locator("#debug-score").click();
    const scoredState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(scoredState.validationMessages).toEqual([]);
    await expect(page.locator("#events")).not.toContainText("response.required");
  });

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

  test("renders gap match gaps in the authored sentence", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "gapMatch");

    const player = page.locator("qti-assessment-item-player");
    await expect(player).toContainText("An interaction records the candidate answer in a");
    await expect(player).toContainText("while scoring writes SCORE to an");
    await expect(player.locator(".qti3-gap-region")).not.toContainText("G1");
    await expect(player.locator(".qti3-gap-region")).not.toContainText("G2");
    await expect(player.locator(".qti3-gap-region")).not.toContainText("Empty");
    await expect(player.locator(".qti3-gap-region")).not.toContainText("Remove");

    const inlineFlow = await player.locator(".qti3-gap-region").evaluate((region) => {
      const walker = document.createTreeWalker(region, NodeFilter.SHOW_TEXT);
      let textNode: Text | undefined;
      while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        if (node.data.includes("candidate answer in a")) {
          textNode = node;
          break;
        }
      }
      if (!textNode) throw new Error("Missing text before first gap.");

      const range = document.createRange();
      const phrase = "candidate answer in a";
      const start = textNode.data.indexOf(phrase);
      range.setStart(textNode, start);
      range.setEnd(textNode, start + phrase.length);
      const textRect = range.getBoundingClientRect();
      const gapRect = region
        .querySelector<HTMLElement>('[data-gap-identifier="G1"]')
        ?.getBoundingClientRect();
      if (!gapRect) throw new Error("Missing first gap target.");

      return {
        textRight: textRect.right,
        textCenterY: textRect.top + textRect.height / 2,
        gapLeft: gapRect.left,
        gapCenterY: gapRect.top + gapRect.height / 2,
      };
    });
    expect(inlineFlow.gapLeft).toBeGreaterThan(inlineFlow.textRight);
    expect(Math.abs(inlineFlow.gapCenterY - inlineFlow.textCenterY)).toBeLessThan(24);

    await assignGap(page, "Gap match", "A", "G1");
    await expectResponse(page, ["A G1"]);
    await page.locator('qti-assessment-item-player [data-gap-identifier="G1"] button').focus();
    await page.keyboard.press("Delete");
    await expectResponse(page, []);
  });

  test("does not show an extended text counter unless authored", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "extendedText");

    await page.locator("qti-assessment-item-player textarea").fill("A concise answer");
    await expectResponse(page, "A concise answer");
    await expect(page.locator("qti-assessment-item-player .qti3-counter")).toHaveCount(0);
  });

  test("does not show an extended text counter without expected-length", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="extended-text-counter-missing-length" title="extended-text-counter-missing-length" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
  <qti-item-body>
    <qti-extended-text-interaction response-identifier="RESPONSE" class="qti-counter-up"/>
  </qti-item-body>
</qti-assessment-item>`,
    );

    await page.locator("qti-assessment-item-player textarea").fill("A concise answer");
    await expectResponse(page, "A concise answer");
    await expect(page.locator("qti-assessment-item-player .qti3-counter")).toHaveCount(0);
  });

  test("shows authored extended text character counters", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="extended-text-counter" title="extended-text-counter" time-dependent="false">
  <qti-response-declaration identifier="UP" cardinality="single" base-type="string"/>
  <qti-response-declaration identifier="DOWN" cardinality="single" base-type="string"/>
  <qti-item-body>
    <qti-extended-text-interaction response-identifier="UP" class="qti-counter-up" expected-length="20"/>
    <qti-extended-text-interaction response-identifier="DOWN" class="qti-counter-down" expected-length="20"/>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const textareas = page.locator("qti-assessment-item-player textarea");
    await textareas.nth(0).fill("A concise answer");
    await textareas.nth(1).fill("A concise answer");
    await expect(page.locator("qti-assessment-item-player .qti3-counter")).toContainText([
      "16 / 20",
      "4 / 20",
    ]);
  });

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

  test("renders under forced colors and reduced motion preferences", async ({ page }) => {
    await page.emulateMedia({
      colorScheme: "dark",
      forcedColors: "active",
      reducedMotion: "reduce",
    });
    await page.goto("/");
    await loadFixture(page, "choice");

    await expect(page.locator("qti-assessment-item-player")).toContainText(
      "Select one answer from a standard single-choice interaction.",
    );
    await page.locator('qti-assessment-item-player [data-choice-identifier="A"] input').check();
    await expectResponse(page, "A");

    const axeSource = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");
    await page.addScriptTag({ content: axeSource });
    const result = await page.evaluate(async () => {
      return await window.axe.run(document.querySelector("qti-assessment-item-player"));
    });
    expect(result.violations).toEqual([]);
  });

  test("reflows every reference interaction in a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/");
    const axeSource = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");

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

      await page.addScriptTag({ content: axeSource });
      const result = await page.evaluate(async () => {
        return await window.axe.run(document.querySelector("qti-assessment-item-player"));
      });
      expect(result.violations, fixture.id).toEqual([]);
    }
  });
});

declare global {
  interface Window {
    qtiUnsafe?: boolean;
    axe: {
      run: (context: Element | null) => Promise<{ violations: unknown[] }>;
    };
  }
}
