import { expect, test } from "@playwright/test";
import { sliderItem } from "./fixtures/slider-items.js";
import { currentResponse, pasteXml } from "./player-helpers.js";

test.describe("slider cross-browser native mechanics", () => {
  test("uses physical keyboard direction for vertical and reversed sliders", async ({ page }) => {
    await page.goto("/");

    await pasteXml(
      page,
      sliderItem({
        identifier: "cross-browser-vertical-slider",
        attributes: 'lower-bound="0" upper-bound="8" step="1" orientation="vertical"',
      }),
    );
    let slider = page.locator('qti-assessment-item-player input[type="range"]');
    await slider.focus();
    await page.keyboard.press("ArrowUp");
    expect(await currentResponse(page)).toBe(1);

    await pasteXml(
      page,
      sliderItem({
        identifier: "cross-browser-vertical-reversed-slider",
        attributes:
          'lower-bound="0" upper-bound="8" step="1" orientation="vertical" reverse="true"',
      }),
    );
    slider = page.locator('qti-assessment-item-player input[type="range"]');
    await slider.focus();
    await page.keyboard.press("ArrowDown");
    expect(await currentResponse(page)).toBe(1);

    await pasteXml(
      page,
      sliderItem({
        identifier: "cross-browser-horizontal-reversed-slider",
        attributes: 'lower-bound="0" upper-bound="8" step="1" reverse="true"',
      }),
    );
    slider = page.locator('qti-assessment-item-player input[type="range"]');
    await slider.focus();
    await page.keyboard.press("ArrowLeft");
    expect(await currentResponse(page)).toBe(1);
  });

  test("keeps an unaligned upper endpoint keyboard reachable", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      sliderItem({
        identifier: "cross-browser-unaligned-slider",
        attributes: 'lower-bound="0" upper-bound="10" step="3"',
      }),
    );

    const slider = page.locator('qti-assessment-item-player input[type="range"]');
    await expect(slider).toHaveAttribute("step", "any");
    await slider.focus();
    await page.keyboard.press("End");
    expect(await currentResponse(page)).toBe(10);
  });
});
