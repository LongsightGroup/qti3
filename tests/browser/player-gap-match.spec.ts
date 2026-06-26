import { expect, test, type Locator } from "@playwright/test";
import {
  GAP_CHOICES_CONTAINER_WIDTH_ITEM,
  GAP_PLACEMENT_WIDTH_ITEM,
} from "./fixtures/dom-behavior-items.js";
import {
  assignGap,
  currentResponse,
  expectResponse,
  loadFixture,
  pasteXml,
} from "./player-helpers.js";

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
    await expect(assignedGapButton).toHaveText("claim");
    await expect(assignedGapButton).toHaveAccessibleName("Gap 1, assigned claim");
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

  test("renders gap match gaps in the authored sentence", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "gapMatch");

    const player = page.locator("qti-assessment-item-player");
    await expect(player).toContainText("The water sample data are the");
    await expect(player).toContainText("that supports the report's");
    await expect(player.locator(".qti3-gap-region")).not.toContainText("G1");
    await expect(player.locator(".qti3-gap-region")).not.toContainText("G2");
    await expect(player.locator(".qti3-gap-region")).not.toContainText("Empty");
    await expect(player.locator(".qti3-gap-region")).not.toContainText("Remove");

    const inlineFlow = await player.locator(".qti3-gap-region").evaluate((region) => {
      const walker = document.createTreeWalker(region, NodeFilter.SHOW_TEXT);
      let textNode: Text | undefined;
      while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        if (node.data.includes("The water sample data are the")) {
          textNode = node;
          break;
        }
      }
      if (!textNode) throw new Error("Missing text before first gap.");

      const range = document.createRange();
      const phrase = "The water sample data are the";
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
});
