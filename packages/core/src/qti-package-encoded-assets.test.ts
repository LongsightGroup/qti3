import { describe, expect, it } from "vitest";
import { discoverQtiPackageContentAssets } from "./index.js";

// Content URLs name package entries after percent decoding; query/fragment are URL metadata.
// These original fixtures exercise the package discovery API, not a writer round trip.
const item = (src: string) =>
  `<qti-assessment-item xmlns="https://purl.imsglobal.org/spec/qti/v3p0" identifier="MAP" title="Map" adaptive="false" time-dependent="false"><qti-item-body><p><img src="${src}" alt="Map"/></p></qti-item-body></qti-assessment-item>`;
describe("encoded package content URLs", () => {
  it("resolves escaped filenames and discards only URL suffixes", () => {
    for (const [url, path] of [
      ["map%20image.png?download=1#view", "items/map image.png"],
      ["map%23image.png", "items/map#image.png"],
      ["caf%C3%A9.png", "items/café.png"],
    ] as const) {
      expect(discoverQtiPackageContentAssets(item(url), "items/item.xml")).toEqual({
        hrefs: [path],
        diagnostics: [],
      });
    }
  });
  it("rejects malformed encodings, encoded absolute paths and escaping traversal", () => {
    for (const url of [
      "bad%ZZ.png",
      "%2Fprivate.png",
      "%68ttps%3Aexample.com/a.png",
      "..%2F..%2Fprivate.png",
      "%5Cprivate.png",
      "bad%00.png",
    ] as const) {
      const result = discoverQtiPackageContentAssets(item(url), "items/item.xml");
      expect(result.hrefs).toEqual([]);
      expect(result.diagnostics.some((d) => d.severity === "error")).toBe(true);
    }
  });
});
