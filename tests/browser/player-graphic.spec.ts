import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  clickAuthoredCoordinate,
  createStoredZip,
  decodeDataUrlText,
  expectImageLoaded,
  expectPointResponse,
  expectResponse,
  expectStringResponse,
  loadFixture,
  pasteXml,
} from "./player-helpers.js";

function graySvgDataUrl(width: number, height: number): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#777"/></svg>`,
  )}`;
}

async function dragCenter(page: Page, source: Locator, target: Locator): Promise<void> {
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("Missing drag boxes.");
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
  await page.mouse.up();
}

const GRAPHIC_GAP_SELECTION_THEMES_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="graphic-gap-selection-themes" title="graphic-gap-selection-themes" time-dependent="false">
  <qti-response-declaration identifier="LIGHT_RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-response-declaration identifier="DARK_RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-graphic-gap-match-interaction class="qti-selections-light" response-identifier="LIGHT_RESPONSE">
      <object data="${graySvgDataUrl(220, 120)}" alt="Light theme target." type="image/svg+xml" width="220" height="120"/>
      <qti-gap-text identifier="LA" match-max="1">Light token</qti-gap-text>
      <qti-associable-hotspot identifier="LT" shape="rect" coords="40,30,100,80" match-max="1"/>
    </qti-graphic-gap-match-interaction>
    <qti-graphic-gap-match-interaction class="qti-selections-dark" response-identifier="DARK_RESPONSE">
      <object data="${graySvgDataUrl(220, 120)}" alt="Dark theme target." type="image/svg+xml" width="220" height="120"/>
      <qti-gap-text identifier="DA" match-max="1">Dark token</qti-gap-text>
      <qti-associable-hotspot identifier="DT" shape="rect" coords="40,30,100,80" match-max="1"/>
    </qti-graphic-gap-match-interaction>
  </qti-item-body>
</qti-assessment-item>`;

const GRAPHIC_GAP_UNSELECTED_HIDDEN_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="graphic-gap-unselected-hidden" title="graphic-gap-unselected-hidden" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-graphic-gap-match-interaction class="qti-selections-dark qti-unselected-hidden" response-identifier="RESPONSE">
      <object data="${graySvgDataUrl(240, 140)}" alt="Graphic gap shared vocabulary target." type="image/svg+xml" width="240" height="140"/>
      <qti-gap-text identifier="A" match-max="1">Alpha</qti-gap-text>
      <qti-gap-text identifier="B" match-max="1">Beta</qti-gap-text>
      <qti-associable-hotspot identifier="T1" shape="rect" coords="24,24,84,76" match-max="1"/>
      <qti-associable-hotspot identifier="T2" shape="rect" coords="132,24,192,76" match-max="1"/>
    </qti-graphic-gap-match-interaction>
  </qti-item-body>
