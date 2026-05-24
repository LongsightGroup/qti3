import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { deflateRawSync } from "node:zlib";
import { expect, test, type Locator } from "@playwright/test";
import {
  adaptiveFixtures,
  basicItemPlayerFixtures,
  basicItemPlayerToleranceFixtures,
  interactionFixtures,
  processingFixtures,
} from "../../packages/fixtures/src/index.js";

const require = createRequire(import.meta.url);

const operableControlSelector = [
  "button",
  "input",
  "select",
  "textarea",
  "audio[controls]",
  "video[controls]",
  "a[href]",
  '[role="button"]',
  '[role="slider"]',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

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

  test("renders inline choice placeholder without locale text and clears to null", async ({
    page,
  }) => {
    await page.goto("/");
    await loadFixture(page, "inlineChoice");

    const select = page.locator(
      'qti-assessment-item-player [data-response-identifier="RESPONSE_DECLARATION"] select',
    );
    await expect(select.locator("option").first()).toHaveText("");
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

  test("resolves packaged media sources and tracks from a zip upload", async ({ page }) => {
    const zip = createStoredZip({
      "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="media" type="imsqti_item_xmlv3p0" href="items/media.xml">
      <file href="items/media.xml"/>
      <file href="items/media/clip.mp4"/>
      <file href="items/captions/clip.vtt"/>
    </resource>
  </resources>
</manifest>`,
      "items/media.xml": `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="packaged-media" title="packaged-media" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
  <qti-item-body>
    <qti-media-interaction response-identifier="RESPONSE" autostart="false">
      <qti-prompt>Play the packaged clip.</qti-prompt>
      <video width="320" height="180">
        <source src="media/clip.mp4" type="video/mp4"/>
        <track kind="captions" src="captions/clip.vtt" srclang="en" label="English"/>
      </video>
    </qti-media-interaction>
  </qti-item-body>
</qti-assessment-item>`,
      "items/media/clip.mp4": Buffer.from("not-real-mp4"),
      "items/captions/clip.vtt": Buffer.from("WEBVTT\n\n00:00.000 --> 00:01.000\nCaption\n"),
    });

    await page.goto("/");
    await page.locator("#file").setInputFiles({
      name: "media-package.zip",
      mimeType: "application/zip",
      buffer: zip,
    });

    await expect(page.locator("#file-summary")).toContainText("items/media.xml");
    const video = page.locator("qti-assessment-item-player video");
    await expect(video.locator("source")).toHaveAttribute("src", /^blob:/);
    await expect(video.locator("track")).toHaveAttribute("src", /^blob:/);
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

  test("renders graphic interactions with their object context", async ({ page }) => {
    await page.goto("/");

    for (const interactionType of ["graphicOrder", "graphicAssociate", "graphicGapMatch"]) {
      await loadFixture(page, interactionType);
      if (interactionType === "graphicOrder") {
        const surface = page.locator("qti-assessment-item-player .qti3-graphic-order-surface");
        await expect(surface, interactionType).toBeVisible();
        await expect(surface.locator("img"), interactionType).toHaveAttribute(
          "src",
          /hotspot-flow\.svg$/,
        );
        await expectImageLoaded(surface.locator("img"));
        continue;
      }
      if (interactionType === "graphicAssociate") {
        const surface = page.locator("qti-assessment-item-player .qti3-graphic-associate-surface");
        await expect(surface, interactionType).toBeVisible();
        await expect(surface.locator("img"), interactionType).toHaveAttribute(
          "src",
          /hotspot-flow\.svg$/,
        );
        await expectImageLoaded(surface.locator("img"));
        continue;
      }
      const context = page.locator("qti-assessment-item-player .qti3-graphic-context");
      await expect(context, interactionType).toBeVisible();
      await expect(context.locator("img"), interactionType).toHaveAttribute(
        "src",
        /hotspot-flow\.svg$/,
      );
      await expectImageLoaded(context.locator("img"));
    }
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

  test("exposes a portable custom host contract and accepts response events", async ({ page }) => {
    await page.goto("/");
    await page.locator("qti-assessment-item-player").evaluate((element) => {
      const target = window as unknown as {
        __qti3PortableCustomMount?: Promise<{
          responseIdentifier: string;
          module: string | undefined;
          primaryConfiguration: string | undefined;
          interactionMarkupRaw: string | undefined;
        }>;
      };
      target.__qti3PortableCustomMount = new Promise((resolve) => {
        element.addEventListener(
          "qti-portable-custom-mount",
          (event) => {
            const detail = (event as CustomEvent).detail;
            resolve({
              responseIdentifier: detail.responseIdentifier,
              module: detail.definition.module,
              primaryConfiguration: detail.definition.interactionModules?.primaryConfiguration,
              interactionMarkupRaw: detail.definition.interactionMarkupRaw,
            });
          },
          { once: true },
        );
      });
    });
    await loadFixture(page, "portableCustom");

    const host = page.locator("qti-assessment-item-player .qti3-portable-custom-host");
    await expect(host).toBeVisible();
    await host.focus();
    await expect(host).toBeFocused();
    await expect(host).toHaveAttribute("data-type-identifier", "urn:qti3:fixture:portable-custom");
    await expect(host).toHaveAttribute("data-module", "fixture-portable-custom");
    await expect(host).toHaveAttribute(
      "data-primary-configuration",
      "modules/module_resolution.js",
    );
    await expect(host.locator(".qti3-fixture-pci-markup")).toHaveText(
      "Portable custom fixture markup",
    );
    const mount = await page.evaluate(() => {
      const target = window as unknown as {
        __qti3PortableCustomMount?: Promise<{
          responseIdentifier: string;
          module: string | undefined;
          primaryConfiguration: string | undefined;
          interactionMarkupRaw: string | undefined;
        }>;
      };
      return target.__qti3PortableCustomMount;
    });
    expect(mount).toEqual({
      responseIdentifier: "RESPONSE",
      module: "fixture-portable-custom",
      primaryConfiguration: "modules/module_resolution.js",
      interactionMarkupRaw:
        '<div class="qti3-fixture-pci-markup">Portable custom fixture markup</div>',
    });
    await expect(host).not.toHaveAttribute("data-interaction-markup", /.*/);

    const responseMirror = page.locator(
      "qti-assessment-item-player input.qti3-portable-custom-response",
    );
    await expect(responseMirror).toBeHidden();
    await expect(responseMirror).toHaveAttribute("aria-hidden", "true");

    await host.evaluate((element) => {
      element.dispatchEvent(
        new CustomEvent("qti3-portable-custom-response", {
          detail: { value: "A", state: { selected: ["A"], step: 1 } },
          bubbles: true,
        }),
      );
    });
    await expectResponse(page, "A");

    await page.locator("#debug-score").click();
    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(state.outcomes.SCORE).toBe(1);
    expect(state.interactionStates.RESPONSE).toEqual({ selected: ["A"], step: 1 });
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

  test("requires a single zip upload for local package loading", async ({ page }) => {
    const choice = interactionFixtures.find((item) => item.interactionType === "choice");
    const textEntry = interactionFixtures.find((item) => item.interactionType === "textEntry");
    if (!choice || !textEntry) throw new Error("Missing local-file fixtures.");

    await page.goto("/");
    await expect(page.locator("#file")).not.toHaveAttribute("multiple", "");
    await expect(page.locator("#file")).toHaveAttribute("accept", /\.zip/);
    await page.locator("#file").setInputFiles({
      name: "choice-reference.xml",
      mimeType: "application/xml",
      buffer: Buffer.from(choice.xml),
    });

    await expect(page.locator("#file-summary")).toContainText("No QTI package loaded");

    const zip = createStoredZip({
      "items/choice.xml": choice.xml,
      "items/text-entry.xml": textEntry.xml,
    });
    await page.locator("#file").setInputFiles({
      name: "loose-items.zip",
      mimeType: "application/zip",
      buffer: zip,
    });

    await expect(page.locator("#file-summary")).toContainText("1 of 2");
    await expect(page.locator("qti-assessment-item-player")).toContainText(
      "Select one answer from a standard single-choice interaction.",
    );
    await expect(page.locator("#debug-package")).toContainText('"status": "loaded"');
    await expect(page.locator("#debug-package")).toContainText('"items/choice.xml"');
    await expect(page.locator("#debug-package")).toContainText(
      '"selectedItem": "items/choice.xml"',
    );
    await expect(page.locator("#debug-action-log")).toContainText("package-load");
    await page.locator("#next-file").click();
    await expect(page.locator("#file-summary")).toContainText("2 of 2");
    await expect(page.locator("qti-assessment-item-player")).toContainText(
      "Type a short QTI outcome name in the sentence.",
    );
    await expect(page.locator("#debug-package")).toContainText(
      '"selectedItem": "items/text-entry.xml"',
    );
    await page.locator("#previous-file").click();
    await expect(page.locator("#file-summary")).toContainText("1 of 2");
  });

  test("resolves assessment-test package item references from a zip upload", async ({ page }) => {
    const choice = interactionFixtures.find((item) => item.interactionType === "choice");
    const textEntry = interactionFixtures.find((item) => item.interactionType === "textEntry");
    if (!choice || !textEntry) throw new Error("Missing package fixtures.");

    const zip = createStoredZip({
      "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="test-1" type="imsqti_test_xmlv3p0" href="assessment.xml">
      <file href="assessment.xml"/>
    </resource>
    <resource identifier="choice" type="imsqti_item_xmlv3p0" href="items/choice.xml">
      <file href="items/choice.xml"/>
    </resource>
    <resource identifier="text" type="imsqti_item_xmlv3p0" href="items/text-entry.xml">
      <file href="items/text-entry.xml"/>
    </resource>
  </resources>
</manifest>`,
      "assessment.xml": `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="test" title="US Presidents Sampler">
  <qti-test-part identifier="part-1" navigation-mode="nonlinear" submission-mode="individual">
    <qti-assessment-section identifier="section-1" visible="true">
      <qti-assessment-item-ref identifier="choice-ref" href="items/choice.xml"/>
      <qti-assessment-item-ref identifier="text-ref" href="items/text-entry.xml"/>
    </qti-assessment-section>
  </qti-test-part>
</qti-assessment-test>`,
      "items/choice.xml": choice.xml,
      "items/text-entry.xml": textEntry.xml,
    });

    await page.goto("/");
    await page.locator("#file").setInputFiles({
      name: "presidents-qti.zip",
      mimeType: "application/zip",
      buffer: zip,
    });

    await expect(page.locator("#file-summary")).toContainText("1 of 2");
    await expect(page.locator("#file-summary")).toContainText("items/choice.xml");
    await expect(page.locator("qti-assessment-item-player")).toContainText(
      "Select one answer from a standard single-choice interaction.",
    );
    await page.locator("#next-file").click();
    await expect(page.locator("#file-summary")).toContainText("2 of 2");
    await expect(page.locator("#file-summary")).toContainText("items/text-entry.xml");
    await expect(page.locator("qti-assessment-item-player")).toContainText(
      "Type a short QTI outcome name in the sentence.",
    );
  });

  test("loads ordinary deflated package zips", async ({ page }) => {
    const choice = interactionFixtures.find((item) => item.interactionType === "choice");
    if (!choice) throw new Error("Missing package fixture.");

    const zip = createDeflatedZip({
      "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="choice" type="imsqti_item_xmlv3p0" href="items/choice.xml">
      <file href="items/choice.xml"/>
    </resource>
  </resources>
</manifest>`,
      "items/choice.xml": choice.xml,
    });

    await page.goto("/");
    await page.locator("#file").setInputFiles({
      name: "deflated-package.zip",
      mimeType: "application/zip",
      buffer: zip,
    });

    await expect(page.locator("#file-summary")).toContainText("1 of 1");
    await expect(page.locator("#file-summary")).toContainText("items/choice.xml");
    await expect(page.locator("qti-assessment-item-player")).toContainText(
      "Select one answer from a standard single-choice interaction.",
    );
  });

  test("reports unreadable package zips", async ({ page }) => {
    await page.goto("/");
    await page.locator("#file").setInputFiles({
      name: "broken.zip",
      mimeType: "application/zip",
      buffer: Buffer.from("not a zip"),
    });

    await expect(page.locator("#file-summary")).toContainText("Unable to read QTI package");
    await expect(page.locator("#file-summary")).toContainText("No ZIP central directory");
    await expect(page.locator("#debug-package")).toContainText('"status": "error"');
    await expect(page.locator("#debug-package")).toContainText("No ZIP central directory");
    await expect(page.locator("#debug-action-log")).toContainText("package-error");
  });

  test("rejects package zip entries that escape the package root", async ({ page }) => {
    const choice = interactionFixtures.find((item) => item.interactionType === "choice");
    if (!choice) throw new Error("Missing package fixture.");

    const zip = createStoredZip({
      "../items/choice.xml": choice.xml,
    });

    await page.goto("/");
    await page.locator("#file").setInputFiles({
      name: "escaping-package.zip",
      mimeType: "application/zip",
      buffer: zip,
    });

    await expect(page.locator("#file-summary")).toContainText("Unable to read QTI package");
    await expect(page.locator("#file-summary")).toContainText(
      "ZIP entry ../items/choice.xml escapes the package root",
    );
  });

  test("reports package item references that escape the package root", async ({ page }) => {
    const choice = interactionFixtures.find((item) => item.interactionType === "choice");
    if (!choice) throw new Error("Missing package fixture.");

    const zip = createStoredZip({
      "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="choice" type="imsqti_item_xmlv3p0" href="../items/choice.xml">
      <file href="../items/choice.xml"/>
    </resource>
  </resources>
</manifest>`,
      "items/choice.xml": choice.xml,
    });

    await page.goto("/");
    await page.locator("#file").setInputFiles({
      name: "escaping-reference.zip",
      mimeType: "application/zip",
      buffer: zip,
    });

    await expect(page.locator("#file-summary")).toContainText("Unable to read QTI package");
    await expect(page.locator("#file-summary")).toContainText(
      "package reference ../items/choice.xml escapes the package root",
    );
  });

  test("reports package item references that do not exist", async ({ page }) => {
    const zip = createStoredZip({
      "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="choice" type="imsqti_item_xmlv3p0" href="items/missing.xml"/>
  </resources>
</manifest>`,
    });

    await page.goto("/");
    await page.locator("#file").setInputFiles({
      name: "missing-reference.zip",
      mimeType: "application/zip",
      buffer: zip,
    });

    await expect(page.locator("#file-summary")).toContainText("Unable to read QTI package");
    await expect(page.locator("#file-summary")).toContainText(
      "Package item reference items/missing.xml was not found",
    );
  });

  test("discovers manifest item resources from nested file hrefs", async ({ page }) => {
    const choice = interactionFixtures.find((item) => item.interactionType === "choice");
    if (!choice) throw new Error("Missing package fixture.");

    const zip = createStoredZip({
      "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="choice" type="imsqti_item_xmlv3p0p1">
      <file href="items/choice.xml"/>
    </resource>
  </resources>
</manifest>`,
      "items/choice.xml": choice.xml,
    });

    await page.goto("/");
    await page.locator("#file").setInputFiles({
      name: "manifest-file-href.zip",
      mimeType: "application/zip",
      buffer: zip,
    });

    await expect(page.locator("#file-summary")).toContainText("1 of 1");
    await expect(page.locator("#file-summary")).toContainText("items/choice.xml");
    await expect(page.locator("qti-assessment-item-player")).toContainText(
      "Select one answer from a standard single-choice interaction.",
    );
  });

  test("resolves relative item assets from a zip upload", async ({ page }) => {
    const graphicOrder = interactionFixtures.find(
      (item) => item.interactionType === "graphicOrder",
    );
    if (!graphicOrder) throw new Error("Missing graphic order fixture.");
    const diagram = await readFile("examples/manual/public/hotspot-flow.svg");

    const zip = createStoredZip({
      "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="graphic-order" type="imsqti_item_xmlv3p0" href="items/graphic-order.xml">
      <file href="items/graphic-order.xml"/>
      <file href="items/hotspot-flow.svg"/>
    </resource>
  </resources>
</manifest>`,
      "items/graphic-order.xml": graphicOrder.xml,
      "items/hotspot-flow.svg": diagram,
    });

    await page.goto("/");
    await page.locator("#file").setInputFiles({
      name: "graphic-package.zip",
      mimeType: "application/zip",
      buffer: zip,
    });

    await expect(page.locator("#file-summary")).toContainText("items/graphic-order.xml");
    const image = page.locator("qti-assessment-item-player .qti3-graphic-order-surface img");
    await expect(image).toHaveAttribute("src", /^blob:/);
    await expectImageLoaded(image);
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

  test("supports host lifecycle methods for state restore and attempt control", async ({
    page,
  }) => {
    const fixture =
      interactionFixtures.find((item) => item.interactionType === "choice") ??
      interactionFixtures[0];
    if (!fixture) throw new Error("Missing choice fixture.");

    await page.goto("/");
    await pasteXml(page, fixture.xml);
    await page.locator('qti-assessment-item-player [data-choice-identifier="A"] input').check();

    const answeredState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(answeredState.responses.RESPONSE).toBe("A");
    expect(answeredState.status).toBe("interacting");

    const resetState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      element.reset();
      return element.serialize();
    });
    expect(resetState.responses.RESPONSE).toBeUndefined();
    expect(resetState.status).toBe("initialized");

    const lifecycle = await page
      .locator("qti-assessment-item-player")
      .evaluate((element, state) => {
        const events: string[] = [];
        for (const eventName of ["qti-restore", "qti-suspend", "qti-endattempt"]) {
          element.addEventListener(eventName, () => events.push(eventName));
        }
        element.restore(state);
        const restored = element.serialize();
        element.suspend();
        const suspended = element.serialize();
        element.endAttempt();
        const completed = element.serialize();
        return { events, restored, suspended, completed };
      }, answeredState);

    expect(lifecycle.events).toEqual(["qti-restore", "qti-suspend", "qti-endattempt"]);
    expect(lifecycle.restored.status).toBe("interacting");
    expect(lifecycle.suspended.status).toBe("suspended");
    expect(lifecycle.completed.status).toBe("completed");
    const restoredState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(restoredState.responses.RESPONSE).toBe("A");
    expect(restoredState.outcomes.SCORE).toBe(1);
  });

  test("end-attempt interaction writes its boolean response and reveals adaptive feedback", async ({
    page,
  }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="hint-end" title="hint-end" adaptive="true" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-response-declaration identifier="HINTREQUEST" cardinality="single" base-type="boolean"/>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <p>Use the hint control to request adaptive feedback.</p>
    <qti-choice-interaction response-identifier="RESPONSE" min-choices="0">
      <qti-simple-choice identifier="A">Correct</qti-simple-choice>
      <qti-simple-choice identifier="B">Incorrect</qti-simple-choice>
    </qti-choice-interaction>
    <qti-end-attempt-interaction response-identifier="HINTREQUEST" title="Show Hint"/>
    <qti-feedback-block identifier="HINT" outcome-identifier="FEEDBACK" show-hide="show">
      <qti-content-body><p>Hint feedback is now visible.</p></qti-content-body>
    </qti-feedback-block>
  </qti-item-body>
  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-variable identifier="HINTREQUEST"/>
        <qti-set-outcome-value identifier="FEEDBACK">
          <qti-base-value base-type="identifier">HINT</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-if>
    </qti-response-condition>
    <qti-response-condition>
      <qti-response-if>
        <qti-match><qti-variable identifier="RESPONSE"/><qti-correct identifier="RESPONSE"/></qti-match>
        <qti-set-outcome-value identifier="SCORE">
          <qti-base-value base-type="float">1</qti-base-value>
        </qti-set-outcome-value>
        <qti-set-outcome-value identifier="completionStatus">
          <qti-base-value base-type="identifier">completed</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-if>
    </qti-response-condition>
  </qti-response-processing>
</qti-assessment-item>`;

    await page.goto("/");
    await pasteXml(page, xml);
    await page.getByRole("button", { name: "Show Hint" }).click();

    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(state.responses.HINTREQUEST).toBe(true);
    expect(state.outcomes.FEEDBACK).toBe("HINT");
    expect(state.status).toBe("interacting");
    await expect(page.locator("qti-assessment-item-player .qti3-feedback-block")).toContainText(
      "Hint feedback is now visible.",
    );

    await page.locator('qti-assessment-item-player [data-choice-identifier="A"] input').check();
    await page.locator("#debug-score").click();

    const completedState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(completedState.outcomes.completionStatus).toBe("completed");
    expect(completedState.status).toBe("completed");
  });

  test("end-attempt does not complete an invalid attempt", async ({ page }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="blocked-end" title="blocked-end" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-response-declaration identifier="END" cardinality="single" base-type="boolean"/>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE">
      <qti-simple-choice identifier="A">Correct</qti-simple-choice>
      <qti-simple-choice identifier="B">Incorrect</qti-simple-choice>
    </qti-choice-interaction>
    <qti-end-attempt-interaction response-identifier="END" title="Finish"/>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`;

    await page.goto("/");
    await pasteXml(page, xml);
    await page.getByRole("button", { name: "Finish" }).click();

    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(state.responses.END).toBe(true);
    expect(state.status).toBe("interacting");
    expect(state.validationMessages).toEqual([
      expect.objectContaining({ code: "response.required", path: "RESPONSE" }),
    ]);
    await expect(page.locator("#score-status")).toHaveText(
      "Score blocked by 1 validation message.",
    );

    const restoredState = await page
      .locator("qti-assessment-item-player")
      .evaluate((element, attemptState) => {
        element.reset();
        element.restore(attemptState);
        attemptState.validationMessages[0]!.message = "mutated after restore";
        return element.serialize();
      }, state);
    await expect(
      page.locator('qti-assessment-item-player [data-choice-identifier="A"] input'),
    ).toHaveAttribute("aria-invalid", "true");
    expect(restoredState.validationMessages).toEqual(state.validationMessages);
  });

  test("response state events preserve remaining restored validation messages", async ({
    page,
  }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="multi-validation" title="multi-validation" time-dependent="false">
  <qti-response-declaration identifier="FIRST" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-response-declaration identifier="SECOND" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>C</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <p>Answer both required choices.</p>
    <qti-choice-interaction response-identifier="FIRST">
      <qti-simple-choice identifier="A">First answer</qti-simple-choice>
      <qti-simple-choice identifier="B">Other first answer</qti-simple-choice>
    </qti-choice-interaction>
    <qti-choice-interaction response-identifier="SECOND">
      <qti-simple-choice identifier="C">Second answer</qti-simple-choice>
      <qti-simple-choice identifier="D">Other second answer</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`;

    await page.goto("/");
    await pasteXml(page, xml);
    await page.locator("#debug-score").click();

    const blockedState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(blockedState.validationMessages.map((message) => message.path)).toEqual([
      "FIRST",
      "SECOND",
    ]);

    const emittedState = await page
      .locator("qti-assessment-item-player")
      .evaluate(async (element, attemptState) => {
        element.reset();
        element.restore(attemptState);
        const nextState = new Promise((resolve) => {
          element.addEventListener("qti-statechange", (event) => resolve(event.detail.state), {
            once: true,
          });
        });
        const firstChoice = element.querySelector<HTMLInputElement>(
          '[data-response-identifier="FIRST"] [data-choice-identifier="A"] input',
        );
        if (!firstChoice) throw new Error("Missing first choice control.");
        firstChoice.click();
        return nextState;
      }, blockedState);

    expect(emittedState.responses.FIRST).toBe("A");
    expect(emittedState.validationMessages).toEqual([
      expect.objectContaining({ code: "response.required", path: "SECOND" }),
    ]);
  });

  test("completed attempts render as non-mutable review state", async ({ page }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="completed-review" title="completed-review" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-response-declaration identifier="END" cardinality="single" base-type="boolean"/>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE">
      <qti-simple-choice identifier="A">Correct</qti-simple-choice>
      <qti-simple-choice identifier="B">Incorrect</qti-simple-choice>
    </qti-choice-interaction>
    <qti-end-attempt-interaction response-identifier="END" title="Finish"/>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`;

    await page.goto("/");
    await pasteXml(page, xml);
    await page.locator('qti-assessment-item-player [data-choice-identifier="A"] input').check();
    await page.getByRole("button", { name: "Finish" }).click();

    await expect(page.locator("qti-assessment-item-player")).toHaveAttribute(
      "data-status",
      "completed",
    );
    await expect(
      page.locator('qti-assessment-item-player [data-choice-identifier="A"] input'),
    ).toBeDisabled();
    await expect(
      page.locator('qti-assessment-item-player [data-choice-identifier="B"] input'),
    ).toBeDisabled();
    await expect(
      page.locator('qti-assessment-item-player [data-interaction-type="endAttempt"] button'),
    ).toBeDisabled();
    await expect(page.locator("qti-assessment-item-player .qti3-actions")).toHaveCount(0);

    const completedState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(completedState.responses.RESPONSE).toBe("A");

    const restoredCompletedState = await page
      .locator("qti-assessment-item-player")
      .evaluate((element, state) => {
        element.reset();
        element.restore(state);
        const choice = element.querySelector<HTMLInputElement>(
          '[data-choice-identifier="B"] input',
        );
        choice?.click();
        return element.serialize();
      }, completedState);
    expect(restoredCompletedState.responses.RESPONSE).toBe("A");
    await expect(
      page.locator('qti-assessment-item-player [data-choice-identifier="A"] input'),
    ).toBeDisabled();
    await expect(
      page.locator('qti-assessment-item-player [data-choice-identifier="B"] input'),
    ).toBeDisabled();

    await page.locator("#debug-reset").click();
    await expect(page.locator("qti-assessment-item-player")).toHaveAttribute(
      "data-status",
      "initialized",
    );
    await expect(
      page.locator('qti-assessment-item-player [data-choice-identifier="B"] input'),
    ).toBeEnabled();
  });

  test("restores serialized responses into visible controls", async ({ page }) => {
    await page.goto("/");
    const restoreCurrentAttempt = async () => {
      const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
        return element.serialize();
      });
      await page.locator("qti-assessment-item-player").evaluate((element, attemptState) => {
        element.reset();
        element.restore(attemptState);
      }, state);
    };

    await loadFixture(page, "choice");
    await page.locator('qti-assessment-item-player [data-choice-identifier="A"] input').check();
    await restoreCurrentAttempt();
    await expect(
      page.locator('qti-assessment-item-player [data-choice-identifier="A"] input'),
    ).toBeChecked();
    await expect(
      page.locator('qti-assessment-item-player .qti3-choice-option[data-choice-identifier="A"]'),
    ).toHaveAttribute("data-selected", "true");

    await loadFixture(page, "textEntry");
    await page
      .locator('qti-assessment-item-player input:not([type="file"]):not([type="range"])')
      .fill("SCORE");
    await restoreCurrentAttempt();
    await expect(
      page.locator('qti-assessment-item-player input:not([type="file"]):not([type="range"])'),
    ).toHaveValue("SCORE");
    await expect(page.locator("qti-assessment-item-player .qti3-inline-counter")).toHaveCount(0);

    await loadFixture(page, "order");
    await page
      .locator('qti-assessment-item-player .qti3-reorder-handle[data-choice-identifier="B"]')
      .focus();
    await page.keyboard.press("ArrowUp");
    await restoreCurrentAttempt();
    await expect(
      page.locator("qti-assessment-item-player .qti3-reorder-item").first(),
    ).toHaveAttribute("data-choice-identifier", "B");

    await loadFixture(page, "hotspot");
    await page
      .locator("qti-assessment-item-player .qti3-hotspot-surface")
      .getByRole("button", { name: "A" })
      .click();
    await restoreCurrentAttempt();
    await expect(
      page.locator("qti-assessment-item-player .qti3-hotspot-button[data-choice-identifier='A']"),
    ).toHaveAttribute("data-selected", "true");
    await expect(page.locator("qti-assessment-item-player .qti3-selection-summary")).toContainText(
      "Selected A",
    );
  });

  test("supports keyboard-only response entry for representative native controls", async ({
    page,
  }) => {
    await page.goto("/");

    await loadFixture(page, "choice");
    await page.locator('qti-assessment-item-player [data-choice-identifier="A"] input').focus();
    await page.keyboard.press("Space");
    await expectResponse(page, "A");
    await expect(
      page.locator('qti-assessment-item-player .qti3-choice-option[data-choice-identifier="A"]'),
    ).toHaveAttribute("data-selected", "true");

    await loadFixture(page, "textEntry");
    await page
      .locator('qti-assessment-item-player input:not([type="file"]):not([type="range"])')
      .focus();
    await page.keyboard.type("A");
    await expectResponse(page, "A");
    await expect(page.locator("qti-assessment-item-player .qti3-inline-counter")).toHaveCount(0);

    await loadFixture(page, "slider");
    await page.locator('qti-assessment-item-player input[type="range"]').focus();
    for (let index = 0; index < 50; index += 1) {
      await page.keyboard.press("ArrowRight");
    }
    await expectResponse(page, 50);
    await expect(page.locator("qti-assessment-item-player output")).toHaveText("50");

    await loadFixture(page, "positionObject");
    await expectResponse(page, undefined);
    await expect(page.locator("qti-assessment-item-player .qti3-coordinate-output")).toContainText(
      "Object not placed",
    );
    await page.locator("qti-assessment-item-player .qti3-position-object-stage").focus();
    await page.keyboard.press("ArrowRight");
    await expectResponse(page, undefined);
    await page.keyboard.press("Enter");
    await expectResponse(page, "1 0");
    await page.getByRole("button", { name: "Move object right" }).click();
    await expectResponse(page, "2 0");
    await expect(page.locator("qti-assessment-item-player .qti3-coordinate-output")).toContainText(
      "Object positioned at 2 0",
    );

    await loadFixture(page, "drawing");
    await page.locator("qti-assessment-item-player .qti3-drawing-surface").focus();
    await page.keyboard.press("Enter");
    await expectStringResponse(page, /^data:image\/svg\+xml;charset=utf-8,/);
  });

  test("supports keyboard-only response entry for remaining fixture controls", async ({ page }) => {
    await page.goto("/");

    await loadFixture(page, "hottext");
    await page
      .locator('qti-assessment-item-player .qti3-hottext-token[data-choice-identifier="A"]')
      .focus();
    await page.keyboard.press("Space");
    await expectResponse(page, "A");

    await loadFixture(page, "gapMatch");
    await page.locator('qti-assessment-item-player [data-choice-identifier="A"]').focus();
    await page.keyboard.press("Enter");
    await page
      .locator('qti-assessment-item-player [data-gap-identifier="G1"]')
      .getByRole("button")
      .first()
      .focus();
    await page.keyboard.press("Enter");
    await expectResponse(page, ["A G1"]);

    await loadFixture(page, "extendedText");
    await page.locator("qti-assessment-item-player textarea").focus();
    await page.keyboard.type("A concise answer");
    await expectResponse(page, "A concise answer");

    await loadFixture(page, "endAttempt");
    await page
      .locator('qti-assessment-item-player [data-interaction-type="endAttempt"]')
      .getByRole("button")
      .focus();
    await page.keyboard.press("Enter");
    await expectResponse(page, true);
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

  test("exposes accessible names for every operable fixture control", async ({ page }) => {
    await page.goto("/");

    for (const fixture of interactionFixtures) {
      await page.locator("#fixture").selectOption(fixture.id);
      await page.locator("#load-fixture").click();

      const controls = page.locator("qti-assessment-item-player").locator(operableControlSelector);
      const count = await controls.count();
      expect(count, fixture.id).toBeGreaterThan(0);
      for (let index = 0; index < count; index += 1) {
        const control = controls.nth(index);
        if (!(await control.isVisible())) continue;
        await expect(control, `${fixture.id} control ${index}`).toHaveAccessibleName(/.+/);
      }
    }
  });

  test("keeps operable fixture controls in standard tab order", async ({ page }) => {
    await page.goto("/");

    for (const fixture of interactionFixtures) {
      await page.locator("#fixture").selectOption(fixture.id);
      await page.locator("#load-fixture").click();

      const result = await page
        .locator("qti-assessment-item-player")
        .evaluate((player, selector) => {
          const isVisible = (element: HTMLElement): boolean => {
            const style = window.getComputedStyle(element);
            return (
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              element.getClientRects().length > 0
            );
          };
          const describe = (element: HTMLElement): string => {
            const label =
              element.getAttribute("aria-label") ??
              element.getAttribute("title") ??
              element.textContent?.trim() ??
              element.getAttribute("value") ??
              element.tagName.toLowerCase();
            return `${element.tagName.toLowerCase()} ${label.replace(/\s+/g, " ").slice(0, 80)}`;
          };
          const controls = Array.from(player.querySelectorAll<HTMLElement>(selector)).filter(
            (element) => {
              if (!isVisible(element)) return false;
              if (element.getAttribute("aria-hidden") === "true") return false;
              if (element instanceof HTMLInputElement && element.type === "hidden") return false;
              if ("disabled" in element && Boolean((element as HTMLButtonElement).disabled)) {
                return false;
              }
              return true;
            },
          );
          return {
            controlCount: controls.length,
            positiveTabIndex: controls
              .filter((element) => element.tabIndex > 0)
              .map((element) => describe(element)),
            unfocusable: controls
              .filter((element) => element.tabIndex < 0)
              .map((element) => describe(element)),
            focusFailures: controls
              .filter((element) => {
                element.focus();
                return document.activeElement !== element;
              })
              .map((element) => describe(element)),
          };
        }, operableControlSelector);

      expect(result.controlCount, fixture.id).toBeGreaterThan(0);
      expect(result.positiveTabIndex, `${fixture.id} positive tabindex controls`).toEqual([]);
      expect(result.unfocusable, `${fixture.id} unfocusable operable controls`).toEqual([]);
      expect(result.focusFailures, `${fixture.id} controls that reject focus`).toEqual([]);
    }
  });

  test("shows visible focus indicators for custom controls", async ({ page }) => {
    await page.goto("/");

    for (const interactionType of ["order", "associate", "hotspot"]) {
      await loadFixture(page, interactionType);
      const result = await page.locator("qti-assessment-item-player").evaluate((player) => {
        const control = player.querySelector<HTMLElement>(".qti3-token, .qti3-hotspot-button");
        if (!control) return { found: false };
        control.focus();
        const style = window.getComputedStyle(control);
        const outlineWidth = Number.parseFloat(style.outlineWidth || "0");
        const hasOutline = style.outlineStyle !== "none" && outlineWidth >= 2;
        const hasShadow = style.boxShadow !== "none";
        return {
          found: true,
          active: document.activeElement === control,
          outlineStyle: style.outlineStyle,
          outlineWidth,
          boxShadow: style.boxShadow,
          hasIndicator: hasOutline || hasShadow,
        };
      });

      expect(result.found, interactionType).toBe(true);
      expect(result.active, interactionType).toBe(true);
      expect(result.hasIndicator, `${interactionType} focus indicator`).toBe(true);
    }
  });

  test("shows extended text word and character feedback", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "extendedText");

    await page.locator("qti-assessment-item-player textarea").fill("A concise answer");
    await expectResponse(page, "A concise answer");
    await expect(page.locator("qti-assessment-item-player .qti3-counter")).toContainText(
      "16 characters, 3 words",
    );
  });

  test("reorders order interactions with keyboard controls", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "order");

    await expect(page.getByRole("button", { name: "Use current order" })).toHaveCount(0);
    await page
      .locator('qti-assessment-item-player .qti3-reorder-handle[data-choice-identifier="B"]')
      .focus();
    await page.keyboard.press("ArrowUp");
    await expectResponse(page, ["B", "A", "C"]);
    await expect(page.locator("qti-assessment-item-player .qti3-selection-summary")).toHaveText(
      /moved up\.$/,
    );
    await expect(
      page.locator(
        'qti-assessment-item-player .qti3-reorder-handle[data-choice-identifier="B"]',
      ),
    ).toBeFocused();

    await page.keyboard.press("ArrowDown");
    await expectResponse(page, ["A", "B", "C"]);
    await expect(
      page.locator(
        'qti-assessment-item-player .qti3-reorder-handle[data-choice-identifier="B"]',
      ),
    ).toBeFocused();

    await expectMoveButtons(
      page.locator(
        'qti-assessment-item-player .qti3-reorder-item[data-choice-identifier="B"] .qti3-move-button',
      ),
      ["up", "down"],
    );
    await page
      .locator(
        'qti-assessment-item-player .qti3-reorder-item[data-choice-identifier="B"] [data-move-direction="down"]',
      )
      .click();
    await expectResponse(page, ["A", "C", "B"]);
    await expect(page.locator("qti-assessment-item-player .qti3-selection-summary")).toHaveText(
      /moved down\.$/,
    );
  });

  test("renders point movement controls as arrow icon buttons", async ({ page }) => {
    await page.goto("/");

    for (const fixture of ["selectPoint", "positionObject"]) {
      await loadFixture(page, fixture);
      await expectMoveButtons(
        page.locator("qti-assessment-item-player .qti3-point-controls .qti3-move-button"),
        ["up", "left", "right", "down"],
      );
    }
  });

  test("orders graphic order hotspots with pointer and keyboard controls", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "graphicOrder");

    const surface = page.locator("qti-assessment-item-player .qti3-graphic-order-surface");
    await expect(surface.getByRole("button", { name: "Item XML" })).toBeVisible();
    await expect(surface.getByRole("button", { name: "Response capture" })).toBeVisible();

    await surface.getByRole("button", { name: "Response capture" }).click();
    await expectResponse(page, ["B"]);
    await expect(surface.getByRole("button", { name: "Response capture" })).toHaveAttribute(
      "data-order",
      "1",
    );

    await surface.getByRole("button", { name: "Item XML" }).click();
    await surface.getByRole("button", { name: "Outcomes" }).click();
    await expectResponse(page, ["B", "A", "C"]);
    await expect(surface.locator("svg.qti3-graphic-sequence-lines line")).toHaveCount(2);

    await expectMoveButtons(
      page.locator(
        'qti-assessment-item-player .qti3-graphic-order-item[data-choice-identifier="B"] .qti3-move-button',
      ),
      ["up", "down"],
    );
    await page
      .locator(
        'qti-assessment-item-player .qti3-graphic-order-item[data-choice-identifier="B"] [data-move-direction="down"]',
      )
      .click();
    await expectResponse(page, ["A", "B", "C"]);
    await expect(page.locator("qti-assessment-item-player .qti3-selection-summary")).toHaveText(
      /Response capture moved down\.$/,
    );

    await surface.getByRole("button", { name: "Outcomes" }).focus();
    await page.keyboard.press("Delete");
    await expectResponse(page, ["A", "B"]);
  });

  test("creates and removes associate pairs with keyboard-accessible tokens", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "associate");

    await expect(page.locator("qti-assessment-item-player .qti3-pair-selector")).toContainText(
      "First concept",
    );
    await expect(page.locator("qti-assessment-item-player .qti3-pair-selector")).toContainText(
      "Pair with",
    );
    await page
      .locator('qti-assessment-item-player [aria-label="Associate sources"]')
      .locator('[data-choice-identifier="A"]')
      .focus();
    await page.keyboard.press("Enter");
    await expect(
      page
        .locator('qti-assessment-item-player [aria-label="Associate targets"]')
        .locator('[data-choice-identifier="A"]'),
    ).toBeVisible();
    await expect(
      page
        .locator('qti-assessment-item-player [aria-label="Associate targets"]')
        .locator('[data-choice-identifier="A"]'),
    ).toBeEnabled();
    await expect(
      page
        .locator('qti-assessment-item-player [aria-label="Associate targets"]')
        .locator(".qti3-token:visible"),
    ).toHaveCount(3);
    await page
      .locator('qti-assessment-item-player [aria-label="Associate targets"]')
      .locator('[data-choice-identifier="B"]')
      .focus();
    await page.keyboard.press("Enter");
    await expectResponse(page, ["A B"]);

    await page.locator("qti-assessment-item-player .qti3-pair-list button").click();
    await expectResponse(page, []);

    const source = page
      .locator('qti-assessment-item-player [aria-label="Associate sources"]')
      .locator('[data-choice-identifier="A"]');
    const target = page
      .locator('qti-assessment-item-player [aria-label="Associate targets"]')
      .locator('[data-choice-identifier="B"]');
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    if (!sourceBox || !targetBox) throw new Error("Missing associate drag boxes.");

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
    await page.mouse.up();
    await expectResponse(page, ["A B"]);
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
  });

  test("creates graphic associate pairs on positioned hotspots", async ({ page }) => {
    await page.goto("/");

    await loadFixture(page, "graphicAssociate");
    const surface = page.locator("qti-assessment-item-player .qti3-graphic-associate-surface");
    await expect(surface.locator("img")).toHaveAttribute("src", /hotspot-flow\.svg$/);
    await expect(surface.getByRole("button", { name: "Item XML" })).toHaveAttribute(
      "data-choice-identifier",
      "A",
    );
    await expect(surface.getByRole("button", { name: "Response capture" })).toHaveCSS(
      "position",
      "absolute",
    );
    await expectImageLoaded(surface.locator("img"));

    await surface.getByRole("button", { name: "Item XML" }).click();
    await expect(surface.getByRole("button", { name: "Item XML" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await surface.getByRole("button", { name: "Response capture" }).click();
    await expectResponse(page, ["A B"]);
    await expect(surface.locator("svg.qti3-graphic-associate-lines line")).toHaveCount(1);
    await expect(page.locator("qti-assessment-item-player .qti3-pair-list")).toContainText(
      "Item XML to Response capture",
    );
    await surface.getByRole("button", { name: "Item XML" }).click();
    await surface.getByRole("button", { name: "Processing rules" }).click();
    await expectResponse(page, ["A B"]);

    const remove = page.getByRole("button", { name: "Remove Item XML to Response capture" });
    const trashIcon = remove.locator("svg.qti3-trash-icon");
    await expect(trashIcon).toHaveCount(1);
    await expect(trashIcon).toHaveAttribute("xmlns", "http://www.w3.org/2000/svg");
    await expect(trashIcon).toHaveAttribute("width", "24");
    await expect(trashIcon).toHaveAttribute("height", "24");
    await expect(trashIcon).toHaveAttribute("fill", "none");
    await expect(trashIcon).toHaveAttribute("stroke", "currentColor");
    const hiddenPathStroke = await remove
      .locator("svg.qti3-trash-icon path")
      .first()
      .evaluate((path) => getComputedStyle(path).stroke);
    expect(hiddenPathStroke).toBe("none");
    await expect(remove).toHaveAttribute("title", "Remove");
    await remove.click();
    await expectResponse(page, []);
    await expect(surface.locator("svg.qti3-graphic-associate-lines line")).toHaveCount(0);
  });

  test("resolves player language-of-interface and message overrides", async ({ page }) => {
    await page.goto("/");
    const browserLocale = await page.locator("qti-assessment-item-player").evaluate((element) => {
      const language = navigator.languages[0] ?? navigator.language;
      return {
        locale: (element as HTMLElement & { languageOfInterface: string }).languageOfInterface,
        expected: Intl.getCanonicalLocales(language)[0],
      };
    });
    expect(browserLocale.locale).toBe(browserLocale.expected);
    const locale = await page.locator("qti-assessment-item-player").evaluate((element) => {
      element.setAttribute("language-of-interface", "es-MX");
      return (element as HTMLElement & { languageOfInterface: string }).languageOfInterface;
    });
    expect(locale).toBe("es-MX");
    await page.locator("qti-assessment-item-player").evaluate((element) => {
      (
        element as HTMLElement & {
          messages: {
            remove: () => string;
            removePair: (params: { label: string }) => string;
          };
        }
      ).messages = {
        remove: () => "Eliminar",
        removePair: ({ label }) => `Eliminar ${label}`,
      };
    });
    await loadFixture(page, "graphicAssociate");

    const surface = page.locator("qti-assessment-item-player .qti3-graphic-associate-surface");
    await surface.getByRole("button", { name: "Item XML" }).click();
    await surface.getByRole("button", { name: "Response capture" }).click();

    const remove = page.getByRole("button", { name: "Eliminar Item XML to Response capture" });
    await expect(remove).toHaveAttribute("title", "Eliminar");
    await expect(remove.locator("svg.qti3-trash-icon")).toHaveCount(1);
    await remove.click();
    await expectResponse(page, []);
  });

  test("switches language-of-interface from the manual harness", async ({ page }) => {
    await page.goto("/");
    await page.locator("#language-of-interface").selectOption("de-DE");
    await loadFixture(page, "graphicAssociate");

    const surface = page.locator("qti-assessment-item-player .qti3-graphic-associate-surface");
    await surface.getByRole("button", { name: "Item XML" }).click();
    await surface.getByRole("button", { name: "Response capture" }).click();

    const remove = page.getByRole("button", {
      name: "Item XML to Response capture entfernen",
    });
    await expect(remove).toHaveAttribute("title", "Entfernen");
    await remove.click();
    await expectResponse(page, []);
  });

  test("uses built-in player chrome locale catalogs", async ({ page }) => {
    await page.goto("/");
    const examples = [
      {
        locale: "es-MX",
        title: "Quitar",
        removeName: "Quitar Item XML to Response capture",
      },
      {
        locale: "es-ES",
        title: "Quitar",
        removeName: "Quitar Item XML to Response capture",
      },
      {
        locale: "sv-SE",
        title: "Ta bort",
        removeName: "Ta bort Item XML to Response capture",
      },
      {
        locale: "de-DE",
        title: "Entfernen",
        removeName: "Item XML to Response capture entfernen",
      },
      {
        locale: "pt-BR",
        title: "Remover",
        removeName: "Remover Item XML to Response capture",
      },
      {
        locale: "pt-PT",
        title: "Remover",
        removeName: "Remover Item XML to Response capture",
      },
      {
        locale: "fr-FR",
        title: "Supprimer",
        removeName: "Supprimer Item XML to Response capture",
      },
    ];

    for (const example of examples) {
      await page.locator("qti-assessment-item-player").evaluate((element, locale) => {
        (element as HTMLElement & { languageOfInterface: string }).languageOfInterface = locale;
        (
          element as HTMLElement & {
            messages: undefined;
          }
        ).messages = undefined;
      }, example.locale);
      await loadFixture(page, "graphicAssociate");

      const surface = page.locator("qti-assessment-item-player .qti3-graphic-associate-surface");
      await surface.getByRole("button", { name: "Item XML" }).click();
      await surface.getByRole("button", { name: "Response capture" }).click();

      const remove = page.getByRole("button", { name: example.removeName });
      await expect(remove, example.locale).toHaveAttribute("title", example.title);
      await expect(remove.locator("svg.qti3-trash-icon"), example.locale).toHaveCount(1);
      await remove.click();
      await expectResponse(page, []);
    }
  });

  test("infers inline SVG dimensions and supports dragging graphic associate lines", async ({
    page,
  }) => {
    await page.goto("/");
    const timelineSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="260" viewBox="0 0 480 260"><rect width="480" height="260" fill="#f4f2ea"/><line x1="80" y1="130" x2="400" y2="130" stroke="#b08d57" stroke-width="6"/><circle cx="120" cy="90" r="18" fill="#2f4858"/><circle cx="120" cy="170" r="18" fill="#2f4858"/><circle cx="360" cy="90" r="18" fill="#2f4858"/><circle cx="360" cy="170" r="18" fill="#2f4858"/></svg>`;
    const image = `data:image/svg+xml,${encodeURIComponent(timelineSvg)}`;
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="inline-svg-graphic-associate" title="inline-svg-graphic-associate" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="pair">
    <qti-correct-response><qti-value>A B</qti-value><qti-value>C D</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-item-body>
    <qti-graphic-associate-interaction response-identifier="RESPONSE" max-associations="2">
      <qti-prompt>Select or drag between matching era markers.</qti-prompt>
      <object data="${image}" type="image/png">Timeline graphic with paired era markers.</object>
      <qti-associable-hotspot identifier="A" shape="circle" coords="120,90,18" match-max="1"/>
      <qti-associable-hotspot identifier="B" shape="circle" coords="120,170,18" match-max="1"/>
      <qti-associable-hotspot identifier="C" shape="circle" coords="360,90,18" match-max="1"/>
      <qti-associable-hotspot identifier="D" shape="circle" coords="360,170,18" match-max="1"/>
    </qti-graphic-associate-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const surface = page.locator("qti-assessment-item-player .qti3-graphic-associate-surface");
    const box = await surface.boundingBox();
    expect(box?.width).toBe(480);
    expect(box?.height).toBe(260);
    await expect(surface.getByRole("button", { name: "Region 4" })).toBeVisible();

    const source = surface.getByRole("button", { name: "Region 1" });
    const target = surface.getByRole("button", { name: "Region 2" });
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    if (!sourceBox || !targetBox) throw new Error("Missing graphic associate drag boxes.");

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
    await page.mouse.up();

    await expectResponse(page, ["A B"]);
    await expect(surface.locator("svg.qti3-graphic-associate-lines line")).toHaveCount(1);
  });

  test("supports keyboard graphic associate pairing and deletion", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "graphicAssociate");

    const surface = page.locator("qti-assessment-item-player .qti3-graphic-associate-surface");
    await surface.getByRole("button", { name: "Item XML" }).focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowRight");
    await expect(surface.getByRole("button", { name: "Response capture" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expectResponse(page, ["A B"]);

    await page.keyboard.press("Delete");
    await expectResponse(page, []);
  });

  test("assigns graphic gap match choices with pointer drag and removal", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "graphicGapMatch");

    await expect(
      page.locator("qti-assessment-item-player .qti3-graphic-context img"),
    ).toHaveAttribute("src", /hotspot-flow\.svg$/);
    await expectImageLoaded(page.locator("qti-assessment-item-player .qti3-graphic-context img"));
    await expect(page.locator("qti-assessment-item-player .qti3-gap-region")).toBeVisible();
    await expect(
      page.locator("qti-assessment-item-player .qti3-gap-button").first(),
    ).toHaveAccessibleName("Gap 1, empty");
    await expect(page.locator("qti-assessment-item-player .qti3-gap-button").first()).toHaveText(
      "",
    );
    await expect(page.locator("qti-assessment-item-player .qti3-gap-region")).not.toContainText(
      "Empty",
    );
    await expect(page.locator("qti-assessment-item-player .qti3-gap-region")).not.toContainText(
      "G1",
    );
    const gapRowSpacing = await page
      .locator("qti-assessment-item-player .qti3-gap-region")
      .evaluate((gapRegion) => {
        const sourceRegion = gapRegion.previousElementSibling;
        if (!sourceRegion) return 0;
        return gapRegion.getBoundingClientRect().top - sourceRegion.getBoundingClientRect().bottom;
      });
    expect(gapRowSpacing).toBeGreaterThanOrEqual(6);

    const source = page.locator('qti-assessment-item-player [data-choice-identifier="A"]').first();
    const target = page.locator('qti-assessment-item-player [data-gap-identifier="G1"]').first();
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    if (!sourceBox || !targetBox) throw new Error("Missing graphic gap drag boxes.");

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
    await page.mouse.up();
    await expectResponse(page, ["A G1"]);
    await expect(
      target.getByRole("button", { name: "Gap 1, assigned response declaration" }),
    ).toHaveText("response declaration");

    await target.getByRole("button", { name: "Gap 1, assigned response declaration" }).focus();
    await page.keyboard.press("Delete");
    await expectResponse(page, []);
  });

  test("renders hotspot-backed graphic gap match targets on the image", async ({ page }) => {
    await page.goto("/");
    const timelineSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="260" viewBox="0 0 480 260"><rect width="480" height="260" fill="#f4f2ea"/><line x1="80" y1="130" x2="400" y2="130" stroke="#b08d57" stroke-width="6"/><circle cx="120" cy="130" r="18" fill="#2f4858"/><circle cx="240" cy="130" r="18" fill="#2f4858"/><circle cx="360" cy="130" r="18" fill="#2f4858"/></svg>`;
    const image = `data:image/svg+xml;base64,${Buffer.from(timelineSvg).toString("base64")}`;
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="hotspot-backed-graphic-gap-match" title="hotspot-backed-graphic-gap-match" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair">
    <qti-correct-response><qti-value>A T1</qti-value><qti-value>B T2</qti-value><qti-value>C T3</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-item-body>
    <qti-graphic-gap-match-interaction response-identifier="RESPONSE" data-choices-container-width="360" min-associations="3" max-associations="3">
      <qti-prompt>Drag each name to the correct circle.</qti-prompt>
      <object data="${image}" alt="Timeline graphic with three presidential eras marked." type="image/png"/>
      <qti-gap-text identifier="A" match-max="1">George Washington</qti-gap-text>
      <qti-gap-text identifier="B" match-max="1">Abraham Lincoln</qti-gap-text>
      <qti-gap-text identifier="C" match-max="1">Franklin D. Roosevelt</qti-gap-text>
      <qti-associable-hotspot identifier="T1" shape="circle" coords="120,130,22" match-max="1"/>
      <qti-associable-hotspot identifier="T2" shape="circle" coords="240,130,22" match-max="1"/>
      <qti-associable-hotspot identifier="T3" shape="circle" coords="360,130,22" match-max="1"/>
    </qti-graphic-gap-match-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const surface = page.locator("qti-assessment-item-player .qti3-graphic-gap-match-surface");
    const sourceRegion = page.locator("qti-assessment-item-player .qti3-graphic-gap-source-region");
    await expect(surface.locator("img")).toHaveAttribute("src", /^data:image\/svg\+xml;base64,/);
    await expect(surface.locator("img")).toHaveAccessibleName(
      "Timeline graphic with three presidential eras marked.",
    );
    const box = await surface.boundingBox();
    expect(box?.width).toBe(480);
    expect(box?.height).toBe(260);
    await expect(sourceRegion).toContainText("George Washington");
    await expect(sourceRegion).not.toContainText("T1");
    await expect(sourceRegion).not.toContainText("T2");
    await expect(sourceRegion).not.toContainText("T3");

    const source = sourceRegion.getByRole("button", { name: "Abraham Lincoln" });
    const target = surface.locator('[data-gap-identifier="T2"]');
    await expect(target).toHaveCSS("position", "absolute");
    await expect(target).toHaveAccessibleName("Target 2, empty");
    await expect(target).toHaveText("");
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    if (!box) throw new Error("Missing hotspot graphic gap surface box.");
    if (!sourceBox || !targetBox) throw new Error("Missing hotspot graphic gap drag boxes.");
    expect(Math.round(targetBox.x - box.x)).toBe(218);
    expect(Math.round(targetBox.y - box.y)).toBe(108);

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
    await page.mouse.up();

    await expectResponse(page, ["B T2"]);
    await expect(target).toHaveAccessibleName("Target 2, assigned Abraham Lincoln");
    await expect(target).toContainText("Abraham Lincoln");
  });

  test("reserves layout space for bottom-edge graphic gap labels", async ({ page }) => {
    await page.goto("/");
    const targetSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120" viewBox="0 0 240 120"><rect width="240" height="120" fill="#f4f2ea"/><circle cx="120" cy="108" r="10" fill="#2f4858"/></svg>`;
    const image = `data:image/svg+xml;base64,${Buffer.from(targetSvg).toString("base64")}`;
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bottom-label-graphic-gap-match" title="bottom-label-graphic-gap-match" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-graphic-gap-match-interaction response-identifier="RESPONSE">
      <object data="${image}" alt="Bottom target graphic." type="image/png"/>
      <qti-gap-text identifier="A" match-max="1">A very long era label near the bottom edge</qti-gap-text>
      <qti-associable-hotspot identifier="T1" shape="circle" coords="120,108,10" match-max="1"/>
    </qti-graphic-gap-match-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const surface = page.locator("qti-assessment-item-player .qti3-graphic-gap-match-surface");
    const sourceRegion = page.locator("qti-assessment-item-player .qti3-graphic-gap-source-region");
    const source = sourceRegion.getByRole("button", {
      name: "A very long era label near the bottom edge",
    });
    const target = surface.locator('[data-gap-identifier="T1"]');
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    if (!sourceBox || !targetBox) throw new Error("Missing bottom label drag boxes.");

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
    await page.mouse.up();

    const labelBox = await surface.locator(".qti3-graphic-gap-label").boundingBox();
    const regionBox = await sourceRegion.boundingBox();
    if (!labelBox || !regionBox) throw new Error("Missing bottom label layout boxes.");
    expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(regionBox.y);
  });

  test("captures pointer coordinate responses for point interactions", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "selectPoint");

    await clickAuthoredCoordinate(
      page.locator("qti-assessment-item-player .qti3-point-surface"),
      240,
      88,
    );
    await expectPointResponse(page, "240 88");
  });

  test("captures multiple select point responses when authored", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="select-point-multiple" title="select-point-multiple" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="point"/>
  <qti-item-body>
    <qti-select-point-interaction response-identifier="RESPONSE" max-choices="2">
      <qti-prompt>Mark two points on the diagram.</qti-prompt>
      <object data="hotspot-flow.svg" type="image/svg+xml" width="480" height="300"/>
    </qti-select-point-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const surface = page.locator("qti-assessment-item-player .qti3-point-surface");
    await clickAuthoredCoordinate(surface, 24, 52);
    await expectPointResponse(page, ["24 52"]);
    await clickAuthoredCoordinate(surface, 184, 52);
    await expectPointResponse(page, ["24 52", "184 52"]);
    await expect(page.locator("qti-assessment-item-player .qti3-point-marker")).toHaveCount(2);
  });

  test("renders object-backed coordinate surfaces for select point interactions", async ({
    page,
  }) => {
    await page.goto("/");
    await loadFixture(page, "selectPoint");

    const surface = page.locator("qti-assessment-item-player .qti3-point-surface");
    await expect(surface.locator("img")).toHaveAttribute("src", "hotspot-flow.svg");
    await expect(surface.locator("img")).toHaveAttribute("alt", "");
    await expectImageLoaded(surface.locator("img"));

    const box = await surface.boundingBox();
    expect(box?.width).toBe(480);
    expect(box?.height).toBe(300);

    await expect(page.locator("qti-assessment-item-player .qti3-coordinate-output")).toContainText(
      "No point selected",
    );
    await clickAuthoredCoordinate(surface, 240, 88);
    await expectPointResponse(page, "240 88");
  });

  test("renders position object as a draggable object on a stage", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "positionObject");

    const stage = page.locator("qti-assessment-item-player .qti3-position-object-stage");
    await expect(stage.locator("img").first()).toHaveAttribute("src", "hotspot-flow.svg");
    await expectImageLoaded(stage.locator("img").first());
    const marker = stage.getByRole("button", { name: "Movable object" });
    await expect(marker).toBeVisible();
    await expect(marker).toHaveAttribute("data-placed", "false");
    await expectResponse(page, undefined);
    await expect(page.locator("qti-assessment-item-player .qti3-coordinate-output")).toContainText(
      "Object not placed",
    );

    const box = await stage.boundingBox();
    expect(box?.width).toBe(480);
    expect(box?.height).toBe(300);
    const markerBox = await marker.boundingBox();
    if (!box || !markerBox) throw new Error("Missing position object boxes.");
    expect(markerBox.y).toBeGreaterThanOrEqual(box.y + box.height);

    await clickAuthoredCoordinate(stage, 240, 88);
    await expectPointResponse(page, "240 88");
    await expect(marker).toHaveAttribute("data-placed", "true");
    await expect(page.locator("qti-assessment-item-player .qti3-coordinate-output")).toContainText(
      /Object positioned at 240 8[78]/,
    );
  });

  test("captures drawing responses as file data URLs", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "drawing");

    const surface = page.locator("qti-assessment-item-player .qti3-drawing-surface");
    const box = await surface.boundingBox();
    if (!box) throw new Error("Missing drawing surface box.");
    expect(box.width).toBe(640);
    expect(box.height).toBe(360);
    await expect(surface).toHaveAttribute("viewBox", "0 0 640 360");

    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + 50, box.y + 30);
    await page.mouse.move(box.x + 90, box.y + 90);
    await page.mouse.up();

    await page.mouse.move(box.x + 20, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + 20);
    await page.mouse.up();

    const response = await expectStringResponse(page, /^data:image\/svg\+xml;charset=utf-8,/);
    const svg = decodeDataUrlText(response);
    expect(svg).toContain("<polyline");
    expect(svg).toContain("data-qti3-strokes");
    expect(svg).not.toMatch(/timestamp/i);
    await expect(surface.locator("polyline")).toHaveCount(2);
    await expect(page.locator("qti-assessment-item-player output")).toContainText(
      "2 drawing strokes.",
    );

    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    await page.locator("qti-assessment-item-player").evaluate((element, attemptState) => {
      element.reset();
      element.restore(attemptState);
    }, state);
    await expect(surface.locator("polyline")).toHaveCount(2);

    await page.getByRole("button", { name: "Clear drawing" }).click();
    await expectResponse(page, null);
    await expect(surface.locator("polyline")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Replay last stroke" })).toHaveCount(0);
  });

  test("honors authored drawing object dimensions", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="drawing-sized" title="drawing-sized" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="file"/>
  <qti-item-body>
    <qti-drawing-interaction response-identifier="RESPONSE">
      <qti-prompt>Annotate the diagram.</qti-prompt>
      <object data="hotspot-flow.svg" type="image/svg+xml" width="480" height="300"/>
    </qti-drawing-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const surface = page.locator("qti-assessment-item-player .qti3-drawing-surface");
    await expect(surface).toHaveAttribute("viewBox", "0 0 480 300");
    const box = await surface.boundingBox();
    expect(box?.width).toBe(480);
    expect(box?.height).toBe(300);
  });

  test("exports raster-backed drawing responses as the original image MIME", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="drawing-raster" title="drawing-raster" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="file"/>
  <qti-item-body>
    <qti-drawing-interaction response-identifier="RESPONSE">
      <qti-prompt>Annotate the image.</qti-prompt>
      <object data="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAwUBAWoFfSAAAAAASUVORK5CYII=" type="image/png" width="100" height="60"/>
    </qti-drawing-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const surface = page.locator("qti-assessment-item-player .qti3-drawing-surface");
    await surface.focus();
    await page.keyboard.press("Enter");

    const response = await expectStringResponse(page, /^data:image\/png;base64,/);
    expect(response).not.toMatch(/timestamp/i);

    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    await page.locator("qti-assessment-item-player").evaluate((element, attemptState) => {
      element.reset();
      element.restore(attemptState);
    }, state);
    await expect(surface.locator("image")).toHaveAttribute("href", /^data:image\/png;base64,/);
    await expect(surface.locator("polyline")).toHaveCount(0);
  });

  test("embeds packaged drawing backgrounds in serialized SVG responses", async ({ page }) => {
    const zip = createStoredZip({
      "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="drawing" type="imsqti_item_xmlv3p0" href="items/drawing.xml">
      <file href="items/drawing.xml"/>
      <file href="items/assets/canvas.svg"/>
    </resource>
  </resources>
</manifest>`,
      "items/drawing.xml": `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="packaged-drawing" title="packaged-drawing" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="file"/>
  <qti-item-body>
    <qti-drawing-interaction response-identifier="RESPONSE">
      <qti-prompt>Annotate the packaged image.</qti-prompt>
      <object data="assets/canvas.svg" type="image/svg+xml" width="120" height="80"/>
    </qti-drawing-interaction>
  </qti-item-body>
</qti-assessment-item>`,
      "items/assets/canvas.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><rect width="120" height="80" fill="white"/></svg>`,
    });

    await page.goto("/");
    await page.locator("#file").setInputFiles({
      name: "drawing-package.zip",
      mimeType: "application/zip",
      buffer: zip,
    });

    await expect(page.locator("#file-summary")).toContainText("items/drawing.xml");
    const surface = page.locator("qti-assessment-item-player .qti3-drawing-surface");
    await surface.focus();
    await page.keyboard.press("Enter");

    const response = await expectStringResponse(page, /^data:image\/svg\+xml;charset=utf-8,/);
    const svg = decodeDataUrlText(response);
    expect(svg).toContain("data:image/svg+xml");
    expect(svg).not.toContain("blob:");
    expect(svg).not.toContain("assets/canvas.svg");
  });

  test("renders object-backed hotspot choices as positioned buttons", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "hotspot");

    const surface = page.locator("qti-assessment-item-player .qti3-hotspot-surface");
    await expect(surface).toBeVisible();
    await expect(surface.locator("img")).toHaveAttribute("src", "hotspot-flow.svg");
    await expectImageLoaded(surface.locator("img"));
    const hotspot = surface.getByRole("button", { name: "A" });
    await expect(hotspot).toHaveCSS("position", "absolute");
    const box = await surface.boundingBox();
    expect(box?.width).toBeGreaterThan(300);
    expect(box?.height).toBeGreaterThan(180);
    await hotspot.click();
    await expectResponse(page, "A");
    await expect(hotspot).toHaveAttribute("aria-pressed", "true");
    await expect(hotspot).toHaveAttribute("data-selected", "true");
    await expect(page.locator("qti-assessment-item-player .qti3-selection-summary")).toContainText(
      "Selected A",
    );

    await page.locator("#debug-score").click();
    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(state.outcomes.SCORE).toBe(1);
  });

  test("supports keyboard hotspot selection", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "hotspot");

    await page
      .locator("qti-assessment-item-player .qti3-hotspot-surface")
      .getByRole("button", {
        name: "A",
      })
      .focus();
    await page.keyboard.press("Enter");
    await expectResponse(page, "A");
    await expect(
      page.locator("qti-assessment-item-player .qti3-hotspot-button[data-choice-identifier='A']"),
    ).toHaveAttribute("data-selected", "true");
  });

  test("honors hotspot shared CSS vocabulary while preserving keyboard access", async ({
    page,
  }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="hotspot-shared-css" title="hotspot-shared-css" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <qti-hotspot-interaction
            class="qti-selections-dark qti-unselected-hidden"
            response-identifier="RESPONSE">
            <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='100'%3E%3Crect width='200' height='100' fill='white'/%3E%3C/svg%3E" alt="Blank target" width="200" height="100"/>
            <qti-hotspot-choice identifier="A" shape="rect" coords="10,10,90,70">A</qti-hotspot-choice>
          </qti-hotspot-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `,
    );

    const interaction = page.locator(".qti3-hotspot");
    await expect(interaction).toHaveClass(/qti-selections-dark/);
    await expect(interaction).toHaveClass(/qti-unselected-hidden/);

    const button = page.locator("qti-assessment-item-player").getByRole("button", { name: "A" });
    await expect(button).toHaveCSS("opacity", "0");
    await button.focus();
    await expect(button).not.toHaveCSS("opacity", "0");
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expectResponse(page, "A");
  });

  test("associates validation messages with unanswered controls", async ({ page }) => {
    const fixture =
      interactionFixtures.find((item) => item.interactionType === "choice") ??
      interactionFixtures[0];
    if (!fixture) throw new Error("Missing choice fixture.");

    await page.goto("/");
    await pasteXml(page, fixture.xml);
    await page.locator("#debug-score").click();
    await expect(page.locator("#score-panel")).toHaveAttribute("data-status", "blocked");
    await expect(page.locator("#score-status")).toContainText("Score blocked");
    await expect(page.locator("#validation-count")).toHaveText("1");

    const radio = page.locator('qti-assessment-item-player [data-choice-identifier="A"] input');
    await expect(radio).toHaveAttribute("aria-invalid", "true");
    const describedBy = await radio.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`#${describedBy}`)).toContainText("RESPONSE requires a response.");
    await expect(page.locator("#events")).toContainText("response.required");

    await radio.check();
    await expect(radio).not.toHaveAttribute("aria-invalid", "true");
  });

  test("can bypass response validation when scoring or ending an attempt", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="validation-bypass" title="validation-bypass" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-outcome-declaration identifier="MAXSCORE" cardinality="single" base-type="float">
    <qti-default-value><qti-value>1</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" min-choices="1">
      <qti-simple-choice identifier="A">Correct</qti-simple-choice>
      <qti-simple-choice identifier="B">Incorrect</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`,
    );

    const blocked = await page.locator("qti-assessment-item-player").evaluate((element) => {
      const validationEvents: Array<{
        validationMessages: unknown[];
        state: { validationMessages: unknown[]; outcomes: Record<string, unknown> };
      }> = [];
      element.addEventListener("qti-validation", (event) => {
        validationEvents.push((event as CustomEvent).detail);
      });
      return {
        blocked: element.scoreAttempt() === undefined,
        validationDetail: validationEvents[0],
        state: element.serialize(),
      };
    });
    expect(blocked.blocked).toBe(true);
    expect(blocked.validationDetail.validationMessages).toEqual([
      expect.objectContaining({ code: "response.required", path: "RESPONSE" }),
    ]);
    expect(blocked.validationDetail.state.validationMessages).toEqual(
      blocked.validationDetail.validationMessages,
    );
    expect(blocked.state.validationMessages).toEqual(blocked.validationDetail.validationMessages);
    expect(blocked.validationDetail.state.outcomes.MAXSCORE).toBe(1);

    const scored = await page.locator("qti-assessment-item-player").evaluate((element) => {
      const scoreEvents: Array<{ state: { validationMessages: unknown[] } }> = [];
      element.addEventListener("qti-score", (event) => {
        scoreEvents.push((event as CustomEvent).detail);
      });
      return {
        result: element.scoreAttempt({ validateResponses: false }),
        scoreDetail: scoreEvents[0],
        state: element.serialize(),
      };
    });
    expect(scored.result.outcomes.SCORE).toBe(0);
    expect(scored.result.state.outcomes.MAXSCORE).toBe(1);
    expect(typeof scored.result.state.outcomes.MAXSCORE).toBe("number");
    expect(scored.result.state.validationMessages).toEqual([]);
    expect(scored.scoreDetail.state.validationMessages).toEqual([]);
    expect(scored.state.validationMessages).toEqual([]);

    const ended = await page.locator("qti-assessment-item-player").evaluate((element) => {
      const endAttemptEvents: Array<{ state: { status: string } }> = [];
      element.addEventListener("qti-endattempt", (event) => {
        endAttemptEvents.push((event as CustomEvent).detail);
      });
      element.reset();
      element.endAttempt({ validateResponses: false });
      return {
        endAttemptDetail: endAttemptEvents[0],
        state: element.serialize(),
      };
    });
    expect(ended.endAttemptDetail.state.status).toBe("completed");
    expect(ended.state.status).toBe("completed");
    expect(ended.state.outcomes.SCORE).toBe(0);
    expect(ended.state.outcomes.MAXSCORE).toBe(1);
  });

  test("honors authored minimum response counts during validation", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="minimum-choice" title="minimum-choice" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="identifier">
    <qti-correct-response>
      <qti-value>A</qti-value>
      <qti-value>B</qti-value>
    </qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" min-choices="2" max-choices="3">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
      <qti-simple-choice identifier="B">B</qti-simple-choice>
      <qti-simple-choice identifier="C">C</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`,
    );

    await page.getByRole("checkbox", { name: "A" }).check();
    await page.locator("#debug-score").click();
    await expect(page.locator("#events")).toContainText("requires at least 2 responses");
    await expect(page.getByRole("checkbox", { name: "A" })).toHaveAttribute("aria-invalid", "true");

    await page.getByRole("checkbox", { name: "B" }).check();
    await expect(page.getByRole("checkbox", { name: "A" })).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await page.locator("#debug-score").click();

    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(state.outcomes.SCORE).toBe(1);
    expect(state.validationMessages).toEqual([]);
  });

  test("honors authored maximum response counts during validation", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="maximum-choice" title="maximum-choice" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="identifier">
    <qti-correct-response>
      <qti-value>A</qti-value>
    </qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" min-choices="0" max-choices="1" data-max-selections-message="Select no more than one option.">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
      <qti-simple-choice identifier="B">B</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`,
    );

    await page.getByRole("checkbox", { name: "A" }).check();
    await page.getByRole("checkbox", { name: "B" }).check();
    await page.locator("#debug-score").click();

    await expect(page.locator("#score-panel")).toHaveAttribute("data-status", "blocked");
    await expect(page.locator("#events")).toContainText("response.maximum");
    await expect(page.locator("#events")).toContainText("Select no more than one option.");
    await expect(page.getByRole("checkbox", { name: "A" })).toHaveAttribute("aria-invalid", "true");
  });

  test("honors authored match-max counts during validation", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="match-max-associate" title="match-max-associate" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="pair">
    <qti-correct-response>
      <qti-value>A B</qti-value>
    </qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <qti-associate-interaction response-identifier="RESPONSE" min-associations="0" max-associations="0">
      <qti-simple-match-set>
        <qti-simple-associable-choice identifier="A" match-max="1">Alpha</qti-simple-associable-choice>
        <qti-simple-associable-choice identifier="B" match-max="0">Beta</qti-simple-associable-choice>
        <qti-simple-associable-choice identifier="C" match-max="1">Gamma</qti-simple-associable-choice>
      </qti-simple-match-set>
    </qti-associate-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    await page
      .locator(
        '.qti3-token-region[aria-label="Associate sources"] button[data-choice-identifier="A"]',
      )
      .click();
    await page
      .locator(
        '.qti3-token-region[aria-label="Associate targets"] button[data-choice-identifier="B"]',
      )
      .click();
    await page
      .locator(
        '.qti3-token-region[aria-label="Associate sources"] button[data-choice-identifier="A"]',
      )
      .click();
    await page
      .locator(
        '.qti3-token-region[aria-label="Associate targets"] button[data-choice-identifier="C"]',
      )
      .click();
    await page.locator("#debug-score").click();

    await expect(page.locator("#score-panel")).toHaveAttribute("data-status", "blocked");
    await expect(page.locator("#events")).toContainText("response.matchMax");
    await expect(page.locator("#events")).toContainText("Alpha may be used at most 1 time.");
  });

  test("allows optional responses when authored minimum is zero", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="optional-choice" title="optional-choice" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="identifier">
    <qti-correct-response>
      <qti-value>A</qti-value>
    </qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" min-choices="0" max-choices="1">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
      <qti-simple-choice identifier="B">B</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`,
    );
    await page.locator("#debug-score").click();

    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(state.outcomes.SCORE).toBe(0);
    expect(state.validationMessages).toEqual([]);
    await expect(page.locator("#events")).not.toContainText("response.required");
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

