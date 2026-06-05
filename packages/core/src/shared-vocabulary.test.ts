import { describe, expect, it } from "vitest";
import {
  formatSupportedGapInputWidthClasses,
  formatSupportedInputWidthClasses,
  gapInputWidthFromAttributes,
  inputWidthFromAttributes,
  isSupportedInputWidthClassName,
  SHARED_VOCABULARY_GAP_INPUT_WIDTHS,
  SHARED_VOCABULARY_INPUT_WIDTHS,
  supportedGapInputWidthClassNames,
  supportedInputWidthClassNames,
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

  it("reuses input width vocabulary for interaction controls", () => {
    expect(SHARED_VOCABULARY_INPUT_WIDTHS).toBe(SHARED_VOCABULARY_GAP_INPUT_WIDTHS);
    expect(inputWidthFromAttributes({ class: "qti-input-width-4 qti-input-width-20" })).toBe(4);
    expect(gapInputWidthFromAttributes).toBe(inputWidthFromAttributes);
    expect(inputWidthFromAttributes({ class: "qti-input-width-5" })).toBe(undefined);
    expect(supportedGapInputWidthClassNames).toBe(supportedInputWidthClassNames);
    expect(supportedInputWidthClassNames(["qti-input-width-4", "qti-input-width-5"])).toEqual([
      "qti-input-width-4",
    ]);
    expect(formatSupportedGapInputWidthClasses).toBe(formatSupportedInputWidthClasses);
    expect(isSupportedInputWidthClassName("qti-input-width-72")).toBe(true);
    expect(formatSupportedInputWidthClasses()).toContain("qti-input-width-50");
  });
});