</qti-assessment-item>`;

test.describe("player graphic interactions", () => {
  test("renders graphic interactions with their object context", async ({ page }) => {
    await page.goto("/");

    for (const interactionType of ["graphicOrder", "graphicAssociate", "graphicGapMatch"]) {
      await loadFixture(page, interactionType);
      if (interactionType === "graphicOrder") {
        const surface = page.locator("qti-assessment-item-player .qti3-graphic-order-surface");
        await expect(surface, interactionType).toBeVisible();
        await expect(surface.locator("img"), interactionType).toHaveAttribute(
          "src",
          /hotspot-flow-unlabeled\.svg$/,
        );
        await expectImageLoaded(surface.locator("img"));
        continue;
      }
      if (interactionType === "graphicAssociate") {
        const surface = page.locator("qti-assessment-item-player .qti3-graphic-associate-surface");
        await expect(surface, interactionType).toBeVisible();
        await expect(surface.locator("img"), interactionType).toHaveAttribute(
          "src",
          /hotspot-flow-unlabeled\.svg$/,
        );
        await expectImageLoaded(surface.locator("img"));
        continue;
      }
      const context = page.locator("qti-assessment-item-player .qti3-graphic-context");
      await expect(context, interactionType).toBeVisible();
      await expect(context.locator("img"), interactionType).toHaveAttribute(
        "src",
        /hotspot-flow-unlabeled\.svg$/,
      );
      await expectImageLoaded(context.locator("img"));
    }
  });

  test("creates graphic associate pairs on positioned hotspots", async ({ page }) => {
    await page.goto("/");

    await loadFixture(page, "graphicAssociate");
    const surface = page.locator("qti-assessment-item-player .qti3-graphic-associate-surface");
    await expect(surface.locator("img")).toHaveAttribute("src", /hotspot-flow-unlabeled\.svg$/);
    await expect(surface.getByRole("button", { name: "Item XML" })).toHaveAttribute(
      "data-choice-identifier",
      "A",
    );
    await expect(surface.getByRole("button", { name: "Response capture" })).toHaveCSS(
      "position",
      "absolute",
    );
    await expectImageLoaded(surface.locator("img"));

    await surface.getByRole("button", { name: "Item XML" }).click();
    await expect(surface.getByRole("button", { name: "Item XML" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await surface.getByRole("button", { name: "Response capture" }).click();
    await expectResponse(page, ["A B"]);
    await expect(surface.locator("svg.qti3-graphic-associate-lines line")).toHaveCount(1);
    await expect(page.locator("qti-assessment-item-player .qti3-pair-list")).toContainText(
      "Item XML to Response capture",
    );
    await surface.getByRole("button", { name: "Item XML" }).click();
    await surface.getByRole("button", { name: "Processing rules" }).click();
    await expectResponse(page, ["A B"]);

    const remove = page.getByRole("button", { name: "Remove Item XML to Response capture" });
    const trashIcon = remove.locator("svg.qti3-trash-icon");
    await expect(trashIcon).toHaveCount(1);
    await expect(trashIcon).toHaveAttribute("xmlns", "http://www.w3.org/2000/svg");
    await expect(trashIcon).toHaveAttribute("width", "24");
    await expect(trashIcon).toHaveAttribute("height", "24");
    await expect(trashIcon).toHaveAttribute("fill", "none");
    await expect(trashIcon).toHaveAttribute("stroke", "currentColor");
    const hiddenPathStroke = await remove
      .locator("svg.qti3-trash-icon path")
      .first()
      .evaluate((path) => getComputedStyle(path).stroke);
    expect(hiddenPathStroke).toBe("none");
    await expect(remove).toHaveAttribute("title", "Remove");
    await remove.click();
    await expectResponse(page, []);
    await expect(surface.locator("svg.qti3-graphic-associate-lines line")).toHaveCount(0);
  });

  test("infers inline SVG dimensions and supports dragging graphic associate lines", async ({
    page,
  }) => {
    await page.goto("/");
    const timelineSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="260" viewBox="0 0 480 260"><rect width="480" height="260" fill="#f4f2ea"/><line x1="80" y1="130" x2="400" y2="130" stroke="#b08d57" stroke-width="6"/><circle cx="120" cy="90" r="18" fill="#2f4858"/><circle cx="120" cy="170" r="18" fill="#2f4858"/><circle cx="360" cy="90" r="18" fill="#2f4858"/><circle cx="360" cy="170" r="18" fill="#2f4858"/></svg>`;
    const image = `data:image/svg+xml,${encodeURIComponent(timelineSvg)}`;
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="inline-svg-graphic-associate" title="inline-svg-graphic-associate" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="pair">
    <qti-correct-response><qti-value>A B</qti-value><qti-value>C D</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-item-body>
    <qti-graphic-associate-interaction response-identifier="RESPONSE" max-associations="2">
      <qti-prompt>Select or drag between matching era markers.</qti-prompt>
      <object data="${image}" type="image/png">Timeline graphic with paired era markers.</object>
      <qti-associable-hotspot identifier="A" shape="circle" coords="120,90,18" match-max="1"/>
      <qti-associable-hotspot identifier="B" shape="circle" coords="120,170,18" match-max="1"/>
      <qti-associable-hotspot identifier="C" shape="circle" coords="360,90,18" match-max="1"/>
      <qti-associable-hotspot identifier="D" shape="circle" coords="360,170,18" match-max="1"/>
    </qti-graphic-associate-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const surface = page.locator("qti-assessment-item-player .qti3-graphic-associate-surface");
    const box = await surface.boundingBox();
    expect(box?.width).toBe(480);
    expect(box?.height).toBe(260);
    await expect(surface.getByRole("button", { name: "Region 4" })).toBeVisible();

    const source = surface.getByRole("button", { name: "Region 1" });
    const target = surface.getByRole("button", { name: "Region 2" });
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    if (!sourceBox || !targetBox) throw new Error("Missing graphic associate drag boxes.");

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
    await page.mouse.up();

    await expectResponse(page, ["A B"]);
    await expect(surface.locator("svg.qti3-graphic-associate-lines line")).toHaveCount(1);
  });

  test("supports keyboard graphic associate pairing and deletion", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "graphicAssociate");

    const surface = page.locator("qti-assessment-item-player .qti3-graphic-associate-surface");
    await surface.getByRole("button", { name: "Item XML" }).focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowRight");
    await expect(surface.getByRole("button", { name: "Response capture" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expectResponse(page, ["A B"]);

    await page.keyboard.press("Delete");
    await expectResponse(page, []);
  });

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
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    if (!sourceBox || !targetBox) throw new Error("Missing graphic gap drag boxes.");

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
    await page.mouse.up();
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
    const image = `data:image/svg+xml;base64,${Buffer.from(timelineSvg).toString("base64")}`;
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
    await expect(target).toContainText("Abraham Lincoln");
  });

  test("renders qti-gap-img choices as graphic gap match drag images", async ({ page }) => {
    await page.goto("/");
    const timelineSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120" viewBox="0 0 180 120"><rect width="180" height="120" fill="#f4f2ea"/><rect x="54" y="34" width="72" height="52" fill="#2f4858"/></svg>`;
    const choiceSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="78" height="63" viewBox="0 0 78 63"><rect width="78" height="63" rx="4" fill="#fff"/><path d="M12 42h54" stroke="#2f4858" stroke-width="6"/><text x="39" y="29" text-anchor="middle" font-size="18" font-family="sans-serif" fill="#2f4858">A</text></svg>`;
    const timelineImage = `data:image/svg+xml;base64,${Buffer.from(timelineSvg).toString("base64")}`;
    const choiceImage = `data:image/svg+xml;base64,${Buffer.from(choiceSvg).toString("base64")}`;

    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="gap-img-graphic-gap-match" title="gap-img-graphic-gap-match" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-graphic-gap-match-interaction response-identifier="RESPONSE">
      <object data="${timelineImage}" alt="Timeline target." type="image/png"/>
      <qti-gap-img identifier="DraggerA" match-max="1">
        <img alt="Civil War marker" height="63" src="${choiceImage}" width="78"/>
      </qti-gap-img>
      <qti-associable-hotspot identifier="A" shape="rect" coords="54,34,126,86" match-max="1"/>
    </qti-graphic-gap-match-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const source = page
      .locator("qti-assessment-item-player .qti3-graphic-gap-source-region")
      .getByRole("button", { name: "Civil War marker" });
    await expect(source.locator("img")).toHaveAttribute("src", /^data:image\/svg\+xml;base64,/);
    await expectImageLoaded(source.locator("img"));

    const target = page.locator('qti-assessment-item-player [data-gap-identifier="A"]');
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    if (!sourceBox || !targetBox) throw new Error("Missing qti-gap-img drag boxes.");
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
    await page.mouse.up();

    await expectResponse(page, ["DraggerA A"]);
    await expect(target).toHaveAccessibleName("Target 1, assigned Civil War marker");
    await expect(target.locator(".qti3-graphic-gap-label img")).toHaveAttribute(
      "src",
      /^data:image\/svg\+xml;base64,/,
    );
  });

  test("lets mouse users clear and overwrite qti-gap-img graphic gap match placements", async ({
    page,
  }) => {
    await page.goto("/");
    const targetSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="160" viewBox="0 0 300 160"><rect width="300" height="160" fill="#f4f2ea"/><rect x="36" y="44" width="92" height="64" rx="6" fill="#2f4858"/><rect x="172" y="44" width="92" height="64" rx="6" fill="#8b5d33"/></svg>`;
    const choiceASvg = `<svg xmlns="http://www.w3.org/2000/svg" width="78" height="63" viewBox="0 0 78 63"><rect width="78" height="63" rx="4" fill="#fff" stroke="#2f4858" stroke-width="3"/><text x="39" y="38" text-anchor="middle" font-size="18" font-family="sans-serif" fill="#2f4858">A</text></svg>`;
    const choiceBSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="78" height="63" viewBox="0 0 78 63"><rect width="78" height="63" rx="4" fill="#fff" stroke="#8b5d33" stroke-width="3"/><text x="39" y="38" text-anchor="middle" font-size="18" font-family="sans-serif" fill="#8b5d33">B</text></svg>`;
    const targetImage = `data:image/svg+xml;base64,${Buffer.from(targetSvg).toString("base64")}`;
    const choiceAImage = `data:image/svg+xml;base64,${Buffer.from(choiceASvg).toString("base64")}`;
    const choiceBImage = `data:image/svg+xml;base64,${Buffer.from(choiceBSvg).toString("base64")}`;

    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="clear-overwrite-gap-img-graphic-gap-match" title="clear-overwrite-gap-img-graphic-gap-match" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-graphic-gap-match-interaction response-identifier="RESPONSE">
      <object data="${targetImage}" alt="Diagram with two highlighted targets." type="image/svg+xml"/>
      <qti-gap-img identifier="DraggerA" match-max="1">
        <img alt="Civil War marker" height="63" src="${choiceAImage}" width="78"/>
      </qti-gap-img>
      <qti-gap-img identifier="DraggerB" match-max="1">
        <img alt="Reconstruction marker" height="63" src="${choiceBImage}" width="78"/>
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
    const targetA = page.locator('qti-assessment-item-player [data-gap-identifier="TargetA"]');
    const targetB = page.locator('qti-assessment-item-player [data-gap-identifier="TargetB"]');

    await dragCenter(page, sourceA, targetB);
    await expectResponse(page, ["DraggerA TargetB"]);

    await targetB.click();
    await expectResponse(page, ["DraggerA TargetB"]);

    await dragCenter(page, targetB.locator(".qti3-graphic-gap-label"), bank);
    await expectResponse(page, []);
    await expect(targetB).toHaveAccessibleName("Target 2, empty");

    await dragCenter(page, sourceA, targetA);
    await expectResponse(page, ["DraggerA TargetA"]);

    await dragCenter(page, sourceB, targetA);
    await expectResponse(page, ["DraggerB TargetA"]);
    await expect(targetA).toHaveAccessibleName("Target 1, assigned Reconstruction marker");
  });

  test("supports keyboard assignment and clearing for qti-gap-img choices", async ({ page }) => {
    await page.goto("/");
    const targetSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120" viewBox="0 0 180 120"><rect width="180" height="120" fill="#f4f2ea"/><rect x="54" y="34" width="72" height="52" fill="#2f4858"/></svg>`;
    const choiceSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="78" height="63" viewBox="0 0 78 63"><rect width="78" height="63" rx="4" fill="#fff"/><text x="39" y="37" text-anchor="middle" font-size="18" font-family="sans-serif" fill="#2f4858">A</text></svg>`;
    const targetImage = `data:image/svg+xml;base64,${Buffer.from(targetSvg).toString("base64")}`;
    const choiceImage = `data:image/svg+xml;base64,${Buffer.from(choiceSvg).toString("base64")}`;
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="keyboard-gap-img-graphic-gap-match" title="keyboard-gap-img-graphic-gap-match" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-graphic-gap-match-interaction response-identifier="RESPONSE">
      <object data="${targetImage}" alt="Timeline target." type="image/png"/>
      <qti-gap-img identifier="DraggerA" match-max="1">
        <img alt="Civil War marker" height="63" src="${choiceImage}" width="78"/>
      </qti-gap-img>
      <qti-associable-hotspot identifier="A" shape="rect" coords="54,34,126,86" match-max="1"/>
    </qti-graphic-gap-match-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const source = page
      .locator("qti-assessment-item-player .qti3-graphic-gap-source-region")
      .getByRole("button", { name: "Civil War marker" });
    const target = page.locator('qti-assessment-item-player [data-gap-identifier="A"]');

    await source.focus();
    await page.keyboard.press("Enter");
    await expect(source).toHaveAttribute("aria-pressed", "true");
    await target.focus();
    await page.keyboard.press("Enter");
    await expectResponse(page, ["DraggerA A"]);
    await expect(target).toHaveAccessibleName("Target 1, assigned Civil War marker");

    await target.focus();
    await page.keyboard.press("Delete");
    await expectResponse(page, []);
    await expect(target).toHaveAccessibleName("Target 1, empty");
  });

  test("keeps qti-gap-img choices visible in forced colors and narrow reflow", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.emulateMedia({ forcedColors: "active" });
    await page.goto("/");
    const targetSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120" viewBox="0 0 180 120"><rect width="180" height="120" fill="#f4f2ea"/><rect x="54" y="34" width="72" height="52" fill="#2f4858"/></svg>`;
    const choiceSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="78" height="63" viewBox="0 0 78 63"><rect width="78" height="63" rx="4" fill="#fff"/><text x="39" y="37" text-anchor="middle" font-size="18" font-family="sans-serif" fill="#2f4858">A</text></svg>`;
    const targetImage = `data:image/svg+xml;base64,${Buffer.from(targetSvg).toString("base64")}`;
    const choiceImage = `data:image/svg+xml;base64,${Buffer.from(choiceSvg).toString("base64")}`;
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="forced-colors-gap-img-graphic-gap-match" title="forced-colors-gap-img-graphic-gap-match" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-graphic-gap-match-interaction response-identifier="RESPONSE">
      <object data="${targetImage}" alt="Timeline target." type="image/png"/>
      <qti-gap-img identifier="DraggerA" match-max="1">
        <img alt="Civil War marker" height="63" src="${choiceImage}" width="78"/>
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
    const image = `data:image/svg+xml;base64,${Buffer.from(targetSvg).toString("base64")}`;
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bottom-label-graphic-gap-match" title="bottom-label-graphic-gap-match" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-graphic-gap-match-interaction response-identifier="RESPONSE">
      <object data="${image}" alt="Bottom target graphic." type="image/png"/>
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
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    if (!sourceBox || !targetBox) throw new Error("Missing bottom label drag boxes.");

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
    await page.mouse.up();

    const labelBox = await surface.locator(".qti3-graphic-gap-label").boundingBox();
    const regionBox = await sourceRegion.boundingBox();
    if (!labelBox || !regionBox) throw new Error("Missing bottom label layout boxes.");
    expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(regionBox.y);
  });

  test("reserves layout space for bottom-edge graphic gap image labels", async ({ page }) => {
    await page.goto("/");
    const targetSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120" viewBox="0 0 240 120"><rect width="240" height="120" fill="#f4f2ea"/><circle cx="120" cy="108" r="10" fill="#2f4858"/></svg>`;
    const choiceSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="78" height="63" viewBox="0 0 78 63"><rect width="78" height="63" rx="4" fill="#fff"/><path d="M12 42h54" stroke="#2f4858" stroke-width="6"/><text x="39" y="29" text-anchor="middle" font-size="18" font-family="sans-serif" fill="#2f4858">A</text></svg>`;
    const targetImage = `data:image/svg+xml;base64,${Buffer.from(targetSvg).toString("base64")}`;
    const choiceImage = `data:image/svg+xml;base64,${Buffer.from(choiceSvg).toString("base64")}`;
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bottom-image-label-graphic-gap-match" title="bottom-image-label-graphic-gap-match" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-graphic-gap-match-interaction response-identifier="RESPONSE">
      <object data="${targetImage}" alt="Bottom target graphic." type="image/png"/>
      <qti-gap-img identifier="A" match-max="1">
        <img alt="A" height="63" src="${choiceImage}" width="78"/>
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

  test("captures pointer coordinate responses for point interactions", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "selectPoint");

    await clickAuthoredCoordinate(
      page.locator("qti-assessment-item-player .qti3-point-surface"),
      240,
      88,
    );
    await expectPointResponse(page, "240 88");
  });

  test("captures multiple select point responses when authored", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="select-point-multiple" title="select-point-multiple" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="point"/>
  <qti-item-body>
    <qti-select-point-interaction response-identifier="RESPONSE" max-choices="2">
      <qti-prompt>Mark two points on the diagram.</qti-prompt>
      <object data="hotspot-flow.svg" type="image/svg+xml" width="480" height="300"/>
    </qti-select-point-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const surface = page.locator("qti-assessment-item-player .qti3-point-surface");
    await clickAuthoredCoordinate(surface, 24, 52);
    await expectPointResponse(page, ["24 52"]);
    await clickAuthoredCoordinate(surface, 184, 52);
    await expectPointResponse(page, ["24 52", "184 52"]);
    await expect(page.locator("qti-assessment-item-player .qti3-point-marker")).toHaveCount(2);
  });

  test("renders object-backed coordinate surfaces for select point interactions", async ({
    page,
  }) => {
    await page.goto("/");
    await loadFixture(page, "selectPoint");

    const surface = page.locator("qti-assessment-item-player .qti3-point-surface");
    await expect(surface.locator("img")).toHaveAttribute("src", "hotspot-flow.svg");
    await expect(surface.locator("img")).toHaveAttribute("alt", "");
    await expectImageLoaded(surface.locator("img"));

    const box = await surface.boundingBox();
    expect(box?.width).toBe(480);
    expect(box?.height).toBe(300);

    await expect(page.locator("qti-assessment-item-player .qti3-coordinate-output")).toContainText(
      "No point selected",
    );
    await clickAuthoredCoordinate(surface, 240, 88);
    await expectPointResponse(page, "240 88");
  });

  test("renders position object as a draggable object on a stage", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "positionObject");

    const stage = page.locator("qti-assessment-item-player .qti3-position-object-stage");
    await expect(stage.locator("img").first()).toHaveAttribute("src", "hotspot-flow.svg");
    await expectImageLoaded(stage.locator("img").first());
    const marker = stage.getByRole("button", { name: "Movable object" });
    await expect(marker).toBeVisible();
    await expect(marker).toHaveAttribute("data-placed", "false");
    await expectResponse(page, undefined);
    const placementStatus = page.locator("qti-assessment-item-player .qti3-coordinate-output");
    await expect(placementStatus).toHaveClass(/qti-visually-hidden/);
    await expect(placementStatus).toHaveAttribute("aria-live", "polite");
    await expect(placementStatus).toContainText("Object not placed");

    const box = await stage.boundingBox();
    expect(box?.width).toBe(480);
    expect(box?.height).toBe(300);
    const markerBox = await marker.boundingBox();
    if (!box || !markerBox) throw new Error("Missing position object boxes.");
    expect(markerBox.y).toBeGreaterThanOrEqual(box.y + box.height);

    await clickAuthoredCoordinate(stage, 240, 88);
    await expectPointResponse(page, "240 88");
    await expect(marker).toHaveAttribute("data-placed", "true");
    await expect(placementStatus).toContainText(/Object positioned at 240 8[78]/);
  });

  test("captures drawing responses as file data URLs", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "drawing");

    const surface = page.locator("qti-assessment-item-player .qti3-drawing-surface");
    const box = await surface.boundingBox();
    if (!box) throw new Error("Missing drawing surface box.");
    expect(box.width).toBe(480);
    expect(box.height).toBe(300);
    await expect(surface).toHaveAttribute("viewBox", "0 0 480 300");
    await expect(surface.locator("image")).toHaveAttribute("href", "hotspot-flow.svg");

    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + 50, box.y + 30);
    await page.mouse.move(box.x + 90, box.y + 90);
    await page.mouse.up();

    await page.mouse.move(box.x + 20, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + 20);
    await page.mouse.up();

    const response = await expectStringResponse(page, /^data:image\/svg\+xml;charset=utf-8,/);
    const svg = decodeDataUrlText(response);
    expect(svg).toContain("<polyline");
    expect(svg).toContain("data-qti3-strokes");
    expect(svg).not.toMatch(/timestamp/i);
    await expect(surface.locator("polyline")).toHaveCount(2);
    const drawingStatus = page.locator("qti-assessment-item-player .qti3-coordinate-output");
    await expect(drawingStatus).toContainText("2 drawing strokes.");
    await expect(drawingStatus).toHaveClass(/qti-visually-hidden/);
    await expect(drawingStatus).toHaveAttribute("aria-live", "polite");

    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    await page.locator("qti-assessment-item-player").evaluate((element, attemptState) => {
      element.reset();
      element.restore(attemptState);
    }, state);
    await expect(surface.locator("polyline")).toHaveCount(2);

    await page.getByRole("button", { name: "Clear drawing" }).click();
    await expectResponse(page, null);
    await expect(surface.locator("polyline")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Replay last stroke" })).toHaveCount(0);
  });

  test("keeps drawing strokes visible in dark color scheme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await loadFixture(page, "drawing");

    const surface = page.locator("qti-assessment-item-player .qti3-drawing-surface");
    const box = await surface.boundingBox();
    if (!box) throw new Error("Missing drawing surface box.");

    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + 90, box.y + 90);
    await page.mouse.up();

    await expect(surface.locator("polyline")).toHaveCount(1);
    await expect(surface.locator("polyline").first()).toHaveCSS("stroke", "rgb(0, 0, 0)");
  });

  test("keeps drawing strokes visible under forced colors", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark", forcedColors: "active" });
    await page.goto("/");
    await loadFixture(page, "drawing");

    const surface = page.locator("qti-assessment-item-player .qti3-drawing-surface");
    const box = await surface.boundingBox();
    if (!box) throw new Error("Missing drawing surface box.");

    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + 90, box.y + 90);
    await page.mouse.up();

    await expect(surface.locator("polyline")).toHaveCount(1);
    await expect(surface.locator("polyline").first()).toHaveCSS("stroke", "rgb(0, 0, 0)");
  });

  test("honors authored drawing object dimensions", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="drawing-sized" title="drawing-sized" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="file"/>
  <qti-item-body>
    <qti-drawing-interaction response-identifier="RESPONSE">
      <qti-prompt>Annotate the diagram.</qti-prompt>
      <object data="hotspot-flow.svg" type="image/svg+xml" width="480" height="300"/>
    </qti-drawing-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const surface = page.locator("qti-assessment-item-player .qti3-drawing-surface");
    await expect(surface).toHaveAttribute("viewBox", "0 0 480 300");
    const box = await surface.boundingBox();
    expect(box?.width).toBe(480);
    expect(box?.height).toBe(300);
  });

  test("exports raster-backed drawing responses as the original image MIME", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="drawing-raster" title="drawing-raster" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="file"/>
  <qti-item-body>
    <qti-drawing-interaction response-identifier="RESPONSE">
      <qti-prompt>Annotate the image.</qti-prompt>
      <object data="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAwUBAWoFfSAAAAAASUVORK5CYII=" type="image/png" width="100" height="60"/>
    </qti-drawing-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const surface = page.locator("qti-assessment-item-player .qti3-drawing-surface");
    await surface.focus();
    await page.keyboard.press("Enter");

    const response = await expectStringResponse(page, /^data:image\/png;base64,/);
    expect(response).not.toMatch(/timestamp/i);

    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    await page.locator("qti-assessment-item-player").evaluate((element, attemptState) => {
      element.reset();
      element.restore(attemptState);
    }, state);
    await expect(surface.locator("image")).toHaveAttribute("href", /^data:image\/png;base64,/);
    await expect(surface.locator("polyline")).toHaveCount(0);
  });

  test("embeds packaged drawing backgrounds in serialized SVG responses", async ({ page }) => {
    const zip = createStoredZip({
      "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="drawing" type="imsqti_item_xmlv3p0" href="items/drawing.xml">
      <file href="items/drawing.xml"/>
      <file href="items/assets/canvas.svg"/>
    </resource>
  </resources>
</manifest>`,
      "items/drawing.xml": `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="packaged-drawing" title="packaged-drawing" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="file"/>
  <qti-item-body>
    <qti-drawing-interaction response-identifier="RESPONSE">
      <qti-prompt>Annotate the packaged image.</qti-prompt>
      <object data="assets/canvas.svg" type="image/svg+xml" width="120" height="80"/>
    </qti-drawing-interaction>
  </qti-item-body>
</qti-assessment-item>`,
      "items/assets/canvas.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><rect width="120" height="80" fill="white"/></svg>`,
    });

    await page.goto("/");
    await page.locator("#file").setInputFiles({
      name: "drawing-package.zip",
      mimeType: "application/zip",
      buffer: zip,
    });

    await expect(page.locator("#file-summary")).toContainText("items/drawing.xml");
    const surface = page.locator("qti-assessment-item-player .qti3-drawing-surface");
    await surface.focus();
    await page.keyboard.press("Enter");

    const response = await expectStringResponse(page, /^data:image\/svg\+xml;charset=utf-8,/);
    const svg = decodeDataUrlText(response);
    expect(svg).toContain("data:image/svg+xml");
    expect(svg).not.toContain("blob:");
    expect(svg).not.toContain("assets/canvas.svg");
  });

  test("renders object-backed hotspot choices as positioned buttons", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "hotspot");

    const surface = page.locator("qti-assessment-item-player .qti3-hotspot-surface");
    await expect(surface).toBeVisible();
    await expect(surface.locator("img")).toHaveAttribute("src", "hotspot-flow.svg");
    await expectImageLoaded(surface.locator("img"));
    const hotspot = surface.getByRole("button", { name: "A" });
    await expect(hotspot).toHaveCSS("position", "absolute");
    const box = await surface.boundingBox();
    expect(box?.width).toBeGreaterThan(300);
    expect(box?.height).toBeGreaterThan(180);
    await hotspot.click();
    await expectResponse(page, "A");
    await expect(hotspot).toHaveAttribute("aria-pressed", "true");
    await expect(hotspot).toHaveAttribute("data-selected", "true");
    await expect(page.locator("qti-assessment-item-player .qti3-selection-summary")).toContainText(
      "Selected A",
    );

    await page.locator("#debug-score").click();
    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(state.outcomes.SCORE).toBe(1);
  });

  test("supports keyboard hotspot selection", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "hotspot");

    await page
      .locator("qti-assessment-item-player .qti3-hotspot-surface")
      .getByRole("button", {
        name: "A",
      })
      .focus();
    await page.keyboard.press("Enter");
    await expectResponse(page, "A");
    await expect(
      page.locator("qti-assessment-item-player .qti3-hotspot-button[data-choice-identifier='A']"),
    ).toHaveAttribute("data-selected", "true");
  });

  test("honors hotspot shared CSS vocabulary while preserving keyboard access", async ({
    page,
  }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="hotspot-shared-css" title="hotspot-shared-css" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <qti-hotspot-interaction
            class="qti-selections-dark qti-unselected-hidden"
            response-identifier="RESPONSE">
            <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='100'%3E%3Crect width='200' height='100' fill='white'/%3E%3C/svg%3E" alt="Blank target" width="200" height="100"/>
            <qti-hotspot-choice identifier="A" shape="rect" coords="10,10,90,70">A</qti-hotspot-choice>
          </qti-hotspot-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `,
    );

    const interaction = page.locator(".qti3-hotspot");
    await expect(interaction).toHaveClass(/qti-selections-dark/);
    await expect(interaction).toHaveClass(/qti-unselected-hidden/);

    const button = page.locator("qti-assessment-item-player").getByRole("button", { name: "A" });
    await expect(button).toHaveCSS("opacity", "0");
    await button.focus();
    await expect(button).not.toHaveCSS("opacity", "0");
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expectResponse(page, "A");
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