async function loadFixture(page: import("@playwright/test").Page, interactionType: string) {
  const fixture = interactionFixtures.find((item) => item.interactionType === interactionType);
  if (!fixture) throw new Error(`Missing ${interactionType} fixture.`);
  await page.locator("#fixture").selectOption(fixture.id);
  await page.locator("#load-fixture").click();
}

async function suspendRestoreCurrentAttempt(page: import("@playwright/test").Page): Promise<void> {
  const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
    element.suspend();
    return element.serialize();
  });
  await page.locator("qti-assessment-item-player").evaluate((element, attemptState) => {
    element.reset();
    element.restore(attemptState);
  }, state);
}

async function scoreCurrentAttempt(page: import("@playwright/test").Page): Promise<
  | {
      outcomes: Record<string, unknown>;
      state: { responses: Record<string, unknown> };
    }
  | undefined
> {
  return page.locator("qti-assessment-item-player").evaluate((element) => {
    return element.scoreAttempt({ validateResponses: false });
  });
}

async function pasteXml(page: import("@playwright/test").Page, xml: string): Promise<void> {
  const loader = page.locator("#xml-loader");
  if (!(await loader.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await loader.locator("summary").click();
  }
  await page.locator("#xml").fill(xml);
  await page.locator("#load-xml").click();
}

async function expectResponse(
  page: import("@playwright/test").Page,
  expected: unknown,
): Promise<void> {
  expect(await currentResponse(page)).toEqual(expected);
}

async function expectStringResponse(
  page: import("@playwright/test").Page,
  pattern: RegExp,
): Promise<string> {
  await expect
    .poll(async () => {
      const value = await currentResponse(page);
      return typeof value === "string" ? value : "";
    })
    .toMatch(pattern);
  const value = await currentResponse(page);
  if (typeof value !== "string") throw new Error("Expected string response.");
  return value;
}

async function currentResponse(page: import("@playwright/test").Page): Promise<unknown> {
  const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
    return element.serialize();
  });
  return state.responses.RESPONSE;
}

