import { expect, test, type Locator } from "@playwright/test";
import {
  GAP_CHOICES_CONTAINER_WIDTH_ITEM,
  GAP_PLACEMENT_WIDTH_ITEM,
} from "./fixtures/dom-behavior-items.js";
import { assignGap, currentResponse, loadFixture, pasteXml } from "./player-helpers.js";

async function expectHorizontalOverflow(locator: Locator, shouldOverflow: boolean): Promise<void> {
  await expect
    .poll(() => locator.evaluate((element) => element.scrollWidth > element.clientWidth))
    .toBe(shouldOverflow);
}

async function expectGapButtonMatchesPlayerForeground(
  player: Locator,
  gapIdentifier: string,
): Promise<void> {
  const colors = await player.evaluate((element, id) => {
    const button = element.querySelector(`[data-gap-identifier="${id}"] button`);
    if (!button) return null;
    return {
      buttonColor: getComputedStyle(button).color,
      playerColor: getComputedStyle(element).color,
    };
  }, gapIdentifier);
  expect(colors).not.toBeNull();
  expect(colors?.buttonColor).toBe(colors?.playerColor);
}

async function expectPlainGapButtonMatchesPlayerSurface(
  player: Locator,
  gapIdentifier: string,
): Promise<void> {
  const colors = await player.evaluate((element, id) => {
    const button = element.querySelector(`[data-gap-identifier="${id}"] button`);
    if (!button) return null;
    return {
      buttonBackground: getComputedStyle(button).backgroundColor,
      playerBackground: getComputedStyle(element).backgroundColor,
    };
  }, gapIdentifier);
  expect(colors).not.toBeNull();
  expect(colors?.buttonBackground).toBe(colors?.playerBackground);
}

test.describe("player gap match interactions", () => {
  test("keeps gap placement interaction usable with authored input widths", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, GAP_PLACEMENT_WIDTH_ITEM);

    const player = page.locator("qti-assessment-item-player");
    const wideGap = player.locator('[data-gap-identifier="G2"]');

    await assignGap(page, "Gap match", "A", "G2");
    await expect(currentResponse(page)).resolves.toEqual(["A G2"]);
    await wideGap.locator("button").focus();
    await page.keyboard.press("Delete");
    await expect(currentResponse(page)).resolves.toEqual([]);

    await page.setViewportSize({ width: 360, height: 640 });
    const gapRegion = player.locator(".qti3-gap-region");
    await expect(gapRegion).toHaveCSS("overflow-x", "auto");
    await expectHorizontalOverflow(gapRegion, true);
    await expectHorizontalOverflow(player, false);
  });

  test("keeps assigned gap text visible in dark color scheme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await pasteXml(page, GAP_PLACEMENT_WIDTH_ITEM);

    const player = page.locator("qti-assessment-item-player");
    const assignedGapButton = player.locator('[data-gap-identifier="G2"] button');

    await assignGap(page, "Gap match", "A", "G2");
    await expect(assignedGapButton).toHaveText("alpha");
    await expectGapButtonMatchesPlayerForeground(player, "G2");
    const playerColor = await player.evaluate((element) => getComputedStyle(element).color);
    expect(playerColor).not.toBe("rgb(0, 0, 0)");
  });

  test("keeps plain reference gap assignments visible in dark color scheme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await loadFixture(page, "gapMatch");

    const player = page.locator("qti-assessment-item-player");
    const assignedGapButton = player.locator('[data-gap-identifier="G1"] button');

    await assignGap(page, "Gap match", "B", "G1");
    await expect(assignedGapButton).toHaveText("outcome declaration");
    await expect(assignedGapButton).toHaveAccessibleName("Gap 1, assigned outcome declaration");
    await expectGapButtonMatchesPlayerForeground(player, "G1");
    await expectPlainGapButtonMatchesPlayerSurface(player, "G1");
    const playerColor = await player.evaluate((element) => getComputedStyle(element).color);
    expect(playerColor).not.toBe("rgb(0, 0, 0)");
  });

  test("keeps assigned gap text visible under forced colors", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await page.goto("/");
    await pasteXml(page, GAP_PLACEMENT_WIDTH_ITEM);

    const player = page.locator("qti-assessment-item-player");
    const assignedGapButton = player.locator('[data-gap-identifier="G2"] button');

    await assignGap(page, "Gap match", "A", "G2");
    await expect(assignedGapButton).toHaveText("alpha");
    await expectGapButtonMatchesPlayerForeground(player, "G2");
    await expect(assignedGapButton).toHaveCSS("border-bottom-style", "solid");
  });

  test("applies gap choices container width without widening inline gap targets", async ({
    page,
  }) => {
    await page.goto("/");
    await pasteXml(page, GAP_CHOICES_CONTAINER_WIDTH_ITEM);

    const player = page.locator("qti-assessment-item-player");
    const bank = player.locator(".qti3-gap-source-region");
    const gapButton = player.locator('[data-gap-identifier="G1"] button');

    await expect(bank).toHaveAttribute("data-qti-choices-container-width", "200");

    const bankBox = await bank.boundingBox();
    const gapBox = await gapButton.boundingBox();
    if (!bankBox || !gapBox) throw new Error("Missing gap layout boxes.");
    expect(Math.abs(bankBox.width - 200)).toBeLessThanOrEqual(2);
    expect(gapBox.width).toBeLessThan(100);
  });
});
