import { expect, test } from "@playwright/test";
import {
  dataSsmlPlayerItemXml,
  mathBodyItemXml,
  semanticBodyItemXml,
  sharedVocabularyBodyItemXml,
  unsafeBodyItemXml,
} from "./body-content-fixtures.js";
import { pasteXml } from "./player-helpers.js";
import { getTextToSpeechTraversal, playerLocator } from "./player-test-api.js";

test.describe("player body content", () => {
  test("preserves safe HTML and MathML body content", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, mathBodyItemXml);

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
    await page.goto("/");
    await pasteXml(page, semanticBodyItemXml);

    const player = playerLocator(page);
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
    await page.goto("/");
    await page.evaluate(() => {
      window.qtiUnsafe = false;
    });
    await pasteXml(page, unsafeBodyItemXml);

    const player = playerLocator(page);
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
    await page.goto("/");
    await pasteXml(page, sharedVocabularyBodyItemXml);

    const player = playerLocator(page);
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
    await page.goto("/");
    await pasteXml(page, dataSsmlPlayerItemXml);

    const player = playerLocator(page);
    await expect(player.locator("#mrna")).toHaveAttribute(
      "data-ssml",
      '{"sub":{"alias":"messenger RNA"}}',
    );
    await expect(player.locator("#spoken-prompt")).toHaveAttribute(
      "data-ssml",
      '{"prosody":{"rate":"slow"}}',
    );

    const traversal = await getTextToSpeechTraversal(page);

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
});

declare global {
  interface Window {
    qtiUnsafe?: boolean;
  }
}
