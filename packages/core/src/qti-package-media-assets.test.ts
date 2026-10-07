import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { createStoredZip } from "../../../tests/fixtures/package-zip.js";
import { validQtiDocument } from "../../../tests/fixtures/valid-qti-document.js";
import { parseQtiPackage } from "./index.js";

const itemXml = readFileSync(
  new URL("../../../tests/fixtures/media-assets/packaged-video.xml", import.meta.url),
  "utf8",
);
const manifest =
  '<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="media"><resources><resource identifier="item" type="imsqti_item_xmlv3p0" href="items/media.xml"><file href="items/media.xml"/></resource></resources></manifest>';

// HTML video poster URLs identify image assets, independently of the video source.
// https://html.spec.whatwg.org/multipage/media.html#attr-video-poster
it("inventories a poster referenced only in item content beside the video and captions", () => {
  validQtiDocument(itemXml);
  const result = parseQtiPackage(
    createStoredZip({
      "imsmanifest.xml": manifest,
      "items/media.xml": itemXml,
      "items/media/poster.svg": '<svg xmlns="http://www.w3.org/2000/svg"/>',
      "items/media/clip.mp4": "synthetic unused video bytes",
      "items/captions/clip.vtt": "WEBVTT\n",
    }),
  );
  expect(result.ok).toBe(true);
  expect(result.diagnostics).toEqual([]);
  expect(result.items[0]?.assetHrefs.toSorted()).toEqual([
    "items/captions/clip.vtt",
    "items/media/clip.mp4",
    "items/media/poster.svg",
  ]);
  expect(result.assets.map((asset) => asset.href).toSorted()).toEqual([
    "items/captions/clip.vtt",
    "items/media/clip.mp4",
    "items/media/poster.svg",
  ]);
});

it("reports an absent poster instead of publishing a package with undiscovered missing content", () => {
  validQtiDocument(itemXml);
  const result = parseQtiPackage(
    createStoredZip({
      "imsmanifest.xml": manifest,
      "items/media.xml": itemXml,
      "items/media/clip.mp4": "synthetic unused video bytes",
      "items/captions/clip.vtt": "WEBVTT\n",
    }),
  );
  expect(result.ok).toBe(false);
  expect(result.diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "package.asset.missing",
        severity: "error",
        path: "items/media/poster.svg",
      }),
    ]),
  );
});
