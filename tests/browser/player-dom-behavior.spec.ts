import { expect, test, type Locator } from "@playwright/test";
import {
  assignGap,
  currentResponse,
  loadFixture,
  pasteXml,
  provideResponse,
  visibleValidationAlertCount,
} from "./player-helpers.js";

const CHOICE_ORIENTATION_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqtiasi_v3p0 https://purl.imsglobal.org/spec/qti/v3p0/schema/xsd/imsqti_asiv3p0_v1p0.xsd" identifier="q2-choice-interaction-single-sv-4b" title="Choice Interaction - Single (SV 4b)- orientation options" adaptive="false" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE1" cardinality="single" base-type="identifier"/>
  <qti-response-declaration identifier="RESPONSE2" cardinality="single" base-type="identifier"/>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <p>
      Choose an option in each orientation example.
    </p>
    <qti-choice-interaction class="qti-orientation-horizontal" max-choices="1" response-identifier="RESPONSE1">
      <qti-prompt>Demonstrates <em>qti-orientation-horizontal</em>.</qti-prompt>
      <qti-simple-choice identifier="ChoiceA">You must stay with your luggage at all times.</qti-simple-choice>
      <qti-simple-choice identifier="ChoiceB">Do not let someone else look after your luggage.</qti-simple-choice>
      <qti-simple-choice identifier="ChoiceC">Remember your luggage when you leave.</qti-simple-choice>
    </qti-choice-interaction>

    <qti-choice-interaction class="qti-orientation-vertical" max-choices="1" response-identifier="RESPONSE2">
      <qti-prompt>Demonstrates <em>qti-orientation-vertical</em>.</qti-prompt>
      <qti-simple-choice identifier="ChoiceA">You must stay with your luggage at all times.</qti-simple-choice>
      <qti-simple-choice identifier="ChoiceB">Do not let someone else look after your luggage.</qti-simple-choice>
      <qti-simple-choice identifier="ChoiceC">Remember your luggage when you leave.</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>
`.trim();

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

const CHOICE_SELECTION_PRESENTATION_SHARED_VOCABULARY_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="choice-selection-presentation-shared-vocabulary" title="choice-selection-presentation-shared-vocabulary" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="identifier"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="0" class="qti-selections-dark qti-unselected-hidden">
      <qti-simple-choice identifier="A">First selection presentation choice</qti-simple-choice>
      <qti-simple-choice identifier="B">Second selection presentation choice</qti-simple-choice>
      <qti-simple-choice identifier="C">Third selection presentation choice</qti-simple-choice>
    </qti-choice-interaction>
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

const ORDER_SHARED_VOCABULARY_LEFT_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="order-shared-vocabulary-left" title="order-shared-vocabulary-left" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="ordered" base-type="identifier"/>
  <qti-item-body>
    <qti-order-interaction response-identifier="RESPONSE" class="qti-choices-left qti-orientation-vertical qti-labels-upper-alpha" data-choices-container-width="180">
      <qti-simple-choice identifier="A">North</qti-simple-choice>
      <qti-simple-choice identifier="B">Center</qti-simple-choice>
      <qti-simple-choice identifier="C">South</qti-simple-choice>
    </qti-order-interaction>
  </qti-item-body>
</qti-assessment-item>
`.trim();

const MATCH_CHOICES_POSITION_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="match-choices-position" title="match-choices-position" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-match-interaction response-identifier="RESPONSE" class="qti-choices-right">
      <qti-simple-match-set>
        <qti-simple-associable-choice identifier="A" match-max="1">Source A</qti-simple-associable-choice>
        <qti-simple-associable-choice identifier="B" match-max="1">Source B</qti-simple-associable-choice>
      </qti-simple-match-set>
      <qti-simple-match-set>
        <qti-simple-associable-choice identifier="T1" match-max="1">Target 1</qti-simple-associable-choice>
        <qti-simple-associable-choice identifier="T2" match-max="1">Target 2</qti-simple-associable-choice>
      </qti-simple-match-set>
    </qti-match-interaction>
  </qti-item-body>
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

