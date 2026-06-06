import { expect, test, type Locator } from "@playwright/test";
import {
  assignGap,
  currentResponse,
  expectMoveButtons,
  loadFixture,
  pasteXml,
  provideResponse,
  visibleValidationAlertCount,
} from "./player-helpers.js";

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

const ITEM_LAYOUT_SHARED_VOCABULARY_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item-layout-shared-vocabulary" title="item-layout-shared-vocabulary" time-dependent="false">
  <qti-item-body>
    <div id="layout-row" class="qti-layout-row">
      <div id="layout-left" class="qti-layout-col6 qti-bordered">
        <p id="aligned" class="qti-align-center qti-text-indent-2">Left layout column.</p>
      </div>
      <div id="layout-right" class="qti-layout-col-6 qti-well">
        <p><span id="underlined" class="qti-underline">Right layout column.</span></p>
        <ul id="styled-list" class="qti-list-style-type-square">
          <li><span id="inline" class="qti-italic qti-display-inline-block qti-valign-middle">Inline utility.</span></li>
        </ul>
        <p id="vertical" class="qti-writing-mode-vertical-rl"><span id="combined" class="qti-text-combine-upright-all">2026</span></p>
      </div>
    </div>
    <div id="offset-row" class="qti-layout-row">
      <div id="offset-column" class="qti-layout-col-3 qti-layout-offset-3">Offset column.</div>
    </div>
  </qti-item-body>
</qti-assessment-item>
`.trim();

const CHOICE_PRESENTATION_SHARED_VOCABULARY_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="choice-presentation-shared-vocabulary" title="choice-presentation-shared-vocabulary" time-dependent="false">
  <qti-response-declaration identifier="CHOICE_RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-response-declaration identifier="HOTTEXT_RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="CHOICE_RESPONSE" max-choices="1" class="qti-input-control-hidden qti-labels-cjk-ideographic qti-labels-suffix-period qti-writing-orientation-vertical-rl">
      <qti-simple-choice identifier="A">First hidden-control choice</qti-simple-choice>
      <qti-simple-choice identifier="B">Second hidden-control choice</qti-simple-choice>
    </qti-choice-interaction>
    <qti-hottext-interaction response-identifier="HOTTEXT_RESPONSE" max-choices="1" class="qti-input-control-hidden qti-unselected-hidden">
      <p>Select the <qti-hottext identifier="A">hidden indicator</qti-hottext> phrase.</p>
    </qti-hottext-interaction>
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

const ORDER_SHARED_VOCABULARY_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="order-shared-vocabulary" title="order-shared-vocabulary" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="ordered" base-type="identifier"/>
  <qti-item-body>
    <qti-order-interaction response-identifier="RESPONSE" class="qti-choices-top qti-labels-decimal qti-labels-suffix-parenthesis">
      <qti-simple-choice identifier="A">First step</qti-simple-choice>
      <qti-simple-choice identifier="B">Second step</qti-simple-choice>
      <qti-simple-choice identifier="C">Third step</qti-simple-choice>
    </qti-order-interaction>
  </qti-item-body>
</qti-assessment-item>
`.trim();

const HORIZONTAL_ORDER_ATTRIBUTE_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="q15-order-example-2" title="Grand Prix of Bahrain (horizontal)" adaptive="false" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="ordered" base-type="identifier">
    <qti-correct-response>
      <qti-value>DriverC</qti-value>
      <qti-value>DriverA</qti-value>
      <qti-value>DriverB</qti-value>
    </qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <qti-order-interaction response-identifier="RESPONSE" orientation="horizontal">
      <qti-prompt>The following F1 drivers finished on the podium in the first ever Grand Prix of Bahrain. Can you rearrange them into the correct finishing order from left to right, 1st, 2nd, and 3rd?</qti-prompt>
      <qti-simple-choice identifier="DriverA">Rubens Barrichello</qti-simple-choice>
      <qti-simple-choice identifier="DriverB">Jenson Button</qti-simple-choice>
      <qti-simple-choice identifier="DriverC">Michael Schumacher</qti-simple-choice>
    </qti-order-interaction>
    <p>Note: The <em>orientation</em> of the layout of the drivers should be horizontal.</p>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct.xml"/>
