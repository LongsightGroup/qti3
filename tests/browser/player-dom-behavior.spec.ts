import { expect, test, type Locator } from "@playwright/test";
import {
  currentResponse,
  expectMoveButtons,
  loadFixture,
  pasteXml,
  provideResponse,
  visibleValidationAlertCount,
} from "./player-helpers.js";
import {
  CHOICE_PRESENTATION_SHARED_VOCABULARY_ITEM,
  CHOICE_STACKING_GEOMETRY_ITEM,
  CHOICE_STACKING_ITEM,
  DEPRECATED_CHOICE_ORIENTATION_ITEM,
  EMPTY_CHOICE_ITEM,
  HORIZONTAL_CHOICE_ITEM,
  HORIZONTAL_ORDER_ATTRIBUTE_ITEM,
  ITEM_LAYOUT_SHARED_VOCABULARY_ITEM,
  MATCH_TABULAR_SHARED_VOCABULARY_ITEM,
  ORDER_SHARED_VOCABULARY_ITEM,
  UNSUPPORTED_INTERACTION_ITEM,
} from "./fixtures/dom-behavior-items.js";
import { RICH_ORDER_CONTENT_ITEM } from "./fixtures/rich-order.js";
import {
  CHOICE_LAYOUT_TOLERANCE_PX,
  choiceOptionRects,
  choiceRectsByIdentifier,
  expectChoiceGridLayout,
} from "./choice-layout-helpers.js";

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

  test("renders unsupported inline custom interactions without embed errors", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="inline-custom" title="inline-custom" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <p>Inline custom <qti-custom-interaction response-identifier="RESPONSE"/></p>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const player = page.locator("qti-assessment-item-player");
    await expect(player.locator(".qti3-embedded-interaction-unsupported")).toHaveCount(0);
    const alert = player.locator("p > .qti3-unsupported-interaction");
    await expect(alert).toHaveAttribute("role", "alert");
    await expect(alert).toContainText(
      'Interaction "qti-custom-interaction" (RESPONSE) is deprecated and is not supported by this player.',
    );
  });

  test("renders upload interactions as file inputs", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "upload");

    const input = page.locator("qti-assessment-item-player input.qti3-upload-input");
    await expect(input).toHaveAttribute("type", "file");
    await expect(input).toBeVisible();
  });

  test("keeps a native range control under the custom slider presentation", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "slider");

    const player = page.locator("qti-assessment-item-player");
    await expect(player.locator('input[type="range"]')).toHaveCount(1);
    await expect(player.locator(".qti3-slider-visual")).toHaveCount(1);
    await expect(player.locator(".qti3-slider-response")).toHaveAttribute(
      "data-response-state",
      "unset",
    );
  });

  test("renders end-attempt controls with authored labels", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "endAttempt");

    const button = page.locator("qti-assessment-item-player button.qti3-end-attempt-button");
    await expect(button).toBeVisible();
    await expect(button).toHaveText("Show planning hint");
  });

  test("renders end-attempt controls embedded in feedback paragraph flow", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="feedback-end-attempt" title="feedback-end-attempt" adaptive="true" time-dependent="false">
  <qti-response-declaration identifier="SOLREQUEST" cardinality="single" base-type="boolean"/>
  <qti-outcome-declaration identifier="FEEDBACK" cardinality="multiple" base-type="identifier"/>
  <qti-outcome-declaration identifier="ASKSOLUTION" cardinality="single" base-type="identifier">
    <qti-default-value><qti-value>asksolution</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-item-body>
    <qti-feedback-block identifier="asksolution" outcome-identifier="ASKSOLUTION" show-hide="show">
      <qti-content-body>
        <p><qti-end-attempt-interaction response-identifier="SOLREQUEST" title="Show Solution"/></p>
      </qti-content-body>
    </qti-feedback-block>
  </qti-item-body>
  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-variable identifier="SOLREQUEST"/>
        <qti-set-outcome-value identifier="FEEDBACK">
          <qti-multiple><qti-base-value base-type="identifier">SOLUTION</qti-base-value></qti-multiple>
        </qti-set-outcome-value>
      </qti-response-if>
    </qti-response-condition>
  </qti-response-processing>
</qti-assessment-item>`,
    );

    const player = page.locator("qti-assessment-item-player");
    await expect(player.locator(".qti3-embedded-interaction-unsupported")).toHaveCount(0);
    const button = player.locator(
      '.qti3-feedback-block p > .qti3-embedded-interaction[data-interaction-type="endAttempt"] > button.qti3-end-attempt-button',
    );
    await expect(button).toBeVisible();
    await expect(button).toHaveText("Show Solution");

    await button.click();
    const state = await player.evaluate((element) => element.serialize());
    expect(state.responses.SOLREQUEST).toBe(true);
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

  test("renders plain order rows with a single visible row boundary", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "order");

    const player = page.locator("qti-assessment-item-player");
    const firstItem = player.locator(".qti3-reorder-item").first();
    const firstHandle = firstItem.locator(".qti3-reorder-handle");

    await expect(firstItem).toHaveCSS("border-top-width", "0px");
    await expect(firstHandle).toHaveCSS("border-top-width", "1px");
    await expect(firstHandle).toHaveCSS("border-top-style", "solid");
  });

  test("renders rich order choice content without leaking XML comments", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, RICH_ORDER_CONTENT_ITEM);

    const handle = page.locator(
      'qti-assessment-item-player .qti3-reorder-handle[data-choice-identifier="BenNevis"]',
    );
    await expect(handle).toBeVisible();
    await expect(handle).not.toHaveAttribute("role", "button");
    await expect(handle).not.toHaveJSProperty("tagName", "BUTTON");
    await expect(handle.locator(".c1 .c2")).toHaveText("Ben Nevis");
    await expect(handle.locator(".c3 strong").first()).toHaveText("User:");
    await expect(handle.locator('a[href="https://example.test/photos/ben-nevis"]')).toHaveText(
      "View Photo",
    );
    await expect(handle.locator('img[alt="Ben Nevis"]')).toBeVisible();
    await expect(handle.locator("a").first()).toHaveAttribute("draggable", "false");
    await expect(handle.locator("img").first()).toHaveAttribute("draggable", "false");
    await expect(handle).not.toContainText("Hidden Flickr markup");
    await expect(handle).not.toContainText("<!--");
    await expect(handle).toHaveAttribute("aria-label", /Ben Nevis User: euphbass/);

    const orderItems = page.locator("qti-assessment-item-player .qti3-reorder-item");
    await expect(orderItems.nth(0)).toHaveAttribute("data-choice-identifier", "BenNevis");
    await expect(orderItems.nth(1)).toHaveAttribute("data-choice-identifier", "BenMacdui");

    const linkBox = await handle.locator("a.c5a").boundingBox();
    const secondItemBox = await orderItems.nth(1).boundingBox();
    if (!linkBox || !secondItemBox) throw new Error("Missing rich order pointer targets.");
    await page.mouse.move(linkBox.x + linkBox.width / 2, linkBox.y + linkBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      secondItemBox.x + secondItemBox.width / 2,
      secondItemBox.y + secondItemBox.height / 2,
    );
    await page.mouse.up();

    await expect(orderItems.nth(0)).toHaveAttribute("data-choice-identifier", "BenNevis");
    await expect(orderItems.nth(1)).toHaveAttribute("data-choice-identifier", "BenMacdui");
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

  test("renders N-column choice grid layout for stacking classes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await pasteXml(page, CHOICE_STACKING_GEOMETRY_ITEM);

    const cases = [
      {
        responseIdentifier: "STACKING_FIVE",
        expectedOrder: ["A", "B", "C", "D", "E", "F"],
        rows: [["A", "B", "C", "D", "E"], ["F"]],
      },
      {
        responseIdentifier: "STACKING_FOUR",
        expectedOrder: ["A", "B", "C", "D", "E", "F"],
        rows: [
          ["A", "B", "C", "D"],
          ["E", "F"],
        ],
      },
      {
        responseIdentifier: "VERTICAL",
        expectedOrder: ["A", "B", "C", "D", "E"],
        rows: [
          ["A", "C", "E"],
          ["B", "D"],
        ],
      },
    ] as const;

    for (const { responseIdentifier, expectedOrder, rows } of cases) {
      const interaction = page.locator(
        `qti-assessment-item-player .qti3-choice[data-response-identifier="${responseIdentifier}"]`,
      );
      const byId = choiceRectsByIdentifier(await choiceOptionRects(interaction), expectedOrder);
      expectChoiceGridLayout(byId, rows);
    }
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
        expect(Math.abs(rect.x - rects[0]!.x)).toBeLessThanOrEqual(CHOICE_LAYOUT_TOLERANCE_PX);
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
    expect(Math.abs(rects[1].y - rects[0].y)).toBeLessThanOrEqual(CHOICE_LAYOUT_TOLERANCE_PX);
    expect(Math.abs(rects[2].y - rects[0].y)).toBeLessThanOrEqual(CHOICE_LAYOUT_TOLERANCE_PX);
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
    const targetHeaderWidths = await table
      .locator("thead th:not(:first-child)")
      .evaluateAll((headers) => headers.map((header) => header.getBoundingClientRect().width));
    expect(Math.abs((targetHeaderWidths[0] ?? 0) - (targetHeaderWidths[1] ?? 0))).toBeLessThan(1);

    const capuletRomeo = table.locator(
      '.qti3-match-table-cell[data-source-identifier="C"][data-target-identifier="R"]',
    );
    await capuletRomeo.click();
    await expect(capuletRomeo).toHaveAttribute("aria-pressed", "true");
    await expect(capuletRomeo.locator(".qti3-match-table-check-icon")).toHaveCount(1);
    await expect.poll(() => currentResponse(page)).toEqual(["C R"]);
    await expect(player.locator(".qti3-pair-chip")).toHaveCount(0);
    await expect(player.locator(".qti3-selection-summary")).toContainText("1 association made.");

    await capuletRomeo.click();
    await expect(capuletRomeo).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => currentResponse(page)).toEqual([]);

    await capuletRomeo.click();
    await expect(capuletRomeo).toHaveAttribute("aria-pressed", "true");
    await capuletRomeo.click();
    await expect.poll(() => currentResponse(page)).toEqual([]);
    await expect(capuletRomeo).toHaveAttribute("aria-pressed", "false");

    const capuletMidsummer = table.locator(
      '.qti3-match-table-cell[data-source-identifier="C"][data-target-identifier="M"]',
    );
    await capuletRomeo.click();
    await expect.poll(() => currentResponse(page)).toEqual(["C R"]);
    await capuletMidsummer.click();
    await expect.poll(() => currentResponse(page)).toEqual(["C M"]);
    await expect(capuletRomeo).toHaveAttribute("aria-pressed", "false");
    await expect(capuletMidsummer).toHaveAttribute("aria-pressed", "true");
    await expect(player.locator(".qti3-selection-summary")).toContainText("1 association made.");
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

    await expect(textarea).toHaveAttribute("placeholder", "Example: 7.25");
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
    await expect(patternMessage).toHaveText("Use no more than 6 digits or decimal points");
    await expect(textarea).toHaveAttribute("aria-invalid", "true");
    await expect(
      textarea.evaluate((control) => (control as HTMLTextAreaElement).validationMessage),
    ).resolves.toBe("Use no more than 6 digits or decimal points");
    await expect(currentResponse(page)).resolves.toBe("abcdef");

    await textarea.fill("12.34");

    await expect(patternMessage).toBeHidden();
    await expect(textarea).not.toHaveAttribute("aria-invalid", "true");
    await expect(
      textarea.evaluate((control) => (control as HTMLTextAreaElement).checkValidity()),
    ).resolves.toBe(true);
  });

  test("ignores non-conformant camelCase extended text patternMask attributes", async ({
    page,
  }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" adaptive="false" identifier="qti3-extended-text-03" time-dependent="false" title="Writing a Postcard 3 - Extended Text - qti3">
  <qti-response-declaration base-type="string" cardinality="single" identifier="RESPONSE"/>
  <qti-outcome-declaration base-type="float" cardinality="single" identifier="SCORE"/>
  <qti-item-body>
    <qti-extended-text-interaction
      class="qti-height-lines-3"
      patternMask="[0-9\\.]+"
      data-patternmask-message="Maximum of 6 digits or a decimal point permitted"
      format="plain"
      expected-length="6"
      response-identifier="RESPONSE"
    />
  </qti-item-body>
</qti-assessment-item>`,
    );

    const textarea = page.locator("qti-assessment-item-player textarea");
    const patternMessage = page.locator("qti-assessment-item-player .qti3-pattern-mask-message");
    await textarea.pressSequentially("abc");
    await expect(textarea).toHaveValue("abc");
    await expect(currentResponse(page)).resolves.toBe("abc");
    await expect(patternMessage).toHaveCount(0);
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

  test("omits unsafe interaction URLs, emits diagnostics, and keeps the item usable", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator("qti-assessment-item-player").evaluate((element) => {
      const player = element as HTMLElement & { unsafeDiagnosticCodes?: string[] };
      player.unsafeDiagnosticCodes = [];
      player.addEventListener("qti-diagnostics", (event) => {
        const detail = (event as CustomEvent<{ diagnostics: Array<{ code: string }> }>).detail;
        player.unsafeDiagnosticCodes?.push(...detail.diagnostics.map((entry) => entry.code));
      });
    });
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="unsafe-interaction-url" title="unsafe-interaction-url" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-response-declaration identifier="MEDIA" cardinality="single" base-type="integer"/>
  <qti-item-body>
    <qti-media-interaction response-identifier="MEDIA">
      <qti-prompt>Optional illustration</qti-prompt>
      <object data="//attacker.example/illustration.png" type="image/png">Illustration unavailable</object>
    </qti-media-interaction>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-prompt>Choose an answer.</qti-prompt>
      <qti-simple-choice identifier="A">Answer A</qti-simple-choice>
      <qti-simple-choice identifier="B">Answer B</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    await expect(page.locator('qti-assessment-item-player [src*="attacker.example"]')).toHaveCount(
      0,
    );
    await expect(page.locator('qti-assessment-item-player [href*="attacker.example"]')).toHaveCount(
      0,
    );
    const playerState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      const player = element as HTMLElement & {
        serialize: () => { validationMessages: Array<{ code: string }> };
        unsafeDiagnosticCodes?: string[];
      };
      return {
        emittedCodes: player.unsafeDiagnosticCodes,
        validationCodes: player.serialize().validationMessages.map((entry) => entry.code),
      };
    });
    expect(playerState.emittedCodes).toContain("interaction.asset.url.unsafe");
    expect(playerState.validationCodes).toContain("interaction.asset.url.unsafe");

    await provideResponse(page, "choice", "A");
    expect(await currentResponse(page)).toBe("A");
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