async function expectMoveButtons(
  buttons: Locator,
  expectedDirections: Array<"up" | "down" | "left" | "right">,
): Promise<void> {
  await expect(buttons).toHaveCount(expectedDirections.length);
  const actual = await buttons.evaluateAll((elements) =>
    elements.map((button) => {
      const icon = button.querySelector("svg.qti3-movement-icon");
      return {
        direction: (button as HTMLElement).dataset.moveDirection ?? "",
        focusable: icon?.getAttribute("focusable") ?? "",
        hidden: icon?.getAttribute("aria-hidden") ?? "",
        pathCount: icon?.querySelectorAll("path").length ?? 0,
        text: button.textContent?.trim() ?? "",
      };
    }),
  );
  expect(actual).toEqual(
    expectedDirections.map((direction) => ({
      direction,
      focusable: "false",
      hidden: "true",
      pathCount: 3,
      text: "",
    })),
  );
}

function decodeDataUrlText(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) return "";
  const metadata = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  return metadata.includes(";base64")
    ? Buffer.from(payload, "base64").toString("utf8")
    : decodeURIComponent(payload);
}

async function expectPointResponse(
  page: import("@playwright/test").Page,
  expected: string | string[],
  tolerance = 1,
): Promise<void> {
  const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
    return element.serialize();
  });
  const actual = state.responses.RESPONSE;
  const actualPoints = Array.isArray(actual) ? actual : [actual];
  const expectedPoints = Array.isArray(expected) ? expected : [expected];
  expect(actualPoints).toHaveLength(expectedPoints.length);
  for (const [index, expectedPoint] of expectedPoints.entries()) {
    expectPointNear(actualPoints[index], expectedPoint, tolerance);
  }
}