</qti-assessment-item>
`.trim();

const MATCH_TABULAR_SHARED_VOCABULARY_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="match-tabular-shared-vocabulary" title="match-tabular-shared-vocabulary" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-match-interaction response-identifier="RESPONSE" class="qti-match-tabular" data-first-column-header="Characters">
      <qti-simple-match-set>
        <qti-simple-associable-choice identifier="C" match-max="1">Capulet</qti-simple-associable-choice>
        <qti-simple-associable-choice identifier="D" match-max="1">Demetrius</qti-simple-associable-choice>
      </qti-simple-match-set>
      <qti-simple-match-set>
        <qti-simple-associable-choice identifier="M" match-max="1">A Midsummer Night's Dream</qti-simple-associable-choice>
        <qti-simple-associable-choice identifier="R" match-max="1">Romeo and Juliet</qti-simple-associable-choice>
      </qti-simple-match-set>
    </qti-match-interaction>
  </qti-item-body>
</qti-assessment-item>
`.trim();

const GAP_PLACEMENT_WIDTH_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="gap-placement-width" title="gap-placement-width" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-gap-match-interaction response-identifier="RESPONSE" class="qti-gap-placement qti-choices-left" data-choices-container-width="120">
      <qti-gap-text identifier="A" match-max="1">alpha</qti-gap-text>
      <qti-gap-text identifier="B" match-max="1">beta</qti-gap-text>
      <p>Place <qti-gap identifier="G1" class="qti-input-width-3"/> before <qti-gap identifier="G2" class="qti-input-width-10"/>.</p>
    </qti-gap-match-interaction>
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

async function orderItemRects(
  interaction: Locator,
): Promise<Array<{ identifier: string; x: number; y: number; width: number; height: number }>> {
  return interaction.locator(".qti3-reorder-item").evaluateAll((elements) =>
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

async function dropOrderChoiceOnTarget(
  layout: Locator,
  identifier: string,
  targetIndex: number,
): Promise<{ dragoverDefaultPrevented: boolean; dropDefaultPrevented: boolean }> {
  return await layout.evaluate(
    (element, payload) => {
      const target =
        element.querySelectorAll<HTMLElement>(".qti3-order-target-slot")[payload.targetIndex];
      if (!target) throw new Error(`Missing order target slot ${payload.targetIndex}.`);
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/plain", payload.identifier);
      const dragover = new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer });
      const drop = new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer });
      target.dispatchEvent(dragover);
      target.dispatchEvent(drop);
      return {
        dragoverDefaultPrevented: dragover.defaultPrevented,
        dropDefaultPrevented: drop.defaultPrevented,
      };
    },
    { identifier, targetIndex },
  );
}