const MATCH_TABULAR_HEADER_HIDDEN_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="match-tabular-header-hidden" title="match-tabular-header-hidden" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-match-interaction response-identifier="RESPONSE" class="qti-match-tabular qti-header-hidden">
      <qti-simple-match-set>
        <qti-simple-associable-choice identifier="C" match-max="1">Capulet</qti-simple-associable-choice>
      </qti-simple-match-set>
      <qti-simple-match-set>
        <qti-simple-associable-choice identifier="R" match-max="1">Romeo and Juliet</qti-simple-associable-choice>
      </qti-simple-match-set>
    </qti-match-interaction>
  </qti-item-body>
</qti-assessment-item>
`.trim();

const GAP_CHOICES_POSITION_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="gap-choices-position" title="gap-choices-position" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-gap-match-interaction response-identifier="RESPONSE" class="qti-choices-left" data-choices-container-width="120">
      <qti-gap-text identifier="A" match-max="1">alpha</qti-gap-text>
      <qti-gap-text identifier="B" match-max="1">beta</qti-gap-text>
      <p>Place <qti-gap identifier="G1"/> before <qti-gap identifier="G2"/>.</p>
    </qti-gap-match-interaction>
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

const GRAPHIC_GAP_CHOICES_POSITION_ITEM = `
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="graphic-gap-choices-position" title="graphic-gap-choices-position" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-graphic-gap-match-interaction response-identifier="RESPONSE" class="qti-choices-bottom" data-choices-container-width="160">
      <object data="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='240'%20height='140'%20viewBox='0%200%20240%20140'%3E%3Crect%20width='240'%20height='140'%20fill='white'/%3E%3Ccircle%20cx='80'%20cy='70'%20r='18'%20fill='black'/%3E%3Ccircle%20cx='160'%20cy='70'%20r='18'%20fill='black'/%3E%3C/svg%3E" type="image/svg+xml" width="240" height="140"/>
      <qti-gap-text identifier="A" match-max="1">left label</qti-gap-text>
      <qti-gap-text identifier="B" match-max="1">right label</qti-gap-text>
      <qti-associable-hotspot identifier="G1" shape="circle" coords="80,70,20" match-max="1"/>
      <qti-associable-hotspot identifier="G2" shape="circle" coords="160,70,20" match-max="1"/>
    </qti-graphic-gap-match-interaction>
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

