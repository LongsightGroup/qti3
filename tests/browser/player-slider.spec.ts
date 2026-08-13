import { expect, test } from "@playwright/test";
import { expectNoAxeViolationsOnPlayer } from "./axe-helpers.js";
import { sliderItem } from "./fixtures/slider-items.js";
import { currentResponse, loadFixture, pasteXml } from "./player-helpers.js";

test.describe("slider interaction", () => {
  test("renders a custom presentation over one native range control", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      sliderItem({
        identifier: "native-backed-slider",
        attributes: 'lower-bound="0" upper-bound="100" step="1" step-label="true"',
        prompt: "Choose a percentage.",
      }),
    );

    const player = page.locator("qti-assessment-item-player");
    const group = player.locator(".qti3-slider-response");
    const input = group.locator('input[type="range"]');
    const output = group.locator("output");
    const thumb = group.locator(".qti3-slider-thumb");
    await player.evaluate((element) => {
      element.dataset.responseChangeCount = "0";
      element.addEventListener("qti-responsechange", () => {
        const currentCount = Number(element.dataset.responseChangeCount ?? "0");
        element.dataset.responseChangeCount = String(currentCount + 1);
      });
    });

    expect(await currentResponse(page)).toBeUndefined();
    await expect(group).toHaveAttribute("data-response-state", "unset");
    await expect(input).toHaveAttribute("aria-valuetext", "No response selected");
    await expect(output).toHaveText("No response selected");
    await expect(thumb).toHaveCSS("visibility", "hidden");
    await expect(group.locator(".qti3-slider-scale")).toHaveAttribute(
      "data-label-density",
      "sampled",
    );
    await expect(group.locator(".qti3-slider-tick-label")).toHaveCount(9);
    await expect(group.locator(".qti3-slider-tick-label").first()).toHaveText("0");
    await expect(group.locator(".qti3-slider-tick-label").last()).toHaveText("100");

    const inputBox = await input.boundingBox();
    if (!inputBox) throw new Error("Missing native slider input box.");
    expect(inputBox.height).toBeGreaterThanOrEqual(44);
    await input.click({ position: { x: inputBox.width / 2, y: inputBox.height / 2 } });

    const response = await currentResponse(page);
    if (typeof response !== "number") throw new Error("Expected numeric slider response.");
    expect(response).toBeGreaterThanOrEqual(49);
    expect(response).toBeLessThanOrEqual(51);
    await expect(group).toHaveAttribute("data-response-state", "set");
    await expect(input).not.toHaveAttribute("aria-valuetext");
    await expect(output).toHaveText(String(response));
    await expect(thumb).toHaveCSS("visibility", "visible");
    await expect(player).toHaveAttribute("data-response-change-count", "1");
  });

  test("preserves exact high-precision range attributes", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      sliderItem({
        identifier: "high-precision-slider",
        baseType: "float",
        attributes:
          'lower-bound="0.123456789012345" upper-bound="0.123456789012346" step="0.000000000000001"',
      }),
    );

    const input = page.locator('qti-assessment-item-player input[type="range"]');
    await expect(input).toHaveAttribute("min", "0.123456789012345");
    await expect(input).toHaveAttribute("max", "0.123456789012346");
    await expect(input).toHaveAttribute("step", "1e-15");
  });

  test("keeps an unaligned authored upper bound reachable", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      sliderItem({
        identifier: "unaligned-upper-slider",
        attributes: 'lower-bound="0" upper-bound="10" step="3" step-label="true"',
      }),
    );

    const group = page.locator("qti-assessment-item-player .qti3-slider-response");
    const input = group.locator('input[type="range"]');
    await expect(group.locator(".qti3-slider-tick-label")).toHaveText(["0", "3", "6", "9", "10"]);
    await input.focus();
    await page.keyboard.press("End");
    expect(await currentResponse(page)).toBe(10);
    await expect(input).toHaveValue("10");

    await input.evaluate((element) => {
      element.value = "9.9";
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(await currentResponse(page)).toBe(10);
    await expect(input).toHaveValue("10");
  });

  test("renders no operable slider when authored attributes are invalid", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      sliderItem({
        identifier: "invalid-slider",
        attributes:
          'lower-bound="10" upper-bound="5" step="0" orientation="diagonal" reverse="backward"',
      }),
    );

    const player = page.locator("qti-assessment-item-player");
    await expect(player.locator('input[type="range"]')).toHaveCount(0);
    await expect(player.locator(".qti3-slider-invalid")).toHaveText(
      "Slider interaction (RESPONSE) has invalid authored attributes.",
    );
  });

  test("renders vertical reversed geometry and every authored step label", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      sliderItem({
        identifier: "vertical-reversed-slider",
        attributes:
          'lower-bound="0" upper-bound="8" step="1" step-label="true" orientation="vertical" reverse="true"',
        prompt: "Choose a level.",
      }),
    );

    const group = page.locator("qti-assessment-item-player .qti3-slider-response");
    const input = group.locator('input[type="range"]');
    await expect(group).toHaveAttribute("data-orientation", "vertical");
    await expect(group).toHaveAttribute("data-reverse", "true");
    await expect(input).toHaveAttribute("aria-orientation", "vertical");
    await expect(input).toHaveCSS("writing-mode", "vertical-lr");
    await expect(input).toHaveCSS("direction", "ltr");
    await expect(group.locator(".qti3-slider-scale")).toHaveAttribute("data-label-density", "all");
    await expect(group.locator(".qti3-slider-tick-label")).toHaveText([
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
    ]);

    await input.focus();
    await page.keyboard.press("End");
    expect(await currentResponse(page)).toBe(8);
    const thumbBox = await group.locator(".qti3-slider-thumb").boundingBox();
    const trackBox = await group.locator(".qti3-slider-track").boundingBox();
    if (!thumbBox || !trackBox) throw new Error("Missing vertical slider geometry.");
    expect(thumbBox.y + thumbBox.height / 2).toBeGreaterThan(trackBox.y + trackBox.height * 0.9);
    await expectNoAxeViolationsOnPlayer(page, "vertical reversed slider");
  });

  test("keeps the custom slider visible and focused in forced colors", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await page.goto("/");
    await loadFixture(page, "slider");

    await expect
      .poll(() => page.evaluate(() => window.matchMedia("(forced-colors: active)").matches))
      .toBe(true);

    const group = page.locator("qti-assessment-item-player .qti3-slider-response");
    const input = group.locator('input[type="range"]');
    await input.evaluate((element) => {
      element.value = "2024";
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.keyboard.press("Escape");
    await input.focus();

    await expect(group.locator(".qti3-slider-visual")).toHaveCSS("outline-style", "solid");
    await expect(group.locator(".qti3-slider-visual")).toHaveCSS("outline-width", "3px");
    const colors = await group.evaluate((element) => {
      const railElement = element.querySelector(".qti3-slider-rail");
      const thumbElement = element.querySelector(".qti3-slider-thumb");
      if (!railElement || !thumbElement) throw new Error("Missing slider visual elements.");
      const rail = getComputedStyle(railElement);
      const thumb = getComputedStyle(thumbElement);
      return {
        railBorder: rail.borderTopColor,
        thumbBackground: thumb.backgroundColor,
      };
    });
    expect(colors.railBorder).not.toBe("rgba(0, 0, 0, 0)");
    expect(colors.thumbBackground).not.toBe("rgba(0, 0, 0, 0)");
  });
});