function expectPointNear(actual: unknown, expected: string, tolerance: number): void {
  const actualPoint = parsePointValue(actual);
  const expectedPoint = parsePointValue(expected);
  expect(Math.abs(actualPoint.x - expectedPoint.x)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actualPoint.y - expectedPoint.y)).toBeLessThanOrEqual(tolerance);
}

function parsePointValue(value: unknown): { x: number; y: number } {
  const [x, y] = String(value)
    .trim()
    .split(/\s+/)
    .map((coordinate) => Number(coordinate));
  expect(Number.isFinite(x)).toBe(true);
  expect(Number.isFinite(y)).toBe(true);
  return { x: x as number, y: y as number };
}

async function clickAuthoredCoordinate(
  locator: import("@playwright/test").Locator,
  x: number,
  y: number,
): Promise<void> {
  await locator.evaluate(
    (element, point) => {
      const rect = element.getBoundingClientRect();
      const image = element.querySelector("img");
      const authoredWidth = image?.naturalWidth || rect.width;
      const authoredHeight = image?.naturalHeight || rect.height;
      const clientX = Math.ceil(rect.left + ((point.x - 0.49) / authoredWidth) * rect.width);
      const clientY = Math.ceil(rect.top + ((point.y - 0.49) / authoredHeight) * rect.height);
      element.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          detail: 1,
          view: window,
        }),
      );
    },
    { x, y },
  );
}

