import { describe, expect, it } from "vitest";
import { isResolvableAssetUrl } from "./asset-url.js";

describe("isResolvableAssetUrl", () => {
  it("treats package-relative asset URLs as resolvable", () => {
    expect(isResolvableAssetUrl("items/picture.png")).toBe(true);
    expect(isResolvableAssetUrl("../materials/reference.txt")).toBe(true);
  });

  it("does not treat absolute or embedded asset URLs as resolvable", () => {
    expect(isResolvableAssetUrl("https://example.com/x")).toBe(false);
    expect(isResolvableAssetUrl("http://example.com/x")).toBe(false);
    expect(isResolvableAssetUrl("data:image/png;base64,abc")).toBe(false);
    expect(isResolvableAssetUrl("blob:https://example.com/x")).toBe(false);
    expect(isResolvableAssetUrl("#fragment")).toBe(false);
  });
});