async function dropOrderChoiceOnTarget(
  layout: Locator,
  identifier: string,
  targetIndex: number,
): Promise<void> {
  await layout.evaluate(
    (element, payload) => {
      const target =
        element.querySelectorAll<HTMLElement>(".qti3-order-target-slot")[payload.targetIndex];
      if (!target) throw new Error(`Missing order target slot ${payload.targetIndex}.`);
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/plain", payload.identifier);
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

  test("renders block choice interactions as top-level sections", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "choice");

    const player = page.locator("qti-assessment-item-player");
    await expect(player.locator('[data-interaction-type="choice"]').first()).toBeVisible();
    await expect(player.locator("p .qti3-inlineChoice")).toHaveCount(0);
  });

  test("renders shared vocabulary choice orientation classes", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, CHOICE_ORIENTATION_ITEM);

    const horizontal = page.locator(
      'qti-assessment-item-player .qti3-choice[data-response-identifier="RESPONSE1"]',
    );
    const vertical = page.locator(
      'qti-assessment-item-player .qti3-choice[data-response-identifier="RESPONSE2"]',
    );
    await expect(horizontal).toHaveClass(/qti-orientation-horizontal/);
    await expect(vertical).toHaveClass(/qti-orientation-vertical/);

    const horizontalRects = await choiceOptionRects(horizontal);
    expect(horizontalRects).toHaveLength(3);
    expect(Math.abs(horizontalRects[1].y - horizontalRects[0].y)).toBeLessThanOrEqual(2);
    expect(Math.abs(horizontalRects[2].y - horizontalRects[0].y)).toBeLessThanOrEqual(2);
    expect(horizontalRects[1].x).toBeGreaterThan(horizontalRects[0].x);
    expect(horizontalRects[2].x).toBeGreaterThan(horizontalRects[1].x);

    const verticalRects = await choiceOptionRects(vertical);
    expect(verticalRects).toHaveLength(3);
    expect(verticalRects[1].y).toBeGreaterThan(verticalRects[0].y + verticalRects[0].height - 1);
    expect(verticalRects[2].y).toBeGreaterThan(verticalRects[1].y + verticalRects[1].height - 1);

    await horizontal.locator('input[value="ChoiceA"]').check();
    await vertical.locator('input[value="ChoiceB"]').check();
    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(state.responses.RESPONSE1).toBe("ChoiceA");
    expect(state.responses.RESPONSE2).toBe("ChoiceB");
  });

  test("renders shared vocabulary choice stacking order", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, CHOICE_STACKING_ITEM);

    const horizontal = page.locator(
      'qti-assessment-item-player .qti3-choice[data-response-identifier="HORIZONTAL"]',
    );
    const horizontalRects = await choiceOptionRects(horizontal);
    expect(horizontalRects.map((rect) => rect.identifier)).toEqual(["A", "B", "C", "D", "E"]);
    expect(Math.abs(horizontalRects[1].y - horizontalRects[0].y)).toBeLessThanOrEqual(2);
    expect(Math.abs(horizontalRects[2].y - horizontalRects[0].y)).toBeLessThanOrEqual(2);
    expect(horizontalRects[1].x).toBeGreaterThan(horizontalRects[0].x);
    expect(horizontalRects[2].x).toBeGreaterThan(horizontalRects[1].x);
    expect(horizontalRects[3].y).toBeGreaterThan(
      horizontalRects[0].y + horizontalRects[0].height - 1,
    );
    expect(Math.abs(horizontalRects[3].x - horizontalRects[0].x)).toBeLessThanOrEqual(2);

    const vertical = page.locator(
      'qti-assessment-item-player .qti3-choice[data-response-identifier="VERTICAL"]',
    );
    const verticalRects = await choiceOptionRects(vertical);
    expect(verticalRects.map((rect) => rect.identifier)).toEqual(["A", "B", "C", "D", "E"]);
    expect(verticalRects[1].y).toBeGreaterThan(verticalRects[0].y + verticalRects[0].height - 1);
    expect(Math.abs(verticalRects[1].x - verticalRects[0].x)).toBeLessThanOrEqual(2);
    expect(verticalRects[2].x).toBeGreaterThan(verticalRects[0].x);
    expect(Math.abs(verticalRects[2].y - verticalRects[0].y)).toBeLessThanOrEqual(2);
    expect(verticalRects[3].y).toBeGreaterThan(verticalRects[2].y + verticalRects[2].height - 1);
    expect(Math.abs(verticalRects[3].x - verticalRects[2].x)).toBeLessThanOrEqual(2);
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

  test("applies choice and hottext presentation shared vocabulary classes", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, CHOICE_PRESENTATION_SHARED_VOCABULARY_ITEM);

    const player = page.locator("qti-assessment-item-player");
    const choice = player.locator(".qti3-choice");
    await expect(choice).toHaveClass(/qti-input-control-hidden/);
    await expect(choice).toHaveClass(/qti-writing-orientation-vertical-rl/);
    await expect(choice.locator(".qti3-choice-list")).toHaveCSS("writing-mode", "vertical-rl");
    await expect(choice.locator(".qti3-choice-label").first()).toHaveText("一.");
    await expect(choice.locator(".qti3-choice-label").nth(1)).toHaveText("二.");

    const input = choice.locator('input[value="A"]');
    await expect(input).toHaveCSS("position", "absolute");
    await choice.locator('.qti3-choice-option[data-choice-identifier="A"]').click();
    await expect(input).toBeChecked();
    await expect
      .poll(async () => {
        const state = await player.evaluate((element) => element.serialize());
        return state.responses.CHOICE_RESPONSE;
      })
      .toBe("A");

    const hottext = player.locator(".qti3-hottext");
    await expect(hottext).toHaveClass(/qti-unselected-hidden/);
    const token = hottext.locator(".qti3-hottext-token");
    await expect(token).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
    await token.click();
    await expect(token).toHaveAttribute("data-selected", "true");
    await expect
      .poll(async () => {
        const state = await player.evaluate((element) => element.serialize());
        return state.responses.HOTTEXT_RESPONSE;
      })
      .toBe("A");
  });

  test("applies choice selection shared vocabulary classes without blocking keyboard selection", async ({
    page,
  }) => {
    await page.goto("/");
    await pasteXml(page, CHOICE_SELECTION_PRESENTATION_SHARED_VOCABULARY_ITEM);

    const player = page.locator("qti-assessment-item-player");
    const choice = player.locator(".qti3-choice");
    await expect(choice).toHaveClass(/qti-selections-dark/);
    await expect(choice).toHaveClass(/qti-unselected-hidden/);

    const firstOption = choice.locator('.qti3-choice-option[data-choice-identifier="A"]');
    const secondOption = choice.locator('.qti3-choice-option[data-choice-identifier="B"]');
    const firstHiddenStyles = await firstOption.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        borderTopColor: style.borderTopColor,
        backgroundColor: style.backgroundColor,
      };
    });
    expect(firstHiddenStyles.borderTopColor).toBe("rgba(0, 0, 0, 0)");
    expect(firstHiddenStyles.backgroundColor).toBe("rgba(0, 0, 0, 0)");

    await choice.locator('input[value="A"]').focus();
    await page.keyboard.press("Tab");
    await expect(choice.locator('input[value="B"]')).toBeFocused();
    await page.keyboard.press("Space");
    await expect(choice.locator('input[value="B"]')).toBeChecked();
    await expect(secondOption).toHaveAttribute("data-selected", "true");

    const selectedStyles = await secondOption.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        borderTopColor: style.borderTopColor,
        backgroundColor: style.backgroundColor,
        color: style.color,
      };
    });
    expect(selectedStyles.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(selectedStyles.color).not.toBe(selectedStyles.backgroundColor);
    await expect(firstOption).toHaveAttribute("data-selected", "false");
    await expect(firstOption).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
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
    await expect(layout).toHaveAttribute("data-qti-choices-position", "top");
    const bank = layout.locator(".qti3-order-choices-bank");
    await expect(bank.getByRole("button")).toHaveCount(3);
    const targets = layout.locator(".qti3-order-target-slot");
    await expect(targets).toHaveCount(3);
    await expect(targets.nth(0)).toContainText("1)");
    await expect(targets.nth(0)).toContainText("empty");

    await bank.getByRole("button", { name: "Second step" }).click();
    await expect.poll(() => currentResponse(page)).toEqual(["B"]);
    await bank.getByRole("button", { name: "First step" }).click();
    await expect.poll(() => currentResponse(page)).toEqual(["B", "A"]);
    await expect(bank.getByRole("button")).toHaveCount(1);

    await layout
      .locator('.qti3-order-target-item[data-choice-identifier="B"] [data-move-direction="down"]')
      .click();
    await expect.poll(() => currentResponse(page)).toEqual(["A", "B"]);
    await layout.getByRole("button", { name: "Remove Second step from order" }).click();
    await expect.poll(() => currentResponse(page)).toEqual(["A"]);
    await expect(bank.getByRole("button", { name: "Second step" })).toBeVisible();
  });

  test("does not misplace order shared vocabulary drops onto non-adjacent empty targets", async ({
    page,
  }) => {
    await page.goto("/");
    await pasteXml(page, ORDER_SHARED_VOCABULARY_ITEM);

    const layout = page.locator("qti-assessment-item-player .qti3-order-sv-layout");
    const bank = layout.locator(".qti3-order-choices-bank");
    const targets = layout.locator(".qti3-order-target-slot");

    await bank.getByRole("button", { name: "First step" }).click();
    await expect.poll(() => currentResponse(page)).toEqual(["A"]);

    await dropOrderChoiceOnTarget(layout, "C", 2);
    await expect.poll(() => currentResponse(page)).toEqual(["A"]);
    await expect(bank.getByRole("button", { name: "Third step" })).toBeVisible();
    await expect(targets.nth(1)).toContainText("empty");
    await expect(targets.nth(2)).toContainText("empty");

    await dropOrderChoiceOnTarget(layout, "C", 1);
    await expect.poll(() => currentResponse(page)).toEqual(["A", "C"]);
  });

  test("provides order shared vocabulary responses through the browser helper", async ({
    page,
  }) => {
    await page.goto("/");
    await pasteXml(page, ORDER_SHARED_VOCABULARY_ITEM);

    await provideResponse(page, "order", ["C", "A"]);
    await expect.poll(() => currentResponse(page)).toEqual(["C", "A"]);
    const layout = page.locator("qti-assessment-item-player .qti3-order-sv-layout");
    await expect(layout.locator(".qti3-order-choices-bank").getByRole("button")).toHaveCount(1);
    await expect(layout.locator('.qti3-order-target-item[data-choice-identifier="C"]')).toHaveCount(
      1,
    );
    await expect(layout.locator('.qti3-order-target-item[data-choice-identifier="A"]')).toHaveCount(
      1,
    );
  });

  test("positions match shared vocabulary choices beside targets", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, MATCH_CHOICES_POSITION_ITEM);

    const layout = page.locator("qti-assessment-item-player .qti3-match-selector");
    await expect(layout).toHaveAttribute("data-qti-choices-position", "right");
    const targetBox = await layout.locator(".qti3-match-target-bank").boundingBox();
    const bankBox = await layout.locator(".qti3-match-source-bank").boundingBox();
    if (!targetBox || !bankBox) throw new Error("Missing match shared vocabulary boxes.");
    expect(bankBox.x).toBeGreaterThan(targetBox.x);
  });

  test("renders match shared vocabulary tabular matrix", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, MATCH_TABULAR_SHARED_VOCABULARY_ITEM);

    const player = page.locator("qti-assessment-item-player");
    const table = player.locator(".qti3-match-table");
    await expect(table).toBeVisible();
    await expect(table.locator("thead th").first()).toHaveText("Characters");
    await expect(table.locator("thead th")).toContainText([
      "Characters",
      "A Midsummer Night's Dream",
      "Romeo and Juliet",
    ]);
    await expect(table.locator("tbody th")).toContainText(["Capulet", "Demetrius"]);
    await expect(table.locator(".qti3-match-table-cell")).toHaveCount(4);

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

  test("renders match shared vocabulary tabular matrix with hidden column headers", async ({
    page,
  }) => {
    await page.goto("/");
    await pasteXml(page, MATCH_TABULAR_HEADER_HIDDEN_ITEM);

    const table = page.locator("qti-assessment-item-player .qti3-match-table");
    await expect(table).toHaveClass(/qti-header-hidden/);
    await expect(table.locator("thead")).toHaveCount(0);
    await expect(table.locator("tbody th")).toHaveText("Capulet");
    const cell = table.locator(".qti3-match-table-cell");
    await expect(cell).toHaveAttribute("aria-label", "Capulet to Romeo and Juliet");
  });

  test("positions gap match shared vocabulary choices beside the passage", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, GAP_CHOICES_POSITION_ITEM);

    const layout = page.locator("qti-assessment-item-player .qti3-gap-match-layout");
    await expect(layout).not.toHaveClass(/qti3-gap-placement/);
    await expect(layout).toHaveAttribute("data-qti-choices-position", "left");
    const bankBox = await layout.locator(".qti3-gap-source-region").boundingBox();
    const passageBox = await layout.locator(".qti3-gap-passage").boundingBox();
    if (!bankBox || !passageBox) throw new Error("Missing gap match shared vocabulary boxes.");
    expect(bankBox.x).toBeLessThan(passageBox.x);
    expect(bankBox.width).toBeLessThanOrEqual(122);
  });

  test("preserves gap placement vocabulary and applies gap input widths", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, GAP_PLACEMENT_WIDTH_ITEM);

    const player = page.locator("qti-assessment-item-player");
    const section = player.locator(".qti3-gapMatch");
    const layout = player.locator(".qti3-gap-match-layout");
    const passage = player.locator(".qti3-gap-passage");
    await expect(section).toHaveClass(/qti-gap-placement/);
    await expect(layout).toHaveClass(/qti3-gap-placement/);
    await expect(passage).toHaveClass(/qti3-gap-placement/);

    const narrowGap = player.locator('[data-gap-identifier="G1"]');
    const wideGap = player.locator('[data-gap-identifier="G2"]');
    await expect(narrowGap).toHaveAttribute("data-qti-gap-input-width", "3");
    await expect(wideGap).toHaveAttribute("data-qti-gap-input-width", "10");
    const narrowBox = await narrowGap.locator("button").boundingBox();
    const wideBox = await wideGap.locator("button").boundingBox();
    if (!narrowBox || !wideBox) throw new Error("Missing gap width boxes.");
    expect(wideBox.width).toBeGreaterThan(narrowBox.width);

    const placementUnderline = await narrowGap
      .locator("button")
      .evaluate((button) => Number.parseFloat(getComputedStyle(button).borderBottomWidth));
    expect(placementUnderline).toBeGreaterThan(0);

    await assignGap(page, "Gap match", "A", "G2");
    await expect(currentResponse(page)).resolves.toEqual(["A G2"]);
    await wideGap.locator("button").focus();
    await page.keyboard.press("Delete");
    await expect(currentResponse(page)).resolves.toEqual([]);

    await page.setViewportSize({ width: 360, height: 640 });
    const overflow = await player.evaluate((element) => element.scrollWidth > element.clientWidth);
    expect(overflow).toBe(false);
  });

  test("positions graphic gap match shared vocabulary choices below the image", async ({
    page,
  }) => {
    await page.goto("/");
    await pasteXml(page, GRAPHIC_GAP_CHOICES_POSITION_ITEM);

    const layout = page.locator("qti-assessment-item-player .qti3-graphic-gap-layout");
    await expect(layout).toHaveAttribute("data-qti-choices-position", "bottom");
    const surfaceBox = await layout.locator(".qti3-graphic-gap-match-surface").boundingBox();
    const bankBox = await layout.locator(".qti3-graphic-gap-source-region").boundingBox();
    if (!surfaceBox || !bankBox) throw new Error("Missing graphic gap shared vocabulary boxes.");
    expect(bankBox.y).toBeGreaterThan(surfaceBox.y);
    expect(bankBox.width).toBeLessThanOrEqual(162);
  });

  test("positions order shared vocabulary choices beside vertical targets", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, ORDER_SHARED_VOCABULARY_LEFT_ITEM);

    const layout = page.locator("qti-assessment-item-player .qti3-order-sv-layout");
    await expect(layout).toHaveAttribute("data-qti-choices-position", "left");
    await expect(layout).toHaveAttribute("data-qti-order-orientation", "vertical");
    const bank = layout.locator(".qti3-order-choices-bank");
    await expect(bank).toHaveCSS("flex-direction", "column");
    const bankBox = await bank.boundingBox();
    const targetBox = await layout.locator(".qti3-order-target-list").boundingBox();
    if (!bankBox || !targetBox) throw new Error("Missing order shared vocabulary layout boxes.");
    expect(bankBox.x).toBeLessThan(targetBox.x);
    await expect(layout.locator(".qti3-order-target-label").first()).toHaveText("A.");
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