async function moveOrderSlotChoiceToTarget(
  layout: Locator,
  identifier: string,
  targetIndex: number,
): Promise<void> {
  await layout.evaluate(
    (element, payload) => {
      const source = element.querySelector<HTMLElement>(
        `.qti3-order-target-item[data-choice-identifier="${payload.identifier}"]`,
      );
      const target =
        element.querySelectorAll<HTMLElement>(".qti3-order-target-slot")[payload.targetIndex];
      if (!source || !target) {
        throw new Error(`Missing order drag source or target for ${payload.identifier}.`);
      }
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/plain", payload.identifier);
      source.dispatchEvent(
        new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer }),
      );
      target.dispatchEvent(
        new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }),
      );
      target.dispatchEvent(
        new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }),
      );
    },
    { identifier, targetIndex },
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

  test("applies readable prose spacing inside nested item body content", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="nested-prose" title="nested-prose" time-dependent="false">
  <qti-item-body>
    <div class="qti-shared-stimulus">
      <div class="qti-stimulus-body-element">
        <p>Read the following passage and answer the questions.</p>
        <section aria-labelledby="h_1">
          <h2 id="h_1">Down the Rabbit-Hole</h2>
          <p>Alice was beginning to get very tired of sitting by her sister on the bank.</p>
          <p>There was nothing so <em>very</em> remarkable in that; nor did Alice think it so <em>very</em> much out of the way.</p>
        </section>
      </div>
    </div>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const player = page.locator("qti-assessment-item-player");
    const firstParagraph = player.locator(".qti3-item-body .qti-stimulus-body-element > p");
    const heading = player.locator(".qti3-item-body h2");
    const paragraphAfterHeading = player.locator(".qti3-item-body section p").first();

    await expect(firstParagraph).toHaveCSS("margin-top", "0px");
    await expect(firstParagraph).toHaveCSS("margin-bottom", "16px");
    await expect(firstParagraph).toHaveCSS("font-size", "16px");
    await expect(firstParagraph).toHaveCSS("line-height", "23.2px");
    await expect(heading).toHaveCSS("margin-bottom", "16px");
    await expect(paragraphAfterHeading).toHaveCSS("margin-bottom", "16px");
    await expect(player.locator(".qti3-item-body section p").nth(1)).toContainText(
      "There was nothing so very remarkable in that; nor did Alice think it so very much",
    );
  });

  test("renders block choice interactions as top-level sections", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "choice");

    const player = page.locator("qti-assessment-item-player");
    await expect(player.locator('[data-interaction-type="choice"]').first()).toBeVisible();
    await expect(player.locator("p .qti3-inlineChoice")).toHaveCount(0);
  });

  test("applies item-body shared vocabulary layout and presentation classes", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, ITEM_LAYOUT_SHARED_VOCABULARY_ITEM);

    const player = page.locator("qti-assessment-item-player");
    const row = player.locator("#layout-row");
    const left = player.locator("#layout-left");
    const right = player.locator("#layout-right");
    await expect(row).toHaveCSS("display", "flex");
    const rowBox = await row.boundingBox();
    const leftBox = await left.boundingBox();
    const rightBox = await right.boundingBox();
    if (!rowBox || !leftBox || !rightBox) throw new Error("Missing shared layout boxes.");
    expect(rightBox.x).toBeGreaterThan(leftBox.x);
    expect(Math.abs(leftBox.width - rowBox.width / 2)).toBeLessThanOrEqual(2);
    expect(Math.abs(rightBox.width - rowBox.width / 2)).toBeLessThanOrEqual(2);

    const offsetBox = await player.locator("#offset-column").boundingBox();
    const offsetRowBox = await player.locator("#offset-row").boundingBox();
    if (!offsetBox || !offsetRowBox) throw new Error("Missing shared offset layout boxes.");
    expect(offsetBox.x - offsetRowBox.x).toBeGreaterThan(offsetRowBox.width * 0.2);

    await expect(left).toHaveCSS("border-top-style", "solid");
    await expect(player.locator("#aligned")).toHaveCSS("text-align", "center");
    await expect(player.locator("#styled-list")).toHaveCSS("list-style-type", "square");
    await expect(player.locator("#underlined")).toHaveCSS("text-decoration-line", /underline/);
    await expect(player.locator("#inline")).toHaveCSS("font-style", "italic");
    await expect(player.locator("#inline")).toHaveCSS("display", "inline-block");
    await expect(player.locator("#vertical")).toHaveCSS("writing-mode", "vertical-rl");
    await expect(player.locator("#combined")).toHaveCSS("text-combine-upright", "all");

    await page.setViewportSize({ width: 390, height: 720 });
    await pasteXml(page, ITEM_LAYOUT_SHARED_VOCABULARY_ITEM);
    const narrowLeftBox = await player.locator("#layout-left").boundingBox();
    const narrowRightBox = await player.locator("#layout-right").boundingBox();
    if (!narrowLeftBox || !narrowRightBox) throw new Error("Missing narrow shared layout boxes.");
    expect(Math.abs(narrowRightBox.x - narrowLeftBox.x)).toBeLessThanOrEqual(2);
    expect(narrowRightBox.y).toBeGreaterThan(narrowLeftBox.y + narrowLeftBox.height - 1);
  });

  test("keeps hottext shared vocabulary indicators visible in forced colors", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await page.goto("/");
    await pasteXml(page, CHOICE_PRESENTATION_SHARED_VOCABULARY_ITEM);

    await expect
      .poll(() => page.evaluate(() => window.matchMedia("(forced-colors: active)").matches))
      .toBe(true);

    const token = page.locator("qti-assessment-item-player .qti3-hottext-token");
    const hiddenStyles = await token.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        borderTopColor: style.borderTopColor,
        color: style.color,
      };
    });
    expect(hiddenStyles.borderTopColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(hiddenStyles.color).not.toBe("rgba(0, 0, 0, 0)");

    await token.click();
    await expect(token).toHaveAttribute("data-selected", "true");
    const selectedStyles = await token.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        color: style.color,
      };
    });
    expect(selectedStyles.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(selectedStyles.color).not.toBe(selectedStyles.backgroundColor);
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

  test("renders order shared vocabulary as choices bank and target slots", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, ORDER_SHARED_VOCABULARY_ITEM);

    const layout = page.locator("qti-assessment-item-player .qti3-order-sv-layout");
    const bank = layout.locator(".qti3-order-choices-bank");
    await expect(bank.getByRole("button")).toHaveCount(3);
    const targets = layout.locator(".qti3-order-target-slot");
    await expect(targets).toHaveCount(3);
    await expect(targets.nth(0)).toContainText("empty");

    await bank.getByRole("button", { name: "Second step" }).click();
    await expect.poll(() => currentResponse(page)).toEqual(["B"]);
    await bank.getByRole("button", { name: "First step" }).click();
    await expect.poll(() => currentResponse(page)).toEqual(["B", "A"]);
    await expect(bank.getByRole("button")).toHaveCount(1);

    await layout
      .locator('.qti3-order-target-item[data-choice-identifier="B"] [data-move-direction="right"]')
      .click();
    await expect.poll(() => currentResponse(page)).toEqual(["A", "B"]);
    await layout.getByRole("button", { name: "Remove Second step from order" }).click();
    await expect.poll(() => currentResponse(page)).toEqual(["A"]);
    await expect(bank.getByRole("button", { name: "Second step" })).toBeVisible();
  });

  test("honors horizontal orientation attributes on plain order interactions", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, HORIZONTAL_ORDER_ATTRIBUTE_ITEM);

    const interaction = page.locator(
      'qti-assessment-item-player .qti3-order[data-response-identifier="RESPONSE"]',
    );
    const list = interaction.locator(".qti3-reorder-list");
    await expect(list).toHaveAttribute("data-qti-order-orientation", "horizontal");
    await expectMoveButtons(
      interaction.locator(".qti3-reorder-item").nth(1).locator(".qti3-move-button"),
      ["left", "right"],
    );

    const rects = await orderItemRects(interaction);
    expect(rects.map((rect) => rect.identifier)).toEqual(["DriverA", "DriverB", "DriverC"]);
    expect(rects).toHaveLength(3);
    expect(Math.abs(rects[1]!.y - rects[0]!.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(rects[2]!.y - rects[0]!.y)).toBeLessThanOrEqual(2);
    expect(rects[1]!.x).toBeGreaterThan(rects[0]!.x);
    expect(rects[2]!.x).toBeGreaterThan(rects[1]!.x);

    const moveSchumacherLeft = interaction.locator(
      '.qti3-reorder-item[data-choice-identifier="DriverC"] [data-move-direction="left"]',
    );
    await moveSchumacherLeft.click();
    await moveSchumacherLeft.click();
    await expect.poll(() => currentResponse(page)).toEqual(["DriverC", "DriverA", "DriverB"]);
  });

  test("places order shared vocabulary choices into any target slot", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, ORDER_SHARED_VOCABULARY_ITEM);

    const layout = page.locator("qti-assessment-item-player .qti3-order-sv-layout");
    const bank = layout.locator(".qti3-order-choices-bank");
    const targets = layout.locator(".qti3-order-target-slot");

    await expect(targets.nth(0)).toHaveAttribute("data-empty", "true");
    await expect(targets.nth(1)).toHaveAttribute("data-empty", "true");
    await expect(targets.nth(2)).toHaveAttribute("data-empty", "true");

    expect(await dropOrderChoiceOnTarget(layout, "A", 2)).toEqual({
      dragoverDefaultPrevented: true,
      dropDefaultPrevented: true,
    });
    await expect.poll(() => currentResponse(page)).toEqual(["A"]);
    await expect(targets.nth(2).locator(".qti3-order-target-item")).toHaveAttribute(
      "data-choice-identifier",
      "A",
    );
    await expect(bank.getByRole("button", { name: "First step" })).toHaveCount(0);
    await expect(targets.nth(0)).toContainText("empty");
    await expect(targets.nth(1)).toContainText("empty");

    expect(await dropOrderChoiceOnTarget(layout, "B", 1)).toEqual({
      dragoverDefaultPrevented: true,
      dropDefaultPrevented: true,
    });
    await expect.poll(() => currentResponse(page)).toEqual(["B", "A"]);

    expect(await dropOrderChoiceOnTarget(layout, "C", 0)).toEqual({
      dragoverDefaultPrevented: true,
      dropDefaultPrevented: true,
    });
    await expect.poll(() => currentResponse(page)).toEqual(["C", "B", "A"]);
    await expect(targets.nth(0).locator(".qti3-order-target-item")).toHaveAttribute(
      "data-choice-identifier",
      "C",
    );
    await expect(targets.nth(1).locator(".qti3-order-target-item")).toHaveAttribute(
      "data-choice-identifier",
      "B",
    );
    await expect(targets.nth(2).locator(".qti3-order-target-item")).toHaveAttribute(
      "data-choice-identifier",
      "A",
    );

    await moveOrderSlotChoiceToTarget(layout, "A", 0);
    await expect.poll(() => currentResponse(page)).toEqual(["A", "B", "C"]);
    await expect(targets.nth(0).locator(".qti3-order-target-item")).toHaveAttribute(
      "data-choice-identifier",
      "A",
    );
    await expect(targets.nth(2).locator(".qti3-order-target-item")).toHaveAttribute(
      "data-choice-identifier",
      "C",
    );
  });

  test("returns displaced order shared vocabulary choices to the bank on occupied drops", async ({
    page,
  }) => {
    await page.goto("/");
    await pasteXml(page, ORDER_SHARED_VOCABULARY_ITEM);

    const layout = page.locator("qti-assessment-item-player .qti3-order-sv-layout");
    const bank = layout.locator(".qti3-order-choices-bank");
    const targets = layout.locator(".qti3-order-target-slot");

    await dropOrderChoiceOnTarget(layout, "A", 0);
    await expect(targets.nth(0).locator(".qti3-order-target-item")).toHaveAttribute(
      "data-choice-identifier",
      "A",
    );

    await dropOrderChoiceOnTarget(layout, "B", 0);
    await expect.poll(() => currentResponse(page)).toEqual(["B"]);
    await expect(targets.nth(0).locator(".qti3-order-target-item")).toHaveAttribute(
      "data-choice-identifier",
      "B",
    );
    await expect(bank.getByRole("button", { name: "First step" })).toBeVisible();
  });

  test("provides order shared vocabulary responses through the browser helper", async ({
    page,
  }) => {
    await page.goto("/");
    await pasteXml(page, ORDER_SHARED_VOCABULARY_ITEM);

    await provideResponse(page, "order", ["C", "A"]);
    await expect.poll(() => currentResponse(page)).toEqual(["C", "A"]);
    const layout = page.locator("qti-assessment-item-player .qti3-order-sv-layout");
    const targets = layout.locator(".qti3-order-target-slot");
    await expect(layout.locator(".qti3-order-choices-bank").getByRole("button")).toHaveCount(1);
    await expect(targets.nth(0).locator(".qti3-order-target-item")).toHaveAttribute(
      "data-choice-identifier",
      "C",
    );
    await expect(targets.nth(1).locator(".qti3-order-target-item")).toHaveAttribute(
      "data-choice-identifier",
      "A",
    );
    await expect(targets.nth(2)).toHaveAttribute("data-empty", "true");
  });

  test("toggles match shared vocabulary tabular matrix choices", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, MATCH_TABULAR_SHARED_VOCABULARY_ITEM);

    const player = page.locator("qti-assessment-item-player");
    const table = player.locator(".qti3-match-table");
    await expect(table).toBeVisible();

    const capuletRomeo = table.locator(
      '.qti3-match-table-cell[data-source-identifier="C"][data-target-identifier="R"]',
    );
    await capuletRomeo.click();
    await expect(capuletRomeo).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => currentResponse(page)).toEqual(["C R"]);
    await expect(player.locator(".qti3-pair-chip span")).toContainText(
      "Capulet to Romeo and Juliet",
    );

    await capuletRomeo.click();
    await expect(capuletRomeo).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => currentResponse(page)).toEqual([]);

    await capuletRomeo.click();
    await player.getByRole("button", { name: "Remove Capulet to Romeo and Juliet" }).click();
    await expect.poll(() => currentResponse(page)).toEqual([]);
    await expect(capuletRomeo).toHaveAttribute("aria-pressed", "false");
  });

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
    const overflow = await player.evaluate((element) => element.scrollWidth > element.clientWidth);
    expect(overflow).toBe(false);
  });

  test("embeds text entry interactions inside paragraph flow", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "textEntry");

    const player = page.locator("qti-assessment-item-player");
    await expect(player.locator("p input, p textarea").first()).toBeVisible();
    await expect(player.locator('[data-interaction-type="textEntry"]').first()).toBeVisible();
  });

  test("honors extended text placeholder and pattern mask attributes", async ({ page }) => {
    await page.goto("/");
    await page.locator("#fixture").selectOption("extended-text-pattern-mask");
    await page.locator("#load-fixture").click();

    const textarea = page.locator("qti-assessment-item-player textarea");
    const patternMessage = page.locator("qti-assessment-item-player .qti3-pattern-mask-message");

    await expect(textarea).toHaveAttribute("placeholder", "Enter a decimal number...");
    await textarea.pressSequentially("abc");
    await expect(textarea).toHaveValue("");

    await textarea.pressSequentially("12.3456");
    await expect(textarea).toHaveValue("12.345");
    await expect(currentResponse(page)).resolves.toBe("12.345");

    await textarea.evaluate((control) => {
      const textareaControl = control as HTMLTextAreaElement;
      textareaControl.value = "abcdef";
      textareaControl.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await expect(patternMessage).toBeVisible();
    await expect(patternMessage).toHaveText("Maximum of 6 digits or decimal points permitted");
    await expect(textarea).toHaveAttribute("aria-invalid", "true");
    await expect(
      textarea.evaluate((control) => (control as HTMLTextAreaElement).validationMessage),
    ).resolves.toBe("Maximum of 6 digits or decimal points permitted");
    await expect(currentResponse(page)).resolves.toBe("abcdef");

    await textarea.fill("12.34");

    await expect(patternMessage).toBeHidden();
    await expect(textarea).not.toHaveAttribute("aria-invalid", "true");
    await expect(
      textarea.evaluate((control) => (control as HTMLTextAreaElement).checkValidity()),
    ).resolves.toBe(true);
  });

  test("honors inline text entry placeholder and pattern mask attributes", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="text-entry-pattern-mask-inline" title="text-entry-pattern-mask-inline" time-dependent="false" xml:lang="en">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
  <qti-item-body>
    <p>
      Enter up to three digits:
      <qti-text-entry-interaction
        response-identifier="RESPONSE"
        expected-length="3"
        placeholder-text="000"
        pattern-mask="([0-9]{0,3})"
        data-patternmask-message="Maximum of 3 digits permitted"
      />.
    </p>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const input = page.locator("qti-assessment-item-player input.qti3-inline-text-input");
    const patternMessage = page.locator(
      "qti-assessment-item-player .qti3-inline-text-response .qti3-pattern-mask-message",
    );

    await expect(input).toHaveAttribute("placeholder", "000");
    await input.pressSequentially("1234");
    await expect(input).toHaveValue("123");
    await input.evaluate((control) => {
      const textInput = control as HTMLInputElement;
      textInput.value = "abcd";
      textInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(patternMessage).toBeVisible();
    await expect(patternMessage).toHaveText("Maximum of 3 digits permitted");
  });

  test("reports invalid pattern-mask attributes as authoring diagnostics", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="invalid-pattern-mask" title="invalid-pattern-mask" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
  <qti-item-body>
    <qti-extended-text-interaction response-identifier="RESPONSE" pattern-mask="*"/>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(
      state.validationMessages.filter(
        (message) => message.code === "interaction.patternMask.invalid",
      ),
    ).toHaveLength(1);
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
