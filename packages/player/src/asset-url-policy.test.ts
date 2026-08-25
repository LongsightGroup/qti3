import { describe, expect, it } from "vitest";
import { parseAuthoredAssetUrl, parseResolvedAssetUrl } from "./asset-url-policy.js";

describe("authored asset URL policy", () => {
  it.each(["asset.png", "./asset.png", "../asset.png", "/assets/item.png", "?version=1"])(
    "accepts package and same-origin path %s",
    (value) => {
      expect(parseAuthoredAssetUrl(value, "image")).toBe(value);
    },
  );

  it("normalizes harmless surrounding whitespace", () => {
    expect(parseAuthoredAssetUrl("  images/item.png  ", "image")).toBe("images/item.png");
  });

  it.each([
    "//attacker.example/image.png",
    "\\\\attacker.example\\image.png",
    "/\\attacker.example/image.png",
    "javascript:alert(1)",
    "java\nscript:alert(1)",
    "file:///etc/passwd",
    "data:text/html,<script>alert(1)</script>",
  ])("rejects ambiguous or executable URL %s", (value) => {
    expect(parseAuthoredAssetUrl(value, "image")).toBeUndefined();
    expect(parseAuthoredAssetUrl(value, "navigation")).toBeUndefined();
  });

  it("applies data URL policy by sink", () => {
    const svg = "data:image/svg+xml,%3Csvg/%3E";
    expect(parseAuthoredAssetUrl(svg, "image")).toBe(svg);
    expect(parseAuthoredAssetUrl(svg, "object")).toBeUndefined();
    expect(parseAuthoredAssetUrl(svg, "navigation")).toBeUndefined();
    expect(parseAuthoredAssetUrl("data:audio/wav;base64,AA==", "media")).toBe(
      "data:audio/wav;base64,AA==",
    );
    expect(parseAuthoredAssetUrl("data:audio/wav;base64,AA==", "image")).toBeUndefined();
  });

  it("allows blob URLs only after trusted host resolution", () => {
    expect(parseAuthoredAssetUrl("blob:https://example.com/id", "image")).toBeUndefined();
    expect(parseResolvedAssetUrl("blob:https://example.com/id", "image")).toBe(
      "blob:https://example.com/id",
    );
  });
});