async function expectImageLoaded(locator: import("@playwright/test").Locator): Promise<void> {
  await expect
    .poll(async () => {
      return locator.evaluate((image) => {
        const element = image as HTMLImageElement;
        return element.complete && element.naturalWidth > 0 && element.naturalHeight > 0;
      });
    })
    .toBe(true);
}

async function assignGap(
  page: import("@playwright/test").Page,
  interactionLabel: string,
  source: string,
  gapIdentifier: string,
): Promise<void> {
  const choices = page.locator(
    `qti-assessment-item-player [aria-label="${interactionLabel} choices"]`,
  );
  const sourceToken = choices.locator(`[data-choice-identifier="${source}"]`).first();
  if (await sourceToken.isVisible().catch(() => false)) {
    await sourceToken.click();
  } else {
    await choices.getByRole("button", { name: source }).click();
  }
  await page
    .locator(`qti-assessment-item-player [data-gap-identifier="${gapIdentifier}"]`)
    .getByRole("button")
    .first()
    .click();
}

async function assignMatch(
  page: import("@playwright/test").Page,
  sourceIdentifier: string,
  targetIdentifier: string,
): Promise<void> {
  await page
    .locator("qti-assessment-item-player .qti3-match-source-bank")
    .locator(`[data-choice-identifier="${sourceIdentifier}"]`)
    .click();
  await page
    .locator("qti-assessment-item-player .qti3-match-target-bank")
    .locator(`[data-choice-identifier="${targetIdentifier}"]`)
    .click();
}

