import { expect, test, type Locator } from "@playwright/test";
import { loadFixture, pasteXml, visibleValidationAlertCount } from "./player-helpers.js";

const CHOICE_ORIENTATION_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqtiasi_v3p0 https://purl.imsglobal.org/spec/qti/v3p0/schema/xsd/imsqti_asiv3p0_v1p0.xsd" identifier="q2-choice-interaction-single-sv-4b" title="Choice Interaction - Single (SV 4b)- orientation options" adaptive="false" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE1" cardinality="single" base-type="identifier"/>
  <qti-response-declaration identifier="RESPONSE2" cardinality="single" base-type="identifier"/>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <p>
      Choose an option in each orientation example.
    </p>
    <qti-choice-interaction class="qti-orientation-horizontal" max-choices="1" response-identifier="RESPONSE1">
      <qti-prompt>Demonstrates <em>qti-orientation-horizontal</em>.</qti-prompt>
      <qti-simple-choice identifier="ChoiceA">You must stay with your luggage at all times.</qti-simple-choice>
      <qti-simple-choice identifier="ChoiceB">Do not let someone else look after your luggage.</qti-simple-choice>
      <qti-simple-choice identifier="ChoiceC">Remember your luggage when you leave.</qti-simple-choice>
    </qti-choice-interaction>

    <qti-choice-interaction class="qti-orientation-vertical" max-choices="1" response-identifier="RESPONSE2">
      <qti-prompt>Demonstrates <em>qti-orientation-vertical</em>.</qti-prompt>
      <qti-simple-choice identifier="ChoiceA">You must stay with your luggage at all times.</qti-simple-choice>
      <qti-simple-choice identifier="ChoiceB">Do not let someone else look after your luggage.</qti-simple-choice>
      <qti-simple-choice identifier="ChoiceC">Remember your luggage when you leave.</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>
`.trim();

const CHOICE_STACKING_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="choice-stacking" title="choice-stacking" time-dependent="false">
  <qti-response-declaration identifier="HORIZONTAL" cardinality="single" base-type="identifier"/>
  <qti-response-declaration identifier="VERTICAL" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="HORIZONTAL" class="qti-choices-stacking-3 qti-orientation-horizontal" max-choices="1">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
      <qti-simple-choice identifier="B">B</qti-simple-choice>
      <qti-simple-choice identifier="C">C</qti-simple-choice>
      <qti-simple-choice identifier="D">D</qti-simple-choice>
      <qti-simple-choice identifier="E">E</qti-simple-choice>
    </qti-choice-interaction>
    <qti-choice-interaction response-identifier="VERTICAL" class="qti-choices-stacking-3 qti-orientation-vertical" max-choices="1">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
      <qti-simple-choice identifier="B">B</qti-simple-choice>
      <qti-simple-choice identifier="C">C</qti-simple-choice>
      <qti-simple-choice identifier="D">D</qti-simple-choice>
      <qti-simple-choice identifier="E">E</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>
`.trim();

const HORIZONTAL_CHOICE_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="choice-horizontal" title="choice-horizontal" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" class="qti-orientation-horizontal" max-choices="1">
      <qti-simple-choice identifier="A">First horizontal choice</qti-simple-choice>
      <qti-simple-choice identifier="B">Second horizontal choice</qti-simple-choice>
      <qti-simple-choice identifier="C">Third horizontal choice</qti-simple-choice>
      <qti-simple-choice identifier="D">Fourth horizontal choice</qti-simple-choice>
      <qti-simple-choice identifier="E">Fifth horizontal choice</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>
`.trim();

const EMPTY_CHOICE_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="empty-choice" title="empty-choice">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE">
      <qti-prompt>Select one.</qti-prompt>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>
`.trim();

const DEPRECATED_CHOICE_ORIENTATION_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="choice-orientation-attribute" title="choice-orientation-attribute" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" orientation="horizontal" max-choices="1">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
      <qti-simple-choice identifier="B">B</qti-simple-choice>
      <qti-simple-choice identifier="C">C</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>
