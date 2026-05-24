import { expect, test } from "@playwright/test";
import { loadFixture, pasteXml, visibleValidationAlertCount } from "./player-helpers.js";

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

const UNSUPPORTED_INTERACTION_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="unsupported-interaction" title="unsupported-interaction" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-unsupported-interaction response-identifier="RESPONSE"/>
  </qti-item-body>
</qti-assessment-item>
`.trim();

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
