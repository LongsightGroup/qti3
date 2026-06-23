import { expect, test } from "@playwright/test";
import { pasteXml } from "./player-helpers.js";

test.describe("player MathML rendering", () => {
  test("renders MathML inside simple choice labels", async ({ page }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="choice-polynomials" title="Identifying polynomials" adaptive="false" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>ChoiceA</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <p>Which of the following is not a polynomial?</p>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-simple-choice identifier="ChoiceA">
        <math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
          <semantics>
            <mrow>
              <msup><mi>sec</mi><mn>2</mn></msup>
              <mi>&#x398;</mi>
            </mrow>
            <annotation encoding="SnuggleTeX">\\[ \\sec^2{\\theta} \\]</annotation>
          </semantics>
        </math>
      </qti-simple-choice>
      <qti-simple-choice identifier="ChoiceB">
        <math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
          <semantics>
            <mrow><mi>x</mi><mo>+</mo><mn>1001</mn><mi>y</mi></mrow>
            <annotation encoding="SnuggleTeX">\\[ x+1001y \\]</annotation>
          </semantics>
        </math>
      </qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>`;

    await page.goto("/");
    await pasteXml(page, xml);

    const choiceText = page.locator("qti-assessment-item-player .qti3-choice-text");
    await expect(choiceText.locator("math")).toHaveCount(2);
    await expect(choiceText.locator("annotation")).toHaveCount(2);
    await expect(choiceText.locator("msup")).toHaveCount(1);
    await expect(choiceText.locator("annotation").first()).toHaveAttribute(
      "encoding",
      "SnuggleTeX",
    );
    await expect(choiceText.locator("math").first()).toHaveAttribute("display", "block");
    await expect(choiceText.locator("math").first()).toContainText("Θ");
    await expect(choiceText.locator("math").first()).not.toContainText("&#x398;");
    await expect(
      page.locator('qti-assessment-item-player [data-choice-identifier="ChoiceA"] input'),
    ).toHaveAttribute("aria-label", "sec 2 Θ");
    expect(
      await choiceText
        .locator("math")
        .first()
        .evaluate((element) => element.namespaceURI),
    ).toBe("http://www.w3.org/1998/Math/MathML");
  });

  test("renders MathML associate pair chips as rich content without annotation text fallback", async ({
    page,
  }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="matching-associate-trigDeriv" title="Associate derivatives of trigonometric functions" adaptive="false" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="pair"/>
  <qti-item-body>
    <qti-associate-interaction response-identifier="RESPONSE" shuffle="false" max-associations="3">
      <qti-prompt>Match the expressions:</qti-prompt>
      <qti-simple-associable-choice identifier="A" match-max="1">
        <math xmlns="http://www.w3.org/1998/Math/MathML">
          <semantics>
            <mrow>
              <mfrac><mi>d</mi><mrow><mi>d</mi><mi>&#x398;</mi></mrow></mfrac>
              <mfenced close=")" open="("><mrow><mi>sin</mi><mi>&#x398;</mi></mrow></mfenced>
            </mrow>
            <annotation encoding="SnuggleTeX">\\[ \\frac{d}{d\\theta}(\\sin{\\theta}) \\]</annotation>
          </semantics>
        </math>
      </qti-simple-associable-choice>
      <qti-simple-associable-choice identifier="D" match-max="1">
        <math xmlns="http://www.w3.org/1998/Math/MathML">
          <semantics>
            <mrow><mi>cos</mi><mi>&#x398;</mi></mrow>
            <annotation encoding="SnuggleTeX">\\[ \\cos{\\theta} \\]</annotation>
          </semantics>
        </math>
      </qti-simple-associable-choice>
    </qti-associate-interaction>
  </qti-item-body>
</qti-assessment-item>`;

    await page.goto("/");
    await pasteXml(page, xml);
    await page
      .locator('qti-assessment-item-player [aria-label="Associate sources"]')
      .locator('[data-choice-identifier="A"]')
      .click();
    await page
      .locator('qti-assessment-item-player [aria-label="Associate targets"]')
      .locator('[data-choice-identifier="D"]')
      .click();

    const chip = page.locator("qti-assessment-item-player .qti3-pair-chip").first();
    const label = chip.locator(".qti3-pair-chip-label");
    await expect(label.locator("math")).toHaveCount(2);
    await expect(label.locator("annotation")).toHaveCount(2);
    await expect(label.locator("math").first()).toContainText("Θ");
    expect(
      await label
        .locator("math")
        .first()
        .evaluate((element) => element.namespaceURI),
    ).toBe("http://www.w3.org/1998/Math/MathML");

    const directText = await label.evaluate((element) =>
      Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? "")
        .join(""),
    );
    expect(directText).toBe(" to ");
    await expect(chip.getByRole("button", { name: /Remove/ })).not.toHaveAttribute(
      "aria-label",
      /\\\[/,
    );
  });

  test("renders MathML inside order interaction prompts", async ({ page }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="order-maths" title="Order a simple proof" adaptive="false" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="ordered" base-type="identifier"/>
  <qti-item-body>
    <qti-order-interaction response-identifier="RESPONSE" shuffle="false" orientation="vertical">
      <qti-prompt>Place the lines of the proof that the sum is <math xmlns="http://www.w3.org/1998/Math/MathML">
        <semantics>
          <mfrac>
            <mrow><mi>a</mi><mfenced close=")" open="("><mrow><mn>1</mn><mo>-</mo><msup><mi>r</mi><mi>n</mi></msup></mrow></mfenced></mrow>
            <mrow><mn>1</mn><mo>-</mo><mi>r</mi></mrow>
          </mfrac>
          <annotation encoding="SnuggleTeX">\\[ \\frac{a(1-r^n)}{1-r} \\]</annotation>
        </semantics>
      </math> in the correct order:</qti-prompt>
      <qti-simple-choice identifier="Line1">
        <math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
          <semantics>
            <mrow><msub><mi>S</mi><mi>n</mi></msub><mo>=</mo><mi>a</mi><mo>+</mo><mi>a</mi><mi>r</mi><mo>+</mo><mi>a</mi><msup><mi>r</mi><mn>2</mn></msup></mrow>
            <annotation encoding="SnuggleTeX">\\[ S_n=a+ar+ar^2 \\]</annotation>
          </semantics>
        </math>
      </qti-simple-choice>
      <qti-simple-choice identifier="Line2">
        <math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
          <semantics>
            <mrow><msub><mi>S</mi><mi>n</mi></msub><mo>=</mo><mfrac><mrow><mi>a</mi><mfenced close=")" open="("><mrow><mn>1</mn><mo>-</mo><msup><mi>r</mi><mi>n</mi></msup></mrow></mfenced></mrow><mrow><mn>1</mn><mo>-</mo><mi>r</mi></mrow></mfrac></mrow>
            <annotation encoding="SnuggleTeX">\\[ S_n=\\frac{a(1-r^n)}{1-r} \\]</annotation>
          </semantics>
        </math>
      </qti-simple-choice>
    </qti-order-interaction>
  </qti-item-body>
</qti-assessment-item>`;

    await page.goto("/");
    await pasteXml(page, xml);

    const heading = page.locator("qti-assessment-item-player .qti3-order h3");
    const math = heading.locator("math");
    await expect(math).toHaveCount(1);
    await expect(math.locator("mfrac")).toHaveCount(1);
    await expect(math.locator("annotation")).toHaveAttribute("encoding", "SnuggleTeX");
    await expect(heading).toContainText("Place the lines of the proof");
    await expect(heading).toContainText("in the correct order:");
    expect(await math.evaluate((element) => element.namespaceURI)).toBe(
      "http://www.w3.org/1998/Math/MathML",
    );

    const directText = await heading.evaluate((element) =>
      Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? "")
        .join(""),
    );
    expect(directText).not.toContain("\\[");
    expect(directText).not.toContain("frac");

    const rowHeights = await page
      .locator("qti-assessment-item-player .qti3-reorder-list > .qti3-reorder-item")
      .evaluateAll((items) => items.map((item) => item.getBoundingClientRect().height));
    for (const height of rowHeights) expect(height).toBeGreaterThanOrEqual(64);

    const verticalOffsets = await page
      .locator("qti-assessment-item-player .qti3-reorder-list > .qti3-reorder-item")
      .evaluateAll((items) =>
        items.map((item) => {
          const itemRect = item.getBoundingClientRect();
          const buttonRect = item.querySelector("button")?.getBoundingClientRect();
          if (!buttonRect) return Number.POSITIVE_INFINITY;
          return Math.abs(
            itemRect.top + itemRect.height / 2 - (buttonRect.top + buttonRect.height / 2),
          );
        }),
      );
    for (const offset of verticalOffsets) expect(offset).toBeLessThanOrEqual(1);
  });

  test("expands math-variable template values in MathML identifiers", async ({ page }) => {
    await page.goto("/");
    await page.locator("#fixture").selectOption("template-content-reference");
    await page.locator("#load-fixture").click();

    const math = page.locator("qti-assessment-item-player math");
    await expect(math.locator("mi").first()).toHaveText("3");
    expect(await math.evaluate((element) => element.namespaceURI)).toBe(
      "http://www.w3.org/1998/Math/MathML",
    );
  });
});
