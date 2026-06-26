import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { interactionFixtures } from "../../packages/fixtures/src/index.js";
import {
  createStoredZip,
  createDeflatedZip,
  dragCenter,
  expectImageLoaded,
  expectResponse,
} from "./player-helpers.js";

test.describe("player package loading", () => {
  test("attaches host-resolved qti-stylesheet resources during item rendering", async ({
    page,
  }) => {
    await page.goto("/");
    const xml = stylesheetEvidenceXml();

    await page.locator("qti-assessment-item-player").evaluate(async (element, itemXml) => {
      await (
        element as HTMLElement & {
          loadXml: (
            xml: string,
            options?: {
              resolveStylesheet?: (stylesheet: {
                href: string;
                type?: string;
                media?: string;
                title?: string;
              }) => { href: string; type?: string; media?: string; title?: string };
            },
          ) => Promise<void>;
        }
      ).loadXml(itemXml, {
        resolveStylesheet: (stylesheet) => ({
          href: `data:text/css,${encodeURIComponent(
            ".qti3-extra-evidence { border-left: 6px solid rgb(12, 34, 56); padding-left: 4px; }",
          )}`,
          type: stylesheet.type,
          media: stylesheet.media,
          title: stylesheet.title,
        }),
      });
    }, xml);

    const stylesheet = page.locator('qti-assessment-item-player link[rel="stylesheet"]');
    await expect(stylesheet).toHaveAttribute("href", /^data:text\/css/);
    await expect(stylesheet).toHaveAttribute("type", "text/css");
    await expect(stylesheet).toHaveAttribute("media", "screen");
    await expect(stylesheet).toHaveAttribute("title", "Evidence styles");

    await expect
      .poll(async () =>
        page.locator("qti-assessment-item-player .qti3-extra-evidence").evaluate((element) => {
          return getComputedStyle(element).borderLeftWidth;
        }),
      )
      .toBe("6px");
  });

  test("does not attach declined qti-stylesheet resources", async ({ page }) => {
    await page.goto("/");
    const xml = stylesheetEvidenceXml();

    const diagnostics = await page
      .locator("qti-assessment-item-player")
      .evaluate(async (element, itemXml) => {
        const player = element as HTMLElement & {
          loadXml: (
            xml: string,
            options?: { resolveStylesheet?: () => undefined },
          ) => Promise<void>;
        };
        const seen: Array<{ code: string; severity: string }> = [];
        element.addEventListener("qti-diagnostics", (event) => {
          seen.push(
            ...((event as CustomEvent<{ diagnostics: Array<{ code: string; severity: string }> }>)
              .detail.diagnostics ?? []),
          );
        });
        await player.loadXml(itemXml, { resolveStylesheet: () => undefined });
        return seen;
      }, xml);

    await expect(page.locator('qti-assessment-item-player link[rel="stylesheet"]')).toHaveCount(0);
    await expect
      .poll(async () =>
        page.locator("qti-assessment-item-player .qti3-extra-evidence").evaluate((element) => {
          return getComputedStyle(element).borderLeftWidth;
        }),
      )
      .toBe("0px");
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "player.stylesheet.unresolved",
          severity: "warning",
        }),
      ]),
    );
  });

  test("resolves packaged media sources and tracks from a zip upload", async ({ page }) => {
    const zip = createStoredZip({
      "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="media" type="imsqti_item_xmlv3p0" href="items/media.xml">
      <file href="items/media.xml"/>
      <file href="items/media/clip.mp4"/>
      <file href="items/captions/clip.vtt"/>
    </resource>
  </resources>
</manifest>`,
      "items/media.xml": `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="packaged-media" title="packaged-media" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
  <qti-item-body>
    <qti-media-interaction response-identifier="RESPONSE" autostart="false">
      <qti-prompt>Play the packaged clip.</qti-prompt>
      <video width="320" height="180">
        <source src="media/clip.mp4" type="video/mp4"/>
        <track kind="captions" src="captions/clip.vtt" srclang="en" label="English"/>
      </video>
    </qti-media-interaction>
  </qti-item-body>
</qti-assessment-item>`,
      "items/media/clip.mp4": Buffer.from("not-real-mp4"),
      "items/captions/clip.vtt": Buffer.from("WEBVTT\n\n00:00.000 --> 00:01.000\nCaption\n"),
    });

    await page.goto("/");
    await page.locator("#file").setInputFiles({
      name: "media-package.zip",
      mimeType: "application/zip",
      buffer: zip,
    });

    await expect(page.locator("#file-summary")).toContainText("items/media.xml");
    const video = page.locator("qti-assessment-item-player video");
    await expect(video.locator("source")).toHaveAttribute("src", /^blob:/);
    await expect(video.locator("track")).toHaveAttribute("src", /^blob:/);
  });

  test("requires a single zip upload for local package loading", async ({ page }) => {
    const choice = interactionFixtures.find((item) => item.interactionType === "choice");
    const textEntry = interactionFixtures.find((item) => item.interactionType === "textEntry");
    if (!choice || !textEntry) throw new Error("Missing local-file fixtures.");

    await page.goto("/");
    await expect(page.locator("#file")).not.toHaveAttribute("multiple", "");
    await expect(page.locator("#file")).toHaveAttribute("accept", /\.zip/);
    await page.locator("#file").setInputFiles({
      name: "choice-reference.xml",
      mimeType: "application/xml",
      buffer: Buffer.from(choice.xml),
    });

    await expect(page.locator("#file-summary")).toContainText("No QTI package loaded");

    const zip = createStoredZip({
      "items/choice.xml": choice.xml,
      "items/text-entry.xml": textEntry.xml,
    });
    await page.locator("#file").setInputFiles({
      name: "loose-items.zip",
      mimeType: "application/zip",
      buffer: zip,
    });

    await expect(page.locator("#file-summary")).toContainText("1 of 2");
    await expect(page.locator("qti-assessment-item-player")).toContainText(
      "A civics item asks the student to choose the strongest evidence for a local-news claim.",
    );
    await expect(page.locator("#debug-package")).toContainText('"status": "loaded"');
    await expect(page.locator("#debug-package")).toContainText('"items/choice.xml"');
    await expect(page.locator("#debug-package")).toContainText(
      '"selectedItem": "items/choice.xml"',
    );
    await expect(page.locator("#debug-action-log")).toContainText("package-load");
    await page.locator("#next-file").click();
    await expect(page.locator("#file-summary")).toContainText("2 of 2");
    await expect(page.locator("qti-assessment-item-player")).toContainText(
      "A geography vocabulary item asks the student to type the name of a coastal feature.",
    );
    await expect(page.locator("#debug-package")).toContainText(
      '"selectedItem": "items/text-entry.xml"',
    );
    await page.locator("#previous-file").click();
    await expect(page.locator("#file-summary")).toContainText("1 of 2");
  });

  test("resolves assessment-test package item references from a zip upload", async ({ page }) => {
    const choice = interactionFixtures.find((item) => item.interactionType === "choice");
    const textEntry = interactionFixtures.find((item) => item.interactionType === "textEntry");
    if (!choice || !textEntry) throw new Error("Missing package fixtures.");

    const zip = createStoredZip({
      "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="test-1" type="imsqti_test_xmlv3p0" href="assessment.xml">
      <file href="assessment.xml"/>
    </resource>
    <resource identifier="choice" type="imsqti_item_xmlv3p0" href="items/choice.xml">
      <file href="items/choice.xml"/>
    </resource>
    <resource identifier="text" type="imsqti_item_xmlv3p0" href="items/text-entry.xml">
      <file href="items/text-entry.xml"/>
    </resource>
  </resources>
</manifest>`,
      "assessment.xml": `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="test" title="US Presidents Sampler">
  <qti-test-part identifier="part-1" navigation-mode="nonlinear" submission-mode="individual">
    <qti-assessment-section identifier="section-1" visible="true">
      <qti-assessment-item-ref identifier="choice-ref" href="items/choice.xml"/>
      <qti-assessment-item-ref identifier="text-ref" href="items/text-entry.xml"/>
    </qti-assessment-section>
  </qti-test-part>
</qti-assessment-test>`,
      "items/choice.xml": choice.xml,
      "items/text-entry.xml": textEntry.xml,
    });

    await page.goto("/");
    await page.locator("#file").setInputFiles({
      name: "presidents-qti.zip",
      mimeType: "application/zip",
      buffer: zip,
    });

    await expect(page.locator("#file-summary")).toContainText("1 of 2");
    await expect(page.locator("#file-summary")).toContainText("items/choice.xml");
    await expect(page.locator("qti-assessment-item-player")).toContainText(
      "A civics item asks the student to choose the strongest evidence for a local-news claim.",
    );
    await page.locator("#next-file").click();
    await expect(page.locator("#file-summary")).toContainText("2 of 2");
    await expect(page.locator("#file-summary")).toContainText("items/text-entry.xml");
    await expect(page.locator("qti-assessment-item-player")).toContainText(
      "A geography vocabulary item asks the student to type the name of a coastal feature.",
    );
  });

  test("loads ordinary deflated package zips", async ({ page }) => {
    const choice = interactionFixtures.find((item) => item.interactionType === "choice");
    if (!choice) throw new Error("Missing package fixture.");

    const zip = createDeflatedZip({
      "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="choice" type="imsqti_item_xmlv3p0" href="items/choice.xml">
      <file href="items/choice.xml"/>
    </resource>
  </resources>
</manifest>`,
      "items/choice.xml": choice.xml,
    });

    await page.goto("/");
    await page.locator("#file").setInputFiles({
      name: "deflated-package.zip",
      mimeType: "application/zip",
      buffer: zip,
    });

    await expect(page.locator("#file-summary")).toContainText("1 of 1");
    await expect(page.locator("#file-summary")).toContainText("items/choice.xml");
    await expect(page.locator("qti-assessment-item-player")).toContainText(
      "A civics item asks the student to choose the strongest evidence for a local-news claim.",
    );
  });

  test("reports unreadable package zips", async ({ page }) => {
    await page.goto("/");
    await page.locator("#file").setInputFiles({
      name: "broken.zip",
      mimeType: "application/zip",
      buffer: Buffer.from("not a zip"),
    });

    await expect(page.locator("#file-summary")).toContainText("Unable to read QTI package");
    await expect(page.locator("#file-summary")).toContainText("No ZIP central directory");
    await expect(page.locator("#debug-package")).toContainText('"status": "error"');
    await expect(page.locator("#debug-package")).toContainText("No ZIP central directory");
    await expect(page.locator("#debug-action-log")).toContainText("package-error");
  });

  test("rejects package zip entries that escape the package root", async ({ page }) => {
    const choice = interactionFixtures.find((item) => item.interactionType === "choice");
    if (!choice) throw new Error("Missing package fixture.");

    const zip = createStoredZip({
      "../items/choice.xml": choice.xml,
    });

    await page.goto("/");
    await page.locator("#file").setInputFiles({
      name: "escaping-package.zip",
      mimeType: "application/zip",
      buffer: zip,
    });

    await expect(page.locator("#file-summary")).toContainText("Unable to read QTI package");
    await expect(page.locator("#file-summary")).toContainText(
      "ZIP entry ../items/choice.xml escapes the package root",
    );
  });

  test("reports package item references that escape the package root", async ({ page }) => {
    const choice = interactionFixtures.find((item) => item.interactionType === "choice");
    if (!choice) throw new Error("Missing package fixture.");

    const zip = createStoredZip({
      "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="choice" type="imsqti_item_xmlv3p0" href="../items/choice.xml">
      <file href="../items/choice.xml"/>
    </resource>
  </resources>
</manifest>`,
      "items/choice.xml": choice.xml,
    });

    await page.goto("/");
    await page.locator("#file").setInputFiles({
      name: "escaping-reference.zip",
      mimeType: "application/zip",
      buffer: zip,
    });

    await expect(page.locator("#file-summary")).toContainText("Unable to read QTI package");
    await expect(page.locator("#file-summary")).toContainText(
      "package reference ../items/choice.xml escapes the package root",
    );
  });

  test("reports package item references that do not exist", async ({ page }) => {
    const zip = createStoredZip({
      "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="choice" type="imsqti_item_xmlv3p0" href="items/missing.xml"/>
  </resources>
</manifest>`,
    });

    await page.goto("/");
    await page.locator("#file").setInputFiles({
      name: "missing-reference.zip",
      mimeType: "application/zip",
      buffer: zip,
    });

    await expect(page.locator("#file-summary")).toContainText("Unable to read QTI package");
    await expect(page.locator("#file-summary")).toContainText(
      "Package item reference items/missing.xml was not found",
    );
  });

  test("discovers manifest item resources from nested file hrefs", async ({ page }) => {
    const choice = interactionFixtures.find((item) => item.interactionType === "choice");
    if (!choice) throw new Error("Missing package fixture.");

    const zip = createStoredZip({
      "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="choice" type="imsqti_item_xmlv3p0p1">
      <file href="items/choice.xml"/>
    </resource>
  </resources>
</manifest>`,
      "items/choice.xml": choice.xml,
    });

    await page.goto("/");
    await page.locator("#file").setInputFiles({
      name: "manifest-file-href.zip",
      mimeType: "application/zip",
      buffer: zip,
    });

    await expect(page.locator("#file-summary")).toContainText("1 of 1");
    await expect(page.locator("#file-summary")).toContainText("items/choice.xml");
    await expect(page.locator("qti-assessment-item-player")).toContainText(
      "A civics item asks the student to choose the strongest evidence for a local-news claim.",
    );
  });

  test("resolves relative item assets from a zip upload", async ({ page }) => {
    const graphicOrder = interactionFixtures.find(
      (item) => item.interactionType === "graphicOrder",
    );
    if (!graphicOrder) throw new Error("Missing graphic order fixture.");
    const diagram = await readFile("examples/manual/public/hotspot-flow-unlabeled.svg");

    const zip = createStoredZip({
      "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="graphic-order" type="imsqti_item_xmlv3p0" href="items/graphic-order.xml">
      <file href="items/graphic-order.xml"/>
      <file href="items/hotspot-flow-unlabeled.svg"/>
    </resource>
  </resources>
</manifest>`,
      "items/graphic-order.xml": graphicOrder.xml,
      "items/hotspot-flow-unlabeled.svg": diagram,
    });

    await page.goto("/");
    await page.locator("#file").setInputFiles({
      name: "graphic-package.zip",
      mimeType: "application/zip",
      buffer: zip,
    });

    await expect(page.locator("#file-summary")).toContainText("items/graphic-order.xml");
    const image = page.locator("qti-assessment-item-player .qti3-graphic-order-surface img");
    await expect(image).toHaveAttribute("src", /^blob:/);
    await expectImageLoaded(image);
  });

  test("resolves packaged graphic gap images created after assignment", async ({ page }) => {
    const targetSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="326" viewBox="0 0 560 326"><rect width="560" height="326" fill="#f5f1e8"/><rect x="55" y="256" width="78" height="63" fill="#d8cab8" stroke="#3f4d5a" stroke-width="2"/></svg>`;
    const draggerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="78" height="63" viewBox="0 0 78 63"><rect width="78" height="63" rx="4" fill="#fff" stroke="#3f4d5a" stroke-width="3"/><path d="M12 44h54" stroke="#b65f2d" stroke-width="5"/><text x="39" y="30" text-anchor="middle" font-size="16" font-family="sans-serif" fill="#3f4d5a">D</text></svg>`;

    const zip = createStoredZip({
      "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="graphic-gap" type="imsqti_item_xmlv3p0" href="items/graphic-gap.xml">
      <file href="items/graphic-gap.xml"/>
      <file href="items/images/background.svg"/>
      <file href="items/images/d-bay.svg"/>
    </resource>
  </resources>
</manifest>`,
      "items/graphic-gap.xml": `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="packaged-graphic-gap" title="packaged-graphic-gap" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-graphic-gap-match-interaction response-identifier="RESPONSE">
      <object data="images/background.svg" alt="Bay target map." type="image/svg+xml" width="560" height="326"/>
      <qti-gap-img identifier="DraggerD" match-max="1">
        <img alt="d-bay" height="63" src="images/d-bay.svg" width="78"/>
      </qti-gap-img>
      <qti-associable-hotspot identifier="A" shape="rect" coords="55,256,133,319" match-max="1"/>
    </qti-graphic-gap-match-interaction>
  </qti-item-body>
</qti-assessment-item>`,
      "items/images/background.svg": targetSvg,
      "items/images/d-bay.svg": draggerSvg,
    });

    await page.goto("/");
    await page.locator("#file").setInputFiles({
      name: "graphic-gap-package.zip",
      mimeType: "application/zip",
      buffer: zip,
    });

    await expect(page.locator("#file-summary")).toContainText("items/graphic-gap.xml");
    const source = page
      .locator("qti-assessment-item-player .qti3-graphic-gap-source-region")
      .getByRole("button", { name: "d-bay" });
    await expect(source.locator("img")).toHaveAttribute("src", /^blob:/);
    await expectImageLoaded(source.locator("img"));

    const target = page.locator('qti-assessment-item-player [data-gap-identifier="A"]');
    await dragCenter(page, source, target);
    await expectResponse(page, ["DraggerD A"]);
    await expect(target).toHaveAccessibleName("Target 1, assigned d-bay");

    const assignedImage = page.locator(
      'qti-assessment-item-player [data-origin-gap-identifier="A"].qti3-graphic-gap-label img',
    );
    await expect(assignedImage).toHaveAttribute("src", /^blob:/);
    await expectImageLoaded(assignedImage);
  });
});

function stylesheetEvidenceXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="stylesheet-evidence" title="stylesheet-evidence" time-dependent="false">
  <qti-stylesheet href="../styles/extra.css" type="text/css" media="screen" title="Evidence styles"/>
  <qti-item-body>
    <p class="qti3-extra-evidence">Stylesheet delivery evidence.</p>
  </qti-item-body>
</qti-assessment-item>`;
}
