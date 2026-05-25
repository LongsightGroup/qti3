import { expect, test } from "@playwright/test";
import { interactionFixtures } from "../../packages/fixtures/src/index.js";
import {
  expectMoveButtons,
  expectResponse,
  expectStringResponse,
  loadFixture,
  operableControlSelector,
} from "./player-helpers.js";

test.describe("player keyboard and accessibility", () => {
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
    for (let index = 0; index < 14; index += 1) {
      await page.keyboard.press("ArrowRight");
    }
    await expectResponse(page, 2024);
    await expect(page.locator("qti-assessment-item-player output")).toHaveText("2024");

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

  test("reorders order interactions with keyboard controls", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "order");

    await expect(page.getByRole("button", { name: "Use current order" })).toHaveCount(0);
    await page
      .locator('qti-assessment-item-player .qti3-reorder-handle[data-choice-identifier="B"]')
      .focus();
    await page.keyboard.press("ArrowUp");
    await expectResponse(page, ["B", "A", "C"]);
    const moveSummary = page.locator("qti-assessment-item-player .qti3-selection-summary");
    await expect(moveSummary).toBeHidden();
    await expect(moveSummary).toHaveText(/moved up\.$/);
    await expect(
      page.locator('qti-assessment-item-player .qti3-reorder-handle[data-choice-identifier="B"]'),
    ).toBeFocused();

    await page.keyboard.press("ArrowDown");
    await expectResponse(page, ["A", "B", "C"]);
    await expect(
      page.locator('qti-assessment-item-player .qti3-reorder-handle[data-choice-identifier="B"]'),
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

  test("selects graphic order hotspots with keyboard only", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "graphicOrder");

    await page
      .locator('qti-assessment-item-player .qti3-graphic-order-hotspot[data-choice-identifier="B"]')
      .focus();
    await page.keyboard.press("Enter");
    await expectResponse(page, ["B"]);

    await page
      .locator('qti-assessment-item-player .qti3-graphic-order-hotspot[data-choice-identifier="A"]')
      .focus();
    await page.keyboard.press("Space");
    await expectResponse(page, ["B", "A"]);

    await page
      .locator('qti-assessment-item-player .qti3-graphic-order-hotspot[data-choice-identifier="C"]')
      .focus();
    await page.keyboard.press("Enter");
    await expectResponse(page, ["B", "A", "C"]);
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
});
