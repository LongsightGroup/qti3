import { expect, it } from "vitest";
import { mapImageSourceSet } from "./image-source-set.js";
import { parseAuthoredAssetUrl } from "./asset-url-policy.js";

it("resolves every picture candidate while retaining descriptors", () => {
  expect(mapImageSourceSet("one.png 1x, two.png 2x", (url) => `/assets/${url}`)).toBe(
    "/assets/one.png 1x, /assets/two.png 2x",
  );
  expect(
    mapImageSourceSet("data:image/png;base64,abcd 1x, two.png 2x", (url) =>
      parseAuthoredAssetUrl(url, "image"),
    ),
  ).toBe("data:image/png;base64,abcd 1x, two.png 2x");
  expect(
    mapImageSourceSet("one.png 1x, javascript:alert(1) 2x", (url) =>
      parseAuthoredAssetUrl(url, "image"),
    ),
  ).toBeUndefined();
});