`.trim();

const UNSUPPORTED_INTERACTION_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="unsupported-interaction" title="unsupported-interaction" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-unsupported-interaction response-identifier="RESPONSE"/>
  </qti-item-body>
</qti-assessment-item>
`.trim();

async function choiceOptionRects(
  interaction: Locator,
): Promise<Array<{ identifier: string; x: number; y: number; width: number; height: number }>> {
  return interaction.locator(".qti3-choice-option").evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        identifier: (element as HTMLElement).dataset.choiceIdentifier ?? "",
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    }),
  );
}

test.describe("player DOM behavior", () => {
  test("renders unsupported block interactions as alerts", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, UNSUPPORTED_INTERACTION_ITEM);

    const alert = page.locator("qti-assessment-item-player .qti3-unsupported-interaction");
    await expect(alert).toHaveAttribute("role", "alert");
    await expect(alert).toContainText("not supported");
    await expect(alert).toContainText("RESPONSE");
  });

  test("renders upload interactions as file inputs", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "upload");

    const input = page.locator("qti-assessment-item-player input.qti3-upload-input");
    await expect(input).toHaveAttribute("type", "file");
    await expect(input).toBeVisible();
  });

  test("renders end-attempt controls with authored labels", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "endAttempt");

    const button = page.locator("qti-assessment-item-player button.qti3-end-attempt-button");
    await expect(button).toBeVisible();
    await expect(button).toHaveText("Show hint");
  });

  test("embeds inline choice interactions inside paragraph flow", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "inlineChoice");

    const player = page.locator("qti-assessment-item-player");
    await expect(player.locator("p .qti3-inlineChoice").first()).toBeVisible();
    await expect(player.locator('[data-interaction-type="inlineChoice"]').first()).toBeVisible();
  });

  test("renders block choice interactions as top-level sections", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "choice");

    const player = page.locator("qti-assessment-item-player");
    await expect(player.locator('[data-interaction-type="choice"]').first()).toBeVisible();
    await expect(player.locator("p .qti3-inlineChoice")).toHaveCount(0);
  });

  test("renders shared vocabulary choice orientation classes", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, CHOICE_ORIENTATION_ITEM);

    const horizontal = page.locator(
      'qti-assessment-item-player .qti3-choice[data-response-identifier="RESPONSE1"]',
    );
    const vertical = page.locator(
      'qti-assessment-item-player .qti3-choice[data-response-identifier="RESPONSE2"]',
    );
    await expect(horizontal).toHaveClass(/qti-orientation-horizontal/);
    await expect(vertical).toHaveClass(/qti-orientation-vertical/);

    const horizontalRects = await choiceOptionRects(horizontal);
    expect(horizontalRects).toHaveLength(3);
    expect(Math.abs(horizontalRects[1].y - horizontalRects[0].y)).toBeLessThanOrEqual(2);
    expect(Math.abs(horizontalRects[2].y - horizontalRects[0].y)).toBeLessThanOrEqual(2);
    expect(horizontalRects[1].x).toBeGreaterThan(horizontalRects[0].x);
    expect(horizontalRects[2].x).toBeGreaterThan(horizontalRects[1].x);

    const verticalRects = await choiceOptionRects(vertical);
    expect(verticalRects).toHaveLength(3);
    expect(verticalRects[1].y).toBeGreaterThan(verticalRects[0].y + verticalRects[0].height - 1);
    expect(verticalRects[2].y).toBeGreaterThan(verticalRects[1].y + verticalRects[1].height - 1);

    await horizontal.locator('input[value="ChoiceA"]').check();
    await vertical.locator('input[value="ChoiceB"]').check();
    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(state.responses.RESPONSE1).toBe("ChoiceA");
    expect(state.responses.RESPONSE2).toBe("ChoiceB");
  });

  test("renders shared vocabulary choice stacking order", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, CHOICE_STACKING_ITEM);

    const horizontal = page.locator(
      'qti-assessment-item-player .qti3-choice[data-response-identifier="HORIZONTAL"]',
    );
    const horizontalRects = await choiceOptionRects(horizontal);
    expect(horizontalRects.map((rect) => rect.identifier)).toEqual(["A", "B", "C", "D", "E"]);
    expect(Math.abs(horizontalRects[1].y - horizontalRects[0].y)).toBeLessThanOrEqual(2);
    expect(Math.abs(horizontalRects[2].y - horizontalRects[0].y)).toBeLessThanOrEqual(2);
    expect(horizontalRects[1].x).toBeGreaterThan(horizontalRects[0].x);
    expect(horizontalRects[2].x).toBeGreaterThan(horizontalRects[1].x);
    expect(horizontalRects[3].y).toBeGreaterThan(
      horizontalRects[0].y + horizontalRects[0].height - 1,
    );
    expect(Math.abs(horizontalRects[3].x - horizontalRects[0].x)).toBeLessThanOrEqual(2);

    const vertical = page.locator(
      'qti-assessment-item-player .qti3-choice[data-response-identifier="VERTICAL"]',
    );
    const verticalRects = await choiceOptionRects(vertical);
    expect(verticalRects.map((rect) => rect.identifier)).toEqual(["A", "B", "C", "D", "E"]);
    expect(verticalRects[1].y).toBeGreaterThan(verticalRects[0].y + verticalRects[0].height - 1);
    expect(Math.abs(verticalRects[1].x - verticalRects[0].x)).toBeLessThanOrEqual(2);
    expect(verticalRects[2].x).toBeGreaterThan(verticalRects[0].x);
    expect(Math.abs(verticalRects[2].y - verticalRects[0].y)).toBeLessThanOrEqual(2);
    expect(verticalRects[3].y).toBeGreaterThan(verticalRects[2].y + verticalRects[2].height - 1);
    expect(Math.abs(verticalRects[3].x - verticalRects[2].x)).toBeLessThanOrEqual(2);
  });

  test("keeps stacked choice layouts inside narrow viewports", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/");
    await pasteXml(page, CHOICE_STACKING_ITEM);

    const listsFit = await page
      .locator("qti-assessment-item-player .qti3-choice-list")
      .evaluateAll((lists) => lists.every((list) => list.scrollWidth <= list.clientWidth + 1));
    expect(listsFit).toBe(true);
  });

  test("keeps pure horizontal choice layouts inside narrow viewports", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/");
    await pasteXml(page, HORIZONTAL_CHOICE_ITEM);

    const interaction = page.locator(
      'qti-assessment-item-player .qti3-choice[data-response-identifier="RESPONSE"]',
    );
    const rects = await choiceOptionRects(interaction);
    const listBox = await interaction.locator(".qti3-choice-list").boundingBox();
    if (!listBox) throw new Error("Missing choice list box.");
    expect(rects).toHaveLength(5);
    for (const [index, rect] of rects.entries()) {
      expect(rect.width, `choice ${index + 1}`).toBeGreaterThanOrEqual(listBox.width - 1);
      if (index > 0) {
        expect(rect.y).toBeGreaterThan(rects[index - 1]!.y + rects[index - 1]!.height - 1);
        expect(Math.abs(rect.x - rects[0]!.x)).toBeLessThanOrEqual(2);
      }
    }

    const listFits = await interaction
      .locator(".qti3-choice-list")
      .evaluate((list) => list.scrollWidth <= list.clientWidth + 1);
    expect(listFits).toBe(true);
  });

  test("tolerates deprecated choice orientation attributes without adding authored classes", async ({
    page,
  }) => {
    await page.goto("/");
    await pasteXml(page, DEPRECATED_CHOICE_ORIENTATION_ITEM);

    const interaction = page.locator(
      'qti-assessment-item-player .qti3-choice[data-response-identifier="RESPONSE"]',
    );
    await expect(interaction).not.toHaveClass(/qti-orientation-horizontal/);
    const rects = await choiceOptionRects(interaction);
    expect(rects).toHaveLength(3);
    expect(Math.abs(rects[1].y - rects[0].y)).toBeLessThanOrEqual(2);
    expect(Math.abs(rects[2].y - rects[0].y)).toBeLessThanOrEqual(2);
    expect(rects[1].x).toBeGreaterThan(rects[0].x);
    expect(rects[2].x).toBeGreaterThan(rects[1].x);
  });

  test("embeds text entry interactions inside paragraph flow", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "textEntry");

    const player = page.locator("qti-assessment-item-player");
    await expect(player.locator("p input, p textarea").first()).toBeVisible();
    await expect(player.locator('[data-interaction-type="textEntry"]').first()).toBeVisible();
  });

  test("shows one authoring validation alert for empty choice items", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, EMPTY_CHOICE_ITEM);

    expect(await visibleValidationAlertCount(page)).toBe(1);
    await expect(
      page.locator('qti-assessment-item-player [data-validation-for="RESPONSE"]'),
    ).toContainText("No choices are defined");

    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(
      state.validationMessages.filter((message) => message.code === "interaction.choices.missing"),
    ).toHaveLength(1);
  });

  test("does not duplicate authoring validation alerts after restore", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, EMPTY_CHOICE_ITEM);

    expect(await visibleValidationAlertCount(page)).toBe(1);

    const saved = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    if (!saved) throw new Error("Expected serialized player state.");
    expect(
      saved.validationMessages.filter((message) => message.code === "interaction.choices.missing"),
    ).toHaveLength(1);

    await page.locator("qti-assessment-item-player").evaluate((element, attemptState) => {
      element.restore(attemptState);
    }, saved);

    expect(await visibleValidationAlertCount(page)).toBe(1);
    expect(
      (
        await page.locator("qti-assessment-item-player").evaluate((element) => {
          return element.serialize();
        })
      ).validationMessages.filter((message) => message.code === "interaction.choices.missing"),
    ).toHaveLength(1);
  });

  test("does not duplicate authoring validation alerts when loading serialized state", async ({
    page,
  }) => {
    await page.goto("/");
    await pasteXml(page, EMPTY_CHOICE_ITEM);

    const saved = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    if (!saved) throw new Error("Expected serialized player state.");

    await page.locator("qti-assessment-item-player").evaluate(
      async (element, payload) => {
        await element.loadXml(payload.xml, { state: payload.attemptState });
      },
      { attemptState: saved, xml: EMPTY_CHOICE_ITEM },
    );

    expect(await visibleValidationAlertCount(page)).toBe(1);
    await expect(
      page.locator('qti-assessment-item-player [data-validation-for="RESPONSE"]'),
    ).toContainText("No choices are defined");
  });

  test("forwards portable custom validity events into validation state", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "portableCustom");

    const host = page.locator("qti-assessment-item-player .qti3-portable-custom-host");
    await expect(host).toBeVisible();

    await host.evaluate((element) => {
      element.dispatchEvent(
        new CustomEvent("qti3-portable-custom-validity", {
          detail: { valid: false, message: "Invalid" },
          bubbles: true,
        }),
      );
    });

    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(state.validationMessages).toEqual([
      expect.objectContaining({
        code: "response.portableCustom.validity",
        message: "Invalid",
        path: "RESPONSE",
      }),
    ]);
  });

  test("forwards portable custom state events into interaction state", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "portableCustom");

    const host = page.locator("qti-assessment-item-player .qti3-portable-custom-host");
    await expect(host).toBeVisible();

    await host.evaluate((element) => {
      element.dispatchEvent(
        new CustomEvent("qti3-portable-custom-state", {
          detail: { state: { ok: true, step: 2 } },
          bubbles: true,
        }),
      );
    });

    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(state.interactionStates.RESPONSE).toEqual({ ok: true, step: 2 });
    await expect(host).toHaveAttribute("data-state", JSON.stringify({ ok: true, step: 2 }));
  });
});