async function clickToken(
  page: import("@playwright/test").Page,
  regionSuffix: "sources" | "targets",
  identifierOrName: string | undefined,
): Promise<void> {
  if (!identifierOrName) return;
  const region = page.locator(`qti-assessment-item-player [aria-label$="${regionSuffix}"]`);
  await clickTokenInRegion(region, identifierOrName);
}

async function clickTokenInRegion(
  region: import("@playwright/test").Locator,
  identifierOrName: string,
): Promise<void> {
  const byIdentifier = region.locator(`[data-choice-identifier="${identifierOrName}"]`).first();
  if (await byIdentifier.isVisible().catch(() => false)) {
    await byIdentifier.click();
    return;
  }
  await region.getByRole("button", { name: identifierOrName }).click();
}

async function provideResponse(
  page: import("@playwright/test").Page,
  interactionType: string,
  response: unknown,
  responseIdentifier = "RESPONSE",
): Promise<void> {
  if (interactionType === "inlineChoice") {
    await page
      .locator(
        `qti-assessment-item-player [data-response-identifier="${responseIdentifier}"] select`,
      )
      .selectOption(String(response));
    return;
  }

  if (interactionType === "slider") {
    await page.locator('input[type="range"]').evaluate((element, value) => {
      const input = element as HTMLInputElement;
      input.value = String(value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, response);
    return;
  }

  if (interactionType === "upload") {
    await page.locator('qti-assessment-item-player input[type="file"]').setInputFiles({
      name: String(response),
      mimeType: "text/plain",
      buffer: Buffer.from("qti3 upload fixture"),
    });
    return;
  }

  if (interactionType === "selectPoint") {
    const [x, y] = String(response)
      .split(" ")
      .map((coordinate) => Number(coordinate));
    await clickAuthoredCoordinate(
      page.locator("qti-assessment-item-player .qti3-point-surface"),
      x,
      y,
    );
    return;
  }

  if (interactionType === "positionObject") {
    const [x, y] = String(response)
      .split(" ")
      .map((coordinate) => Number(coordinate));
    await page
      .locator("qti-assessment-item-player .qti3-position-object-stage")
      .click({ position: { x, y } });
    return;
  }

  if (interactionType === "drawing") {
    await page.locator("qti-assessment-item-player .qti3-drawing-surface").focus();
    await page.keyboard.press("Enter");
    return;
  }

  if (interactionType === "portableCustom") {
    await page
      .locator("qti-assessment-item-player .qti3-portable-custom-host")
      .evaluate((element, value) => {
        element.dispatchEvent(
          new CustomEvent("qti3-portable-custom-response", {
            detail: { value },
            bubbles: true,
          }),
        );
      }, response);
    return;
  }

  if (interactionType === "media") {
    await page
      .locator("qti-assessment-item-player audio, qti-assessment-item-player video")
      .evaluate((element) => {
        element.dispatchEvent(new Event("play"));
      });
    return;
  }

  if (interactionType === "endAttempt") {
    await page
      .locator('qti-assessment-item-player [data-interaction-type="endAttempt"]')
      .getByRole("button")
      .click();
    return;
  }

  if (interactionType === "hotspot") {
    await page
      .locator("qti-assessment-item-player .qti3-hotspot-surface")
      .getByRole("button", { name: String(response) })
      .click();
    return;
  }

  if (interactionType === "hottext") {
    await page
      .locator(
        `qti-assessment-item-player .qti3-hottext-token[data-choice-identifier="${response}"]`,
      )
      .click();
    return;
  }

  if (
    Array.isArray(response) &&
    (interactionType === "gapMatch" || interactionType === "graphicGapMatch")
  ) {
    for (const pair of response) {
      const [source, target] = String(pair).split(" ");
      await assignGap(
        page,
        interactionType === "gapMatch" ? "Gap match" : "Graphic gap match",
        source,
        target,
      );
    }
    return;
  }

  if (Array.isArray(response) && interactionType === "match") {
    for (const pair of response) {
      const [source, target] = String(pair).split(" ");
      await assignMatch(page, source, target);
    }
    return;
  }

  if (Array.isArray(response) && interactionType === "graphicAssociate") {
    const surface = page.locator("qti-assessment-item-player .qti3-graphic-associate-surface");
    for (const pair of response) {
      const [source, target] = String(pair).split(" ");
      await surface.locator(`[data-choice-identifier="${source}"]`).click();
      await surface.locator(`[data-choice-identifier="${target}"]`).click();
    }
    return;
  }

  if (Array.isArray(response) && response.some((value) => String(value).includes(" "))) {
    for (const pair of response) {
      const [source, target] = String(pair).split(" ");
      await clickToken(page, "sources", source);
      await clickToken(page, "targets", target);
    }
    return;
  }

  if (Array.isArray(response) && interactionType === "graphicOrder") {
    const surface = page.locator("qti-assessment-item-player .qti3-graphic-order-surface");
    for (const identifier of response.map(String)) {
      await surface.locator(`[data-choice-identifier="${identifier}"]`).click();
    }
    return;
  }

  if (Array.isArray(response) && interactionType === "order") {
    const current = await page.locator("qti-assessment-item-player").evaluate(() => {
      return [...document.querySelectorAll(".qti3-reorder-item")].map(
        (item) => (item as HTMLElement).dataset.choiceIdentifier,
      );
    });
    let moved = false;
    for (const [targetIndex, value] of response.map(String).entries()) {
      let currentIndex = current.indexOf(value);
      while (currentIndex > targetIndex) {
        await page
          .locator(
            `qti-assessment-item-player .qti3-reorder-item[data-choice-identifier="${value}"] [data-move-direction="up"]`,
          )
          .click();
        moved = true;
        current.splice(currentIndex, 1);
        current.splice(currentIndex - 1, 0, value);
        currentIndex -= 1;
      }
      while (currentIndex < targetIndex) {
        await page
          .locator(
            `qti-assessment-item-player .qti3-reorder-item[data-choice-identifier="${value}"] [data-move-direction="down"]`,
          )
          .click();
        moved = true;
        current.splice(currentIndex, 1);
        current.splice(currentIndex + 1, 0, value);
        currentIndex += 1;
      }
    }
    if (!moved && current.length > 1) {
      const first = current[0];
      if (!first) return;
      const firstItem = page.locator(
        `qti-assessment-item-player .qti3-reorder-item[data-choice-identifier="${first}"]`,
      );
      await firstItem.locator('[data-move-direction="down"]').click();
      await firstItem.locator('[data-move-direction="up"]').click();
    }
    return;
  }

  const value = Array.isArray(response) ? String(response[0]) : String(response);
  const choiceInput = page
    .locator(`qti-assessment-item-player [data-choice-identifier="${value}"] input`)
    .first();
  if (await choiceInput.isVisible().catch(() => false)) {
    await choiceInput.check();
    return;
  }

  const checkbox = page.getByRole("checkbox", { name: value }).first();
  if (await checkbox.isVisible().catch(() => false)) {
    await checkbox.check();
    return;
  }

  const radio = page.getByRole("radio", { name: value }).first();
  if (await radio.isVisible().catch(() => false)) {
    await radio.check();
    return;
  }

  const select = page.locator("qti-assessment-item-player select").first();
  if (await select.isVisible().catch(() => false)) {
    await select.selectOption(value);
    return;
  }

  const textarea = page.locator("qti-assessment-item-player textarea").first();
  if (await textarea.isVisible().catch(() => false)) {
    await textarea.fill(value);
    return;
  }

  const input = page
    .locator('qti-assessment-item-player input:not([type="file"]):not([type="range"])')
    .first();
  if (await input.isVisible().catch(() => false)) {
    await input.fill(value);
    await input.dispatchEvent("change");
  }
}

function createStoredZip(files: Record<string, string | Buffer>): Buffer {
  return createZip(files, 0);
}

function createDeflatedZip(files: Record<string, string | Buffer>): Buffer {
  return createZip(files, 8);
}

function createZip(files: Record<string, string | Buffer>, method: 0 | 8): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = Buffer.from(name);
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const compressed = method === 8 ? deflateRawSync(data) : data;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBytes, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBytes);

    offset += local.length + nameBytes.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}
