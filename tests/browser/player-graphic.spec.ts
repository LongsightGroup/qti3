import { expect, test } from "@playwright/test";
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
import { graySvgDataUrl } from "./player-graphic-gap-fixtures.js";

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
        const hotspot = surface.locator("button.qti3-hotspot-button").first();
        await expect(hotspot, interactionType).toHaveCSS("border-top-width", "2px");
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

    const itemXmlButton = surface.getByRole("button", { name: "Item XML" });
    await expect(itemXmlButton).toHaveCSS("border-top-width", "2px");
    await itemXmlButton.focus();
    await expect(itemXmlButton).toHaveCSS("outline-width", "3px");
    await itemXmlButton.click();
    await expect(itemXmlButton).toHaveAttribute("aria-pressed", "true");
    await expect(itemXmlButton).toHaveAttribute("data-selected", "true");
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

  test("rejects graphic associate pairings beyond authored max-associations", async ({ page }) => {
    await page.goto("/");
    const timelineSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="260" viewBox="0 0 480 260"><rect width="480" height="260" fill="#f4f2ea"/><circle cx="120" cy="90" r="18" fill="#2f4858"/><circle cx="120" cy="170" r="18" fill="#2f4858"/><circle cx="360" cy="90" r="18" fill="#8b5d33"/><circle cx="360" cy="170" r="18" fill="#496b42"/></svg>`;
    const image = `data:image/svg+xml,${encodeURIComponent(timelineSvg)}`;
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="graphic-associate-authored-max" title="graphic-associate-authored-max" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="pair"/>
  <qti-item-body>
    <qti-graphic-associate-interaction response-identifier="RESPONSE" max-associations="2" data-max-selections-message="Too many pairings.">
      <object data="${image}" type="image/png">Timeline graphic with paired era markers.</object>
      <qti-associable-hotspot identifier="A" shape="circle" coords="120,90,18" match-max="1"/>
      <qti-associable-hotspot identifier="B" shape="circle" coords="120,170,18" match-max="1"/>
      <qti-associable-hotspot identifier="C" shape="circle" coords="360,90,18" match-max="1"/>
      <qti-associable-hotspot identifier="D" shape="circle" coords="360,170,18" match-max="1"/>
    </qti-graphic-associate-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const interaction = page.locator("qti-assessment-item-player .qti3-graphicAssociate");
    const surface = interaction.locator(".qti3-graphic-associate-surface");
    const validation = interaction.locator('[data-validation-for="RESPONSE"]');

    await surface.getByRole("button", { name: "Region 1" }).click();
    await surface.getByRole("button", { name: "Region 2" }).click();
    await surface.getByRole("button", { name: "Region 3" }).click();
    await surface.getByRole("button", { name: "Region 4" }).click();
    await expectResponse(page, ["A B", "C D"]);

    await surface.getByRole("button", { name: "Region 1" }).click();
    await surface.getByRole("button", { name: "Region 3" }).click();
    await expectResponse(page, ["A B", "C D"]);
    await expect(validation).toBeVisible();
    await expect(validation).toContainText("Too many pairings.");
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

  test("rejects graphic order selections beyond authored max-choices", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="graphic-order-authored-max" title="graphic-order-authored-max" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="ordered" base-type="identifier"/>
  <qti-item-body>
    <qti-graphic-order-interaction response-identifier="RESPONSE" min-choices="1" max-choices="1" data-max-selections-message="Only one ordered region.">
      <object data="${graySvgDataUrl(220, 120)}" alt="Two ordered regions." type="image/svg+xml" width="220" height="120"/>
      <qti-hotspot-choice identifier="A" shape="rect" coords="20,20,90,90"/>
      <qti-hotspot-choice identifier="B" shape="rect" coords="130,20,200,90"/>
    </qti-graphic-order-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const interaction = page.locator("qti-assessment-item-player .qti3-graphicOrder");
    const first = interaction.locator(".qti3-graphic-order-hotspot[data-choice-identifier='A']");
    const second = interaction.locator(".qti3-graphic-order-hotspot[data-choice-identifier='B']");

    await first.click();
    await second.click();

    await expectResponse(page, ["A"]);
    await expect(first).toHaveAttribute("aria-pressed", "true");
    await expect(second).toHaveAttribute("aria-pressed", "false");
    await expect(interaction.locator('[data-validation-for="RESPONSE"]')).toContainText(
      "Only one ordered region.",
    );
  });

  test("rejects hotspot selections beyond authored max-choices", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="hotspot-authored-max" title="hotspot-authored-max" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="identifier"/>
  <qti-item-body>
    <qti-hotspot-interaction response-identifier="RESPONSE" max-choices="1" data-max-selections-message="Only one region.">
      <object data="${graySvgDataUrl(220, 120)}" alt="Two target regions." type="image/svg+xml" width="220" height="120"/>
      <qti-hotspot-choice identifier="A" shape="rect" coords="20,20,90,90"/>
      <qti-hotspot-choice identifier="B" shape="rect" coords="130,20,200,90"/>
    </qti-hotspot-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const interaction = page.locator("qti-assessment-item-player .qti3-hotspot");
    const first = interaction.locator(".qti3-hotspot-button[data-choice-identifier='A']");
    const second = interaction.locator(".qti3-hotspot-button[data-choice-identifier='B']");

    await first.click();
    await second.click();

    await expectResponse(page, ["A"]);
    await expect(first).toHaveAttribute("aria-pressed", "true");
    await expect(second).toHaveAttribute("aria-pressed", "false");
    await expect(interaction.locator('[data-validation-for="RESPONSE"]')).toContainText(
      "Only one region.",
    );
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

  test("renders object-backed hotspot choices as SVG shapes", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "hotspot");

    const surface = page.locator("qti-assessment-item-player .qti3-hotspot-surface");
    await expect(surface).toBeVisible();
    await expect(surface.locator("img")).toHaveAttribute("src", "hotspot-flow.svg");
    await expectImageLoaded(surface.locator("img"));
    await expect(surface.locator("button.qti3-hotspot-button")).toHaveCount(0);
    await expect(surface.locator(".qti3-hotspot-overlay")).toHaveAttribute(
      "viewBox",
      "0 0 480 300",
    );
    await expect(surface.locator("rect.qti3-hotspot-button")).toHaveCount(3);

    const hotspot = surface.getByRole("button", { name: "A" });
    await expect(hotspot).toHaveAttribute("data-shape", "rect");
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

  test("reports invalid hotspot geometry instead of silently omitting choices", async ({
    page,
  }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="invalid-hotspot-geometry" title="invalid-hotspot-geometry" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <qti-hotspot-interaction response-identifier="RESPONSE">
            <img src="${graySvgDataUrl(100, 100)}" alt="Invalid hotspot target." width="100" height="100"/>
            <qti-hotspot-choice identifier="GOOD" shape="rect" coords="10,10,40,40">Good</qti-hotspot-choice>
            <qti-hotspot-choice identifier="BAD" shape="rect" coords=""/>
          </qti-hotspot-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `,
    );

    const surface = page.locator("qti-assessment-item-player .qti3-hotspot-surface");
    await expect(surface.locator("rect.qti3-hotspot-button")).toHaveCount(1);
    await expect(
      page.getByText('Hotspot choice "BAD" has invalid or unsupported geometry'),
    ).toBeVisible();
  });

  test("matches hotspot hit areas to authored circle and polygon geometry", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="mixed-hotspot-shapes" title="mixed-hotspot-shapes" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
          <qti-correct-response><qti-value>P</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
          <qti-default-value><qti-value>0</qti-value></qti-default-value>
        </qti-outcome-declaration>
        <qti-item-body>
          <qti-hotspot-interaction response-identifier="RESPONSE">
            <img src="${graySvgDataUrl(100, 100)}" alt="Mixed hotspot target." width="100" height="100"/>
            <qti-hotspot-choice identifier="R" shape="rect" coords="10,10,40,40"/>
            <qti-hotspot-choice identifier="C" shape="circle" coords="70,25,15"/>
            <qti-hotspot-choice identifier="P" shape="poly" coords="10,80,50,50,90,80"/>
          </qti-hotspot-interaction>
        </qti-item-body>
        <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
      </qti-assessment-item>
    `,
    );

    const surface = page.locator("qti-assessment-item-player .qti3-hotspot-surface");
    await expect(surface.locator("rect.qti3-hotspot-button")).toHaveCount(1);
    await expect(surface.locator("circle.qti3-hotspot-button")).toHaveCount(1);
    await expect(surface.locator("path.qti3-hotspot-button")).toHaveCount(1);
    await expect(surface.locator("path[data-choice-identifier='P']")).toHaveAttribute(
      "d",
      "M 10 80 L 50 50 L 90 80 Z",
    );

    const box = await surface.boundingBox();
    if (!box) throw new Error("Missing hotspot surface box.");
    const clickAuthoredPoint = async (x: number, y: number) => {
      await page.mouse.click(box.x + (x / 100) * box.width, box.y + (y / 100) * box.height);
    };

    await clickAuthoredPoint(15, 55);
    await expectResponse(page, undefined);

    await clickAuthoredPoint(70, 25);
    await expectResponse(page, "C");

    await clickAuthoredPoint(50, 70);
    await expectResponse(page, "P");
    await expect(surface.locator("path[data-choice-identifier='P']")).toHaveAttribute(
      "aria-pressed",
      "true",
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
});
