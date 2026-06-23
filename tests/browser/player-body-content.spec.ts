import { expect, test } from "@playwright/test";
import { pasteXml } from "./player-helpers.js";

test.describe("player body content", () => {
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
});

declare global {
  interface Window {
    qtiUnsafe?: boolean;
  }
}
