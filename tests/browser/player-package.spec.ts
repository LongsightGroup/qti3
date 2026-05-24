import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { interactionFixtures } from "../../packages/fixtures/src/index.js";
import { createStoredZip, createDeflatedZip, expectImageLoaded } from "./player-helpers.js";

test.describe("player package loading", () => {
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
      "Select one answer from a standard single-choice interaction.",
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
      "Type a short QTI outcome name in the sentence.",
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
      "Select one answer from a standard single-choice interaction.",
    );
    await page.locator("#next-file").click();
    await expect(page.locator("#file-summary")).toContainText("2 of 2");
    await expect(page.locator("#file-summary")).toContainText("items/text-entry.xml");
    await expect(page.locator("qti-assessment-item-player")).toContainText(
      "Type a short QTI outcome name in the sentence.",
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
      "Select one answer from a standard single-choice interaction.",
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
      "Select one answer from a standard single-choice interaction.",
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
});
