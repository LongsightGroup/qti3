import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { expect, test } from "@playwright/test";
import { interactionFixtures } from "../../packages/fixtures/src/index.js";

const require = createRequire(import.meta.url);

test.describe("manual harness", () => {
  test("loads every reference interaction fixture without axe violations", async ({ page }) => {
    await page.goto("/");
    const axeSource = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");

    for (const fixture of interactionFixtures) {
      await page.locator("#fixture").selectOption(fixture.id);
      await page.locator("#load-fixture").click();
      await expect(page.locator("qti-assessment-item-player")).toContainText(fixture.id);
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

  test("accepts pasted QTI XML and emits score state", async ({ page }) => {
    const fixture =
      interactionFixtures.find((item) => item.interactionType === "choice") ??
      interactionFixtures[0];
    if (!fixture) throw new Error("Missing choice fixture.");

    await page.goto("/");
    await page.locator("#xml").fill(fixture.xml);
    await page.locator("#load-xml").click();
    await page.locator('qti-assessment-item-player [data-choice-identifier="A"] input').check();
    await page.getByRole("button", { name: "Score", exact: true }).click();
    await expect(page.locator("#events")).toContainText("qti3.attempt-state.v1");
    await expect(page.locator("#score-panel")).toHaveAttribute("data-status", "scored");
    await expect(page.locator("#score-status")).toHaveText("Scored successfully.");
    await expect(page.locator("#score-value")).toHaveText("1");
    await expect(page.locator("#score-details")).toContainText('"SCORE": 1');
  });

  test("renders item-body prompts before interactions", async ({ page }) => {
    const fixture =
      interactionFixtures.find((item) => item.interactionType === "choice") ??
      interactionFixtures[0];
    if (!fixture) throw new Error("Missing choice fixture.");
    const xml = fixture.xml.replace(
      "<p>Reference item for choice-reference: a QTI 3.0 item-player conformance example using realistic assessment wording.</p>",
      "<qti-prompt>Which president resigned after Watergate?</qti-prompt>",
    );

    await page.goto("/");
    await page.locator("#xml").fill(xml);
    await page.locator("#load-xml").click();

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
    await expect(player.locator(".qti3-inlineChoice").first()).toContainText(
      "interaction writes a candidate answer",
    );
    await expect(
      player.locator('[data-response-identifier="RESPONSE_DECLARATION"] select'),
    ).toBeVisible();
    await expect(
      player.locator('[data-response-identifier="RESPONSE_OUTCOME"] select'),
    ).toBeVisible();
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
    await page.locator("#xml").fill(xml);
    await page.locator("#load-xml").click();
    await page.getByRole("radio", { name: "A" }).check();
    await page.getByRole("button", { name: "Score", exact: true }).click();

    const feedback = page.locator("qti-assessment-item-player .qti3-feedback");
    await expect(feedback).toBeVisible();
    await expect(feedback).toContainText("Correct feedback.");
    await expect(feedback).not.toContainText("Incorrect feedback.");
    await expect(feedback).toHaveAttribute("aria-live", "polite");
  });

  test("renders object-backed media interactions with native controls", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "media");

    const audio = page.locator("qti-assessment-item-player audio");
    await expect(audio).toBeVisible();
    await expect(audio).toHaveAttribute("controls", "");
    await expect(audio).toHaveAttribute("preload", "none");
    await expect(audio).toHaveAttribute("src", /media\.mp3$/);
  });

  test("renders graphic interactions with their object context", async ({ page }) => {
    await page.goto("/");

    for (const interactionType of ["graphicOrder", "graphicAssociate", "graphicGapMatch"]) {
      await loadFixture(page, interactionType);
      const context = page.locator("qti-assessment-item-player .qti3-graphic-context");
      await expect(context, interactionType).toBeVisible();
      await expect(context.locator("img"), interactionType).toHaveAttribute("src", /image\.png$/);
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
    await page.locator("#xml").fill(xml);
    await page.locator("#load-xml").click();

    await assignGap(page, "Gap match", "A", "G1");
    await assignGap(page, "Gap match", "B", "G2");

    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(state.responses.RESPONSE).toEqual(["A G1", "B G2"]);

    await page.getByRole("button", { name: "Score", exact: true }).click();
    const scored = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(scored.outcomes.SCORE).toBe(1);
  });

  test("exposes a portable custom host contract and accepts response events", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "portableCustom");

    const host = page.locator("qti-assessment-item-player .qti3-portable-custom-host");
    await expect(host).toBeVisible();
    await expect(host).toHaveAttribute("data-type-identifier", "urn:qti3:fixture:portable-custom");
    await expect(host).toHaveAttribute("data-module", "fixture-portable-custom");

    await host.evaluate((element) => {
      element.dispatchEvent(
        new CustomEvent("qti3-portable-custom-response", {
          detail: { value: "A" },
          bubbles: true,
        }),
      );
    });
    await expectResponse(page, "A");

    await page.getByRole("button", { name: "Score", exact: true }).click();
    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(state.outcomes.SCORE).toBe(1);
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

    await page.getByRole("button", { name: "Score", exact: true }).click();
    const scoredState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(scoredState.validationMessages).toEqual([]);
    await expect(page.locator("#events")).not.toContainText("response.required");
  });

  test("loads and navigates multiple local XML files", async ({ page }) => {
    const choice = interactionFixtures.find((item) => item.interactionType === "choice");
    const textEntry = interactionFixtures.find((item) => item.interactionType === "textEntry");
    if (!choice || !textEntry) throw new Error("Missing local-file fixtures.");

    await page.goto("/");
    await page.locator("#file").setInputFiles([
      {
        name: "choice-reference.xml",
        mimeType: "application/xml",
        buffer: Buffer.from(choice.xml),
      },
      {
        name: "textEntry-reference.xml",
        mimeType: "application/xml",
        buffer: Buffer.from(textEntry.xml),
      },
    ]);

    await expect(page.locator("#file-summary")).toContainText("1 of 2");
    await expect(page.locator("qti-assessment-item-player")).toContainText("choice-reference");
    await page.locator("#next-file").click();
    await expect(page.locator("#file-summary")).toContainText("2 of 2");
    await expect(page.locator("qti-assessment-item-player")).toContainText("textEntry-reference");
    await page.locator("#previous-file").click();
    await expect(page.locator("#file-summary")).toContainText("1 of 2");
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

      await page.getByRole("button", { name: "Score", exact: true }).click();
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
    await page.locator("#xml").fill(fixture.xml);
    await page.locator("#load-xml").click();
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
    await expect(page.locator("qti-assessment-item-player .qti3-counter")).toContainText(
      "1 of 10 characters",
    );

    await loadFixture(page, "slider");
    await page.locator('qti-assessment-item-player input[type="range"]').focus();
    for (let index = 0; index < 50; index += 1) {
      await page.keyboard.press("ArrowRight");
    }
    await expectResponse(page, "50");
    await expect(page.locator("qti-assessment-item-player output")).toHaveText("50");

    await loadFixture(page, "positionObject");
    await page.locator("qti-assessment-item-player .qti3-point-surface").focus();
    await page.keyboard.press("Enter");
    await expectResponse(page, "10 10");
    await page.getByRole("button", { name: "Move point right" }).click();
    await expectResponse(page, "11 10");
    await expect(page.locator("qti-assessment-item-player .qti3-coordinate-output")).toContainText(
      "Selected point 11, 10",
    );

    await loadFixture(page, "drawing");
    await page.locator("qti-assessment-item-player .qti3-drawing-surface").focus();
    await page.keyboard.press("Enter");
    await expectResponse(page, "10 10 90 90");

    await loadFixture(page, "portableCustom");
    await page.locator("qti-assessment-item-player .qti3-portable-custom-host + input").focus();
    await page.keyboard.type("A");
    await expectResponse(page, "A");
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

    await page
      .locator(
        'qti-assessment-item-player .qti3-reorder-item[data-choice-identifier="B"] button[aria-label$=" down"]',
      )
      .click();
    await expectResponse(page, ["A", "B", "C"]);
  });

  test("reorders graphic order interactions with pointer drag", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "graphicOrder");

    await expect(page.locator("qti-assessment-item-player legend")).toContainText([
      "Graphic order",
    ]);
    await expect(page.locator("qti-assessment-item-player")).not.toContainText(
      "Graphic order order",
    );
    await expect(
      page.locator("qti-assessment-item-player .qti3-graphic-context img"),
    ).toHaveAttribute("src", /image\.png$/);
    await expectImageLoaded(page.locator("qti-assessment-item-player .qti3-graphic-context img"));

    const items = page.locator("qti-assessment-item-player .qti3-reorder-item");
    const first = await items.nth(0).boundingBox();
    const second = await items.nth(1).boundingBox();
    if (!first || !second) throw new Error("Missing reorder item boxes.");

    await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
    await page.mouse.down();
    await page.mouse.move(second.x + second.width / 2, second.y + second.height / 2);
    await page.mouse.up();
    await expectResponse(page, ["B", "A", "C"]);
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
    ).toBeDisabled();
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

  test("creates match pairs and preserves graphic association context", async ({ page }) => {
    await page.goto("/");

    await loadFixture(page, "match");
    await addPair(page, "Match", "A", "G1");
    await expectResponse(page, ["A G1"]);

    await loadFixture(page, "graphicAssociate");
    await expect(
      page.locator("qti-assessment-item-player .qti3-graphic-context img"),
    ).toHaveAttribute("src", /image\.png$/);
    await expectImageLoaded(page.locator("qti-assessment-item-player .qti3-graphic-context img"));
    await addPair(page, "Graphic associate", "A", "B");
    await expectResponse(page, ["A B"]);
  });

  test("assigns graphic gap match choices with pointer drag and removal", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "graphicGapMatch");

    await expect(
      page.locator("qti-assessment-item-player .qti3-graphic-context img"),
    ).toHaveAttribute("src", /image\.png$/);
    await expectImageLoaded(page.locator("qti-assessment-item-player .qti3-graphic-context img"));

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

    await page.getByRole("button", { name: "Remove G1 assignment" }).click();
    await expectResponse(page, []);
  });

  test("captures pointer coordinate responses for point interactions", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "selectPoint");

    await page
      .locator("qti-assessment-item-player .qti3-point-surface")
      .click({ position: { x: 10, y: 10 } });
    await expectResponse(page, "10 10");

    await page.getByRole("button", { name: "Score", exact: true }).click();
    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(state.outcomes.SCORE).toBe(1);
  });

  test("renders object-backed coordinate surfaces for point interactions", async ({ page }) => {
    await page.goto("/");

    for (const fixture of ["selectPoint", "positionObject"]) {
      await loadFixture(page, fixture);

      const surface = page.locator("qti-assessment-item-player .qti3-point-surface");
      await expect(surface.locator("img")).toHaveAttribute("src", "image.png");
      await expect(surface.locator("img")).toHaveAttribute("alt", "");
      await expectImageLoaded(surface.locator("img"));

      const box = await surface.boundingBox();
      expect(box?.width).toBe(160);
      expect(box?.height).toBe(120);

      await surface.click({ position: { x: 10, y: 10 } });
      await expectResponse(page, "10 10");
    }
  });

  test("captures drawing responses as deterministic stroke data", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "drawing");

    const surface = page.locator("qti-assessment-item-player .qti3-drawing-surface");
    const box = await surface.boundingBox();
    if (!box) throw new Error("Missing drawing surface box.");

    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + 50, box.y + 30);
    await page.mouse.move(box.x + 90, box.y + 90);
    await page.mouse.up();

    await page.mouse.move(box.x + 20, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + 20);
    await page.mouse.up();

    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(state.responses.RESPONSE).toMatch(/\d+ \d+ \d+ \d+ \d+ \d+ \| \d+ \d+ \d+ \d+/);
    await expect(surface.locator("polyline")).toHaveCount(2);
    await expect(page.locator("qti-assessment-item-player output")).toContainText(
      "2 drawing strokes.",
    );

    await page.getByRole("button", { name: "Clear drawing" }).click();
    await expectResponse(page, "");
    await expect(surface.locator("polyline")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Replay last stroke" })).toHaveCount(0);
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

    await page.getByRole("button", { name: "Score", exact: true }).click();
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

  test("associates validation messages with unanswered controls", async ({ page }) => {
    const fixture =
      interactionFixtures.find((item) => item.interactionType === "choice") ??
      interactionFixtures[0];
    if (!fixture) throw new Error("Missing choice fixture.");

    await page.goto("/");
    await page.locator("#xml").fill(fixture.xml);
    await page.locator("#load-xml").click();
    await page.getByRole("button", { name: "Score", exact: true }).click();
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

  test("honors authored minimum response counts during validation", async ({ page }) => {
    await page.goto("/");
    await page.locator("#xml").fill(`<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="minimum-choice" title="minimum-choice">
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
</qti-assessment-item>`);
    await page.locator("#load-xml").click();

    await page.getByRole("checkbox", { name: "A" }).check();
    await page.getByRole("button", { name: "Score", exact: true }).click();
    await expect(page.locator("#events")).toContainText("requires at least 2 responses");
    await expect(page.getByRole("checkbox", { name: "A" })).toHaveAttribute("aria-invalid", "true");

    await page.getByRole("checkbox", { name: "B" }).check();
    await expect(page.getByRole("checkbox", { name: "A" })).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await page.getByRole("button", { name: "Score", exact: true }).click();

    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(state.outcomes.SCORE).toBe(1);
    expect(state.validationMessages).toEqual([]);
  });

  test("allows optional responses when authored minimum is zero", async ({ page }) => {
    await page.goto("/");
    await page.locator("#xml").fill(`<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="optional-choice" title="optional-choice">
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
</qti-assessment-item>`);
    await page.locator("#load-xml").click();
    await page.getByRole("button", { name: "Score", exact: true }).click();

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

    await expect(page.locator("qti-assessment-item-player")).toContainText("choice-reference");
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
      await expect(page.locator("qti-assessment-item-player")).toContainText(fixture.id);

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

async function expectResponse(
  page: import("@playwright/test").Page,
  expected: unknown,
): Promise<void> {
  const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
    return element.serialize();
  });
  expect(state.responses.RESPONSE).toEqual(expected);
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

async function addPair(
  page: import("@playwright/test").Page,
  interactionLabel: string,
  source: string,
  target: string,
): Promise<void> {
  const sourceRegion = page.locator(
    `qti-assessment-item-player [aria-label="${interactionLabel} sources"]`,
  );
  const targetRegion = page.locator(
    `qti-assessment-item-player [aria-label="${interactionLabel} targets"]`,
  );
  await clickTokenInRegion(sourceRegion, source);
  await clickTokenInRegion(targetRegion, target);
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

  if (interactionType === "selectPoint" || interactionType === "positionObject") {
    const [x, y] = String(response)
      .split(" ")
      .map((coordinate) => Number(coordinate));
    await page
      .locator("qti-assessment-item-player .qti3-point-surface")
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

  if (interactionType === "hotspot") {
    await page
      .locator("qti-assessment-item-player .qti3-hotspot-surface")
      .getByRole("button", { name: String(response) })
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

  if (Array.isArray(response) && response.some((value) => String(value).includes(" "))) {
    for (const pair of response) {
      const [source, target] = String(pair).split(" ");
      await clickToken(page, "sources", source);
      await clickToken(page, "targets", target);
    }
    return;
  }

  if (
    Array.isArray(response) &&
    (interactionType === "order" || interactionType === "graphicOrder")
  ) {
    const current = await page.locator("qti-assessment-item-player").evaluate(() => {
      return [...document.querySelectorAll(".qti3-reorder-item")].map(
        (item) => (item as HTMLElement).dataset.choiceIdentifier,
      );
    });
    let moved = false;
    for (const [targetIndex, value] of response.map(String).entries()) {
      let currentIndex = current.indexOf(value);
      while (currentIndex > targetIndex) {
        await page.getByRole("button", { name: `Move ${value} up` }).click();
        moved = true;
        current.splice(currentIndex, 1);
        current.splice(currentIndex - 1, 0, value);
        currentIndex -= 1;
      }
      while (currentIndex < targetIndex) {
        await page.getByRole("button", { name: `Move ${value} down` }).click();
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
      await firstItem.locator('button[aria-label$=" down"]').click();
      await firstItem.locator('button[aria-label$=" up"]').click();
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
