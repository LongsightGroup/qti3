import { expect, test } from "@playwright/test";
import {
  FITTING_GAP_IMG_GRAPHIC_GAP_MATCH_ITEM,
  GRAPHIC_GAP_SELECTION_THEMES_ITEM,
  GRAPHIC_GAP_UNSELECTED_HIDDEN_ITEM,
  svgBase64DataUrl,
} from "./player-graphic-gap-fixtures.js";
import {
  dragCenter,
  expectImageLoaded,
  expectResponse,
  loadFixture,
  pasteXml,
} from "./player-helpers.js";

test.describe("player graphic gap match interactions", () => {
  test("assigns graphic gap match choices with pointer drag and removal", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "graphicGapMatch");

    await expect(
      page.locator("qti-assessment-item-player .qti3-graphic-context img"),
    ).toHaveAttribute("src", /hotspot-flow-unlabeled\.svg$/);
    await expectImageLoaded(page.locator("qti-assessment-item-player .qti3-graphic-context img"));
    await expect(page.locator("qti-assessment-item-player .qti3-gap-region")).toBeVisible();
    await expect(
      page.locator("qti-assessment-item-player .qti3-gap-button").first(),
    ).toHaveAccessibleName("Gap 1, empty");
    await expect(page.locator("qti-assessment-item-player .qti3-gap-button").first()).toHaveText(
      "",
    );
    await expect(page.locator("qti-assessment-item-player .qti3-gap-region")).not.toContainText(
      "Empty",
    );
    await expect(page.locator("qti-assessment-item-player .qti3-gap-region")).not.toContainText(
      "G1",
    );
    const gapRowSpacing = await page
      .locator("qti-assessment-item-player .qti3-gap-region")
      .evaluate((gapRegion) => {
        const sourceRegion = gapRegion.previousElementSibling;
        if (!sourceRegion) return 0;
        return gapRegion.getBoundingClientRect().top - sourceRegion.getBoundingClientRect().bottom;
      });
    expect(gapRowSpacing).toBeGreaterThanOrEqual(6);

    const source = page.locator('qti-assessment-item-player [data-choice-identifier="A"]').first();
    const target = page.locator('qti-assessment-item-player [data-gap-identifier="G1"]').first();
    await dragCenter(page, source, target);
    await expectResponse(page, ["A G1"]);
    await expect(
      target.getByRole("button", { name: "Gap 1, assigned response declaration" }),
    ).toHaveText("response declaration");

    await target.getByRole("button", { name: "Gap 1, assigned response declaration" }).focus();
    await page.keyboard.press("Delete");
    await expectResponse(page, []);
  });

  test("renders hotspot-backed graphic gap match targets on the image", async ({ page }) => {
    await page.goto("/");
    const timelineSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="260" viewBox="0 0 480 260"><rect width="480" height="260" fill="#f4f2ea"/><line x1="80" y1="130" x2="400" y2="130" stroke="#b08d57" stroke-width="6"/><circle cx="120" cy="130" r="18" fill="#2f4858"/><circle cx="240" cy="130" r="18" fill="#2f4858"/><circle cx="360" cy="130" r="18" fill="#2f4858"/></svg>`;
    const image = svgBase64DataUrl(timelineSvg);
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="hotspot-backed-graphic-gap-match" title="hotspot-backed-graphic-gap-match" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair">
    <qti-correct-response><qti-value>A T1</qti-value><qti-value>B T2</qti-value><qti-value>C T3</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-item-body>
    <qti-graphic-gap-match-interaction response-identifier="RESPONSE" data-choices-container-width="360" min-associations="3" max-associations="3">
      <qti-prompt>Drag each name to the correct circle.</qti-prompt>
      <object data="${image}" alt="Timeline graphic with three presidential eras marked." type="image/png"/>
      <qti-gap-text identifier="A" match-max="1">George Washington</qti-gap-text>
      <qti-gap-text identifier="B" match-max="1">Abraham Lincoln</qti-gap-text>
      <qti-gap-text identifier="C" match-max="1">Franklin D. Roosevelt</qti-gap-text>
      <qti-associable-hotspot identifier="T1" shape="circle" coords="120,130,22" match-max="1"/>
      <qti-associable-hotspot identifier="T2" shape="circle" coords="240,130,22" match-max="1"/>
      <qti-associable-hotspot identifier="T3" shape="circle" coords="360,130,22" match-max="1"/>
    </qti-graphic-gap-match-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const surface = page.locator("qti-assessment-item-player .qti3-graphic-gap-match-surface");
    const sourceRegion = page.locator("qti-assessment-item-player .qti3-graphic-gap-source-region");
    await expect(surface.locator("img")).toHaveAttribute("src", /^data:image\/svg\+xml;base64,/);
    await expect(surface.locator("img")).toHaveAccessibleName(
      "Timeline graphic with three presidential eras marked.",
    );
    const box = await surface.boundingBox();
    expect(box?.width).toBe(480);
    expect(box?.height).toBe(260);
    await expect(sourceRegion).toContainText("George Washington");
    await expect(sourceRegion).not.toContainText("T1");
    await expect(sourceRegion).not.toContainText("T2");
    await expect(sourceRegion).not.toContainText("T3");

    const source = sourceRegion.getByRole("button", { name: "Abraham Lincoln" });
    const target = surface.locator('[data-gap-identifier="T2"]');
    await expect(target).toHaveCSS("position", "absolute");
    await expect(target).toHaveAccessibleName("Target 2, empty");
    await expect(target).toHaveText("");
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    if (!box) throw new Error("Missing hotspot graphic gap surface box.");
    if (!sourceBox || !targetBox) throw new Error("Missing hotspot graphic gap drag boxes.");
    expect(Math.round(targetBox.x - box.x)).toBe(218);
    expect(Math.round(targetBox.y - box.y)).toBe(108);

    await source.click();
    await target.click();

    await expectResponse(page, ["B T2"]);
    await expect(target).toHaveAccessibleName("Target 2, assigned Abraham Lincoln");
    await expect(
      surface.locator('[data-origin-gap-identifier="T2"].qti3-graphic-gap-label'),
    ).toContainText("Abraham Lincoln");
  });

  test("snaps fitting qti-gap-img choices into rectangular graphic gap targets", async ({
    page,
  }) => {
    await page.goto("/");
    await pasteXml(page, FITTING_GAP_IMG_GRAPHIC_GAP_MATCH_ITEM);

    const source = page
      .locator("qti-assessment-item-player .qti3-graphic-gap-source-region")
      .getByRole("button", { name: "Civil War marker" });
    const sourceButton = page.locator(
      'qti-assessment-item-player .qti3-graphic-gap-source-region button[data-choice-identifier="DraggerA"]',
    );
    await expectImageLoaded(source.locator("img"));
    await expect(sourceButton).toBeVisible();

    const target = page.locator('qti-assessment-item-player [data-gap-identifier="A"]');
    await dragCenter(page, source, target);

    await expectResponse(page, ["DraggerA A"]);
    await expect(target).toHaveAccessibleName("Target 1, assigned Civil War marker");
    await expect(sourceButton).toBeHidden();

    const label = page.locator('[data-origin-gap-identifier="A"].qti3-graphic-gap-label');
    await expect(label).toHaveClass(/qti3-graphic-gap-label-in-slot/);
    const targetBox = await target.boundingBox();
    const imageBox = await label.locator("img").boundingBox();
    if (!targetBox || !imageBox) throw new Error("Missing snapped image layout boxes.");
    expect(imageBox.x).toBeGreaterThanOrEqual(targetBox.x - 1);
    expect(imageBox.y).toBeGreaterThanOrEqual(targetBox.y - 1);
    expect(imageBox.x + imageBox.width).toBeLessThanOrEqual(targetBox.x + targetBox.width + 1);
    expect(imageBox.y + imageBox.height).toBeLessThanOrEqual(targetBox.y + targetBox.height + 1);
  });

  test("lets users drag in-slot graphic gap assignments from the hotspot target", async ({
    page,
  }) => {
    await page.goto("/");
    await pasteXml(page, FITTING_GAP_IMG_GRAPHIC_GAP_MATCH_ITEM);

    const bank = page.locator("qti-assessment-item-player .qti3-graphic-gap-source-region");
    const source = bank.getByRole("button", { name: "Civil War marker" });
    const sourceButton = bank.locator('button[data-choice-identifier="DraggerA"]');
    const target = page.locator('qti-assessment-item-player [data-gap-identifier="A"]');

    await dragCenter(page, source, target);
    await expectResponse(page, ["DraggerA A"]);
    await expect(sourceButton).toBeHidden();
    const emptyBankBox = await bank.boundingBox();
    expect(emptyBankBox?.height).toBeGreaterThan(0);
    await expect(
      page.locator('[data-origin-gap-identifier="A"].qti3-graphic-gap-label'),
    ).toHaveClass(/qti3-graphic-gap-label-in-slot/);

    await dragCenter(page, target, bank);
    await expectResponse(page, []);
    await expect(target).toHaveAccessibleName("Target 1, empty");
    await expect(sourceButton).toBeVisible();
  });

  test("renders oversized qti-gap-img choices below graphic gap targets", async ({ page }) => {
    await page.goto("/");
    const timelineSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120" viewBox="0 0 180 120"><rect width="180" height="120" fill="#f4f2ea"/><rect x="54" y="34" width="72" height="52" fill="#2f4858"/></svg>`;
    const choiceSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="78" height="63" viewBox="0 0 78 63"><rect width="78" height="63" rx="4" fill="#fff"/><path d="M12 42h54" stroke="#2f4858" stroke-width="6"/><text x="39" y="29" text-anchor="middle" font-size="18" font-family="sans-serif" fill="#2f4858">A</text></svg>`;

    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="gap-img-graphic-gap-match" title="gap-img-graphic-gap-match" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-graphic-gap-match-interaction response-identifier="RESPONSE">
      <object data="${svgBase64DataUrl(timelineSvg)}" alt="Timeline target." type="image/png"/>
      <qti-gap-img identifier="DraggerA" match-max="1">
        <img alt="Civil War marker" height="63" src="${svgBase64DataUrl(choiceSvg)}" width="78"/>
      </qti-gap-img>
      <qti-associable-hotspot identifier="A" shape="rect" coords="54,34,126,86" match-max="1"/>
    </qti-graphic-gap-match-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const source = page
      .locator("qti-assessment-item-player .qti3-graphic-gap-source-region")
      .getByRole("button", { name: "Civil War marker" });
    const sourceButton = page.locator(
      'qti-assessment-item-player .qti3-graphic-gap-source-region button[data-choice-identifier="DraggerA"]',
    );
    await expect(source.locator("img")).toHaveAttribute("src", /^data:image\/svg\+xml;base64,/);
    await expectImageLoaded(source.locator("img"));
    await expect(sourceButton).toBeVisible();

    const target = page.locator('qti-assessment-item-player [data-gap-identifier="A"]');
    await dragCenter(page, source, target);

    await expectResponse(page, ["DraggerA A"]);
    await expect(target).toHaveAccessibleName("Target 1, assigned Civil War marker");
    await expect(sourceButton).toBeHidden();
    const label = page.locator('[data-origin-gap-identifier="A"].qti3-graphic-gap-label');
    await expect(label).not.toHaveClass(/qti3-graphic-gap-label-in-slot/);
    await expect(label.locator("img")).toHaveAttribute("src", /^data:image\/svg\+xml;base64,/);
    const labelBox = await label.boundingBox();
    const placedTargetBox = await target.boundingBox();
    if (!labelBox || !placedTargetBox) throw new Error("Missing oversized label layout boxes.");
    expect(labelBox.y).toBeGreaterThanOrEqual(placedTargetBox.y + placedTargetBox.height - 1);
  });

  test("lets mouse users clear and overwrite qti-gap-img graphic gap match placements", async ({
    page,
  }) => {
    await page.goto("/");
    const targetSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="160" viewBox="0 0 300 160"><rect width="300" height="160" fill="#f4f2ea"/><rect x="36" y="44" width="92" height="64" rx="6" fill="#2f4858"/><rect x="172" y="44" width="92" height="64" rx="6" fill="#8b5d33"/></svg>`;
    const choiceASvg = `<svg xmlns="http://www.w3.org/2000/svg" width="78" height="63" viewBox="0 0 78 63"><rect width="78" height="63" rx="4" fill="#fff" stroke="#2f4858" stroke-width="3"/><text x="39" y="38" text-anchor="middle" font-size="18" font-family="sans-serif" fill="#2f4858">A</text></svg>`;
    const choiceBSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="78" height="63" viewBox="0 0 78 63"><rect width="78" height="63" rx="4" fill="#fff" stroke="#8b5d33" stroke-width="3"/><text x="39" y="38" text-anchor="middle" font-size="18" font-family="sans-serif" fill="#8b5d33">B</text></svg>`;

    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="clear-overwrite-gap-img-graphic-gap-match" title="clear-overwrite-gap-img-graphic-gap-match" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-graphic-gap-match-interaction response-identifier="RESPONSE">
      <object data="${svgBase64DataUrl(targetSvg)}" alt="Diagram with two highlighted targets." type="image/svg+xml"/>
      <qti-gap-img identifier="DraggerA" match-max="1">
        <img alt="Civil War marker" height="63" src="${svgBase64DataUrl(choiceASvg)}" width="78"/>
      </qti-gap-img>
      <qti-gap-img identifier="DraggerB" match-max="1">
        <img alt="Reconstruction marker" height="63" src="${svgBase64DataUrl(choiceBSvg)}" width="78"/>
      </qti-gap-img>
      <qti-associable-hotspot identifier="TargetA" shape="rect" coords="36,44,128,108" match-max="1"/>
      <qti-associable-hotspot identifier="TargetB" shape="rect" coords="172,44,264,108" match-max="1"/>
    </qti-graphic-gap-match-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const bank = page.locator("qti-assessment-item-player .qti3-graphic-gap-source-region");
    const sourceA = bank.getByRole("button", { name: "Civil War marker" });
    const sourceB = bank.getByRole("button", { name: "Reconstruction marker" });
    const sourceAButton = bank.locator('button[data-choice-identifier="DraggerA"]');
    const sourceBButton = bank.locator('button[data-choice-identifier="DraggerB"]');
    const targetA = page.locator('qti-assessment-item-player [data-gap-identifier="TargetA"]');
    const targetB = page.locator('qti-assessment-item-player [data-gap-identifier="TargetB"]');

    await dragCenter(page, sourceA, targetB);
    await expectResponse(page, ["DraggerA TargetB"]);
    await expect(sourceAButton).toBeHidden();
    await expect(sourceBButton).toBeVisible();

    await targetB.click();
    await expectResponse(page, ["DraggerA TargetB"]);

    await dragCenter(page, page.locator('[data-origin-gap-identifier="TargetB"]'), bank);
    await expectResponse(page, []);
    await expect(targetB).toHaveAccessibleName("Target 2, empty");
    await expect(sourceAButton).toBeVisible();

    await dragCenter(page, sourceA, targetA);
    await expectResponse(page, ["DraggerA TargetA"]);
    await expect(sourceAButton).toBeHidden();

    await dragCenter(page, sourceB, targetA);
    await expectResponse(page, ["DraggerB TargetA"]);
    await expect(targetA).toHaveAccessibleName("Target 1, assigned Reconstruction marker");
    await expect(sourceAButton).toBeVisible();
    await expect(sourceBButton).toBeHidden();
  });

  test("rejects graphic gap match placements beyond authored max-associations", async ({
    page,
  }) => {
    await page.goto("/");
    const targetSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="330" height="140" viewBox="0 0 330 140"><rect width="330" height="140" fill="#f4f2ea"/><rect x="30" y="42" width="70" height="44" fill="#2f4858"/><rect x="130" y="42" width="70" height="44" fill="#8b5d33"/><rect x="230" y="42" width="70" height="44" fill="#496b42"/></svg>`;

    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="graphic-gap-authored-max" title="graphic-gap-authored-max" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair">
    <qti-correct-response><qti-value>A T1</qti-value><qti-value>B T2</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-item-body>
    <qti-graphic-gap-match-interaction response-identifier="RESPONSE" max-associations="2" data-max-selections-message="You've selected too many!">
      <object data="${svgBase64DataUrl(targetSvg)}" alt="Three target slots." type="image/svg+xml"/>
      <qti-gap-text identifier="A" match-max="1">Alpha</qti-gap-text>
      <qti-gap-text identifier="B" match-max="1">Beta</qti-gap-text>
      <qti-gap-text identifier="C" match-max="1">Gamma</qti-gap-text>
      <qti-associable-hotspot identifier="T1" shape="rect" coords="30,42,100,86" match-max="1"/>
      <qti-associable-hotspot identifier="T2" shape="rect" coords="130,42,200,86" match-max="1"/>
      <qti-associable-hotspot identifier="T3" shape="rect" coords="230,42,300,86" match-max="1"/>
    </qti-graphic-gap-match-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const interaction = page.locator("qti-assessment-item-player .qti3-graphicGapMatch");
    const bank = interaction.locator(".qti3-graphic-gap-source-region");
    const sourceA = bank.getByRole("button", { name: "Alpha" });
    const sourceB = bank.getByRole("button", { name: "Beta" });
    const sourceC = bank.getByRole("button", { name: "Gamma" });
    const sourceBButton = bank.locator('button[data-choice-identifier="B"]');
    const sourceCButton = bank.locator('button[data-choice-identifier="C"]');
    const target1 = interaction.locator('[data-gap-identifier="T1"]');
    const target2 = interaction.locator('[data-gap-identifier="T2"]');
    const target3 = interaction.locator('[data-gap-identifier="T3"]');
    const validation = interaction.locator('[data-validation-for="RESPONSE"]');

    await dragCenter(page, sourceA, target1);
    await dragCenter(page, sourceB, target2);
    await expectResponse(page, ["A T1", "B T2"]);
    await expect(sourceBButton).toBeHidden();

    await dragCenter(page, sourceC, target3);
    await expectResponse(page, ["A T1", "B T2"]);
    await expect(validation).toBeVisible();
    await expect(validation).toContainText("You've selected too many!");
    await expect(target3).toHaveAccessibleName("Target 3, empty");
    await expect(sourceCButton).toBeVisible();

    const rejectedState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(rejectedState.validationMessages).toEqual([
      expect.objectContaining({
        code: "response.maximum",
        message: "You've selected too many!",
        path: "RESPONSE",
      }),
    ]);

    await dragCenter(page, target1, target3);
    await expectResponse(page, ["B T2", "A T3"]);
    await expect(validation).toBeHidden();
    await expect(target1).toHaveAccessibleName("Target 1, empty");
    await expect(target3).toHaveAccessibleName("Target 3, assigned Alpha");

    await dragCenter(page, sourceC, target2);
    await expectResponse(page, ["C T2", "A T3"]);
    await expect(target2).toHaveAccessibleName("Target 2, assigned Gamma");
    await expect(sourceBButton).toBeVisible();
    await expect(sourceCButton).toBeHidden();
  });

  test("defaults graphic gap match max-associations to one when omitted", async ({ page }) => {
    await page.goto("/");
    const targetSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="230" height="120" viewBox="0 0 230 120"><rect width="230" height="120" fill="#f4f2ea"/><rect x="34" y="34" width="60" height="42" fill="#2f4858"/><rect x="136" y="34" width="60" height="42" fill="#8b5d33"/></svg>`;

    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="graphic-gap-default-max" title="graphic-gap-default-max" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-graphic-gap-match-interaction response-identifier="RESPONSE">
      <object data="${svgBase64DataUrl(targetSvg)}" alt="Two target slots." type="image/svg+xml"/>
      <qti-gap-text identifier="A" match-max="1">Alpha</qti-gap-text>
      <qti-gap-text identifier="B" match-max="1">Beta</qti-gap-text>
      <qti-associable-hotspot identifier="T1" shape="rect" coords="34,34,94,76" match-max="1"/>
      <qti-associable-hotspot identifier="T2" shape="rect" coords="136,34,196,76" match-max="1"/>
    </qti-graphic-gap-match-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const interaction = page.locator("qti-assessment-item-player .qti3-graphicGapMatch");
    const bank = interaction.locator(".qti3-graphic-gap-source-region");
    const sourceA = bank.getByRole("button", { name: "Alpha" });
    const sourceB = bank.getByRole("button", { name: "Beta" });
    const sourceBButton = bank.locator('button[data-choice-identifier="B"]');
    const target1 = interaction.locator('[data-gap-identifier="T1"]');
    const target2 = interaction.locator('[data-gap-identifier="T2"]');
    const validation = interaction.locator('[data-validation-for="RESPONSE"]');

    await dragCenter(page, sourceA, target1);
    await dragCenter(page, sourceB, target2);

    await expectResponse(page, ["A T1"]);
    await expect(validation).toBeVisible();
    await expect(validation).toContainText("RESPONSE allows at most 1 response.");
    await expect(target2).toHaveAccessibleName("Target 2, empty");
    await expect(sourceBButton).toBeVisible();
  });

  test("supports keyboard assignment and clearing for qti-gap-img choices", async ({ page }) => {
    await page.goto("/");
    const targetSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120" viewBox="0 0 180 120"><rect width="180" height="120" fill="#f4f2ea"/><rect x="54" y="34" width="72" height="52" fill="#2f4858"/></svg>`;
    const choiceSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="78" height="63" viewBox="0 0 78 63"><rect width="78" height="63" rx="4" fill="#fff"/><text x="39" y="37" text-anchor="middle" font-size="18" font-family="sans-serif" fill="#2f4858">A</text></svg>`;
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="keyboard-gap-img-graphic-gap-match" title="keyboard-gap-img-graphic-gap-match" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-graphic-gap-match-interaction response-identifier="RESPONSE">
      <object data="${svgBase64DataUrl(targetSvg)}" alt="Timeline target." type="image/png"/>
      <qti-gap-img identifier="DraggerA" match-max="1">
        <img alt="Civil War marker" height="63" src="${svgBase64DataUrl(choiceSvg)}" width="78"/>
      </qti-gap-img>
      <qti-associable-hotspot identifier="A" shape="rect" coords="54,34,126,86" match-max="1"/>
    </qti-graphic-gap-match-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const source = page
      .locator("qti-assessment-item-player .qti3-graphic-gap-source-region")
      .getByRole("button", { name: "Civil War marker" });
    const sourceButton = page.locator(
      'qti-assessment-item-player .qti3-graphic-gap-source-region button[data-choice-identifier="DraggerA"]',
    );
    const target = page.locator('qti-assessment-item-player [data-gap-identifier="A"]');

    await source.focus();
    await page.keyboard.press("Enter");
    await expect(source).toHaveAttribute("aria-pressed", "true");
    await target.focus();
    await page.keyboard.press("Enter");
    await expectResponse(page, ["DraggerA A"]);
    await expect(target).toHaveAccessibleName("Target 1, assigned Civil War marker");
    await expect(sourceButton).toBeHidden();

    await target.focus();
    await page.keyboard.press("Delete");
    await expectResponse(page, []);
    await expect(target).toHaveAccessibleName("Target 1, empty");
    await expect(sourceButton).toBeVisible();
  });

  test("keeps qti-gap-img choices visible in forced colors and narrow reflow", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.emulateMedia({ forcedColors: "active" });
    await page.goto("/");
    const targetSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120" viewBox="0 0 180 120"><rect width="180" height="120" fill="#f4f2ea"/><rect x="54" y="34" width="72" height="52" fill="#2f4858"/></svg>`;
    const choiceSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="78" height="63" viewBox="0 0 78 63"><rect width="78" height="63" rx="4" fill="#fff"/><text x="39" y="37" text-anchor="middle" font-size="18" font-family="sans-serif" fill="#2f4858">A</text></svg>`;
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="forced-colors-gap-img-graphic-gap-match" title="forced-colors-gap-img-graphic-gap-match" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-graphic-gap-match-interaction response-identifier="RESPONSE">
      <object data="${svgBase64DataUrl(targetSvg)}" alt="Timeline target." type="image/png"/>
      <qti-gap-img identifier="DraggerA" match-max="1">
        <img alt="Civil War marker" height="63" src="${svgBase64DataUrl(choiceSvg)}" width="78"/>
      </qti-gap-img>
      <qti-associable-hotspot identifier="A" shape="rect" coords="54,34,126,86" match-max="1"/>
    </qti-graphic-gap-match-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const sourceRegion = page.locator("qti-assessment-item-player .qti3-graphic-gap-source-region");
    const source = sourceRegion.getByRole("button", { name: "Civil War marker" });
    const image = source.locator(".qti3-gap-choice-image");
    await expectImageLoaded(image);
    await expect(image).toBeVisible();
    await expect(source).toHaveCSS("border-top-style", "solid");
    await expect(page.evaluate(() => matchMedia("(forced-colors: active)").matches)).resolves.toBe(
      true,
    );

    const sourceBox = await source.boundingBox();
    const imageBox = await image.boundingBox();
    const regionBox = await sourceRegion.boundingBox();
    if (!sourceBox || !imageBox || !regionBox) {
      throw new Error("Missing forced-colors qti-gap-img layout boxes.");
    }
    expect(imageBox.width).toBeLessThanOrEqual(sourceBox.width);
    expect(sourceBox.x + sourceBox.width).toBeLessThanOrEqual(regionBox.x + regionBox.width + 1);
  });

  test("reserves layout space for bottom-edge graphic gap labels", async ({ page }) => {
    await page.goto("/");
    const targetSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120" viewBox="0 0 240 120"><rect width="240" height="120" fill="#f4f2ea"/><circle cx="120" cy="108" r="10" fill="#2f4858"/></svg>`;
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bottom-label-graphic-gap-match" title="bottom-label-graphic-gap-match" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-graphic-gap-match-interaction response-identifier="RESPONSE">
      <object data="${svgBase64DataUrl(targetSvg)}" alt="Bottom target graphic." type="image/png"/>
      <qti-gap-text identifier="A" match-max="1">A very long era label near the bottom edge</qti-gap-text>
      <qti-associable-hotspot identifier="T1" shape="circle" coords="120,108,10" match-max="1"/>
    </qti-graphic-gap-match-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const surface = page.locator("qti-assessment-item-player .qti3-graphic-gap-match-surface");
    const sourceRegion = page.locator("qti-assessment-item-player .qti3-graphic-gap-source-region");
    const source = sourceRegion.getByRole("button", {
      name: "A very long era label near the bottom edge",
    });
    const target = surface.locator('[data-gap-identifier="T1"]');
    await dragCenter(page, source, target);

    const labelBox = await surface.locator(".qti3-graphic-gap-label").boundingBox();
    const regionBox = await sourceRegion.boundingBox();
    if (!labelBox || !regionBox) throw new Error("Missing bottom label layout boxes.");
    expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(regionBox.y);
  });

  test("reserves layout space for bottom-edge graphic gap image labels", async ({ page }) => {
    await page.goto("/");
    const targetSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120" viewBox="0 0 240 120"><rect width="240" height="120" fill="#f4f2ea"/><circle cx="120" cy="108" r="10" fill="#2f4858"/></svg>`;
    const choiceSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="78" height="63" viewBox="0 0 78 63"><rect width="78" height="63" rx="4" fill="#fff"/><path d="M12 42h54" stroke="#2f4858" stroke-width="6"/><text x="39" y="29" text-anchor="middle" font-size="18" font-family="sans-serif" fill="#2f4858">A</text></svg>`;
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bottom-image-label-graphic-gap-match" title="bottom-image-label-graphic-gap-match" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-graphic-gap-match-interaction response-identifier="RESPONSE">
      <object data="${svgBase64DataUrl(targetSvg)}" alt="Bottom target graphic." type="image/png"/>
      <qti-gap-img identifier="A" match-max="1">
        <img alt="A" height="63" src="${svgBase64DataUrl(choiceSvg)}" width="78"/>
      </qti-gap-img>
      <qti-associable-hotspot identifier="T1" shape="circle" coords="120,108,10" match-max="1"/>
    </qti-graphic-gap-match-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const surface = page.locator("qti-assessment-item-player .qti3-graphic-gap-match-surface");
    const sourceRegion = page.locator("qti-assessment-item-player .qti3-graphic-gap-source-region");
    const source = sourceRegion.getByRole("button", { name: "A" });
    const target = surface.locator('[data-gap-identifier="T1"]');
    await expectImageLoaded(source.locator("img"));

    await source.click();
    await target.click();

    const labelBox = await surface.locator(".qti3-graphic-gap-label").boundingBox();
    const regionBox = await sourceRegion.boundingBox();
    if (!labelBox || !regionBox) throw new Error("Missing bottom image label layout boxes.");
    expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(regionBox.y);
  });

  test("applies graphic gap match selection themes to unassigned hotspots", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, GRAPHIC_GAP_SELECTION_THEMES_ITEM);

    const light = page.locator(
      "qti-assessment-item-player .qti3-graphicGapMatch.qti-selections-light",
    );
    const dark = page.locator(
      "qti-assessment-item-player .qti3-graphicGapMatch.qti-selections-dark",
    );
    await expect(light).toHaveClass(/qti-selections-light/);
    await expect(dark).toHaveClass(/qti-selections-dark/);

    const lightTarget = light.locator(".qti3-graphic-gap-hotspot").first();
    const darkTarget = dark.locator(".qti3-graphic-gap-hotspot").first();
    await expect(lightTarget).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(lightTarget).toHaveCSS("border-top-color", "rgb(255, 255, 255)");
    await expect(darkTarget).toHaveCSS("color", "rgb(0, 0, 0)");
    await expect(darkTarget).toHaveCSS("border-top-color", "rgb(0, 0, 0)");
  });

  test("hides unassigned graphic gap match hotspots until keyboard focus or assignment", async ({
    page,
  }) => {
    await page.goto("/");
    await pasteXml(page, GRAPHIC_GAP_UNSELECTED_HIDDEN_ITEM);

    const interaction = page.locator("qti-assessment-item-player .qti3-graphicGapMatch");
    await expect(interaction).toHaveClass(/qti-selections-dark/);
    await expect(interaction).toHaveClass(/qti-unselected-hidden/);

    const source = interaction
      .locator(".qti3-graphic-gap-source-region")
      .getByRole("button", { name: "Alpha" });
    const target = interaction.locator('[data-gap-identifier="T2"]');
    await expect(target).toHaveCSS("opacity", "0");

    await target.focus();
    await expect(target).toBeFocused();
    await expect(target).not.toHaveCSS("opacity", "0");

    await source.focus();
    await page.keyboard.press("Enter");
    await expect(source).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Shift+Tab");
    await expect(target).toBeFocused();
    await expect(target).not.toHaveCSS("opacity", "0");
    await page.keyboard.press("Enter");

    await expectResponse(page, ["A T2"]);
    await expect(target).toHaveAttribute("data-selected", "true");
    await expect(target).toHaveAccessibleName("Target 2, assigned Alpha");
    await expect(target).not.toHaveCSS("opacity", "0");
  });
});
