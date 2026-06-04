import { describe, expect, it } from "vitest";
import {
  formatSupportedGapInputWidthClasses,
  gapInputWidthFromAttributes,
  supportedGapInputWidthClassNames,
} from "./shared-vocabulary.js";

describe("shared vocabulary", () => {
  it("parses supported gap input width classes", () => {
    expect(gapInputWidthFromAttributes({ class: "qti-input-width-10 qti-input-width-3" })).toBe(10);
    expect(gapInputWidthFromAttributes({ class: "qti-input-width-8" })).toBe(undefined);
    expect(gapInputWidthFromAttributes({ class: "qti-gap-placement" })).toBe(undefined);
  });

  it("lists supported gap input width class names", () => {
    expect(
      supportedGapInputWidthClassNames([
        "qti-input-width-10",
        "qti-input-width-3",
        "qti-gap-placement",
      ]),
    ).toEqual(["qti-input-width-10", "qti-input-width-3"]);
    expect(formatSupportedGapInputWidthClasses()).toContain("qti-input-width-72");
  });
});
