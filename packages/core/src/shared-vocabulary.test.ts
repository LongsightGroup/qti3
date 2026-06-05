import { describe, expect, it } from "vitest";
import {
  extendedTextCounterPosition,
  extendedTextCounterPositionFromAttributes,
  extendedTextHeightLines,
  extendedTextHeightLinesFromAttributes,
  formatSupportedExtendedTextCounterClasses,
  formatSupportedExtendedTextHeightLinesClasses,
  formatSupportedGapInputWidthClasses,
  formatSupportedInputWidthClasses,
  gapInputWidthFromAttributes,
  isSupportedExtendedTextCounterClassName,
  isSupportedExtendedTextHeightLinesClassName,
  inputWidthFromAttributes,
  isSupportedInputWidthClassName,
  SHARED_VOCABULARY_EXTENDED_TEXT_COUNTER_CLASSES,
  SHARED_VOCABULARY_EXTENDED_TEXT_HEIGHT_LINES,
  SHARED_VOCABULARY_GAP_INPUT_WIDTHS,
  SHARED_VOCABULARY_INPUT_WIDTHS,
  supportedExtendedTextCounterClassNames,
  supportedExtendedTextHeightLinesClassNames,
  supportedGapInputWidthClassNames,
  supportedInputWidthClassNames,
} from "./shared-vocabulary.js";
import type { QtiInteraction } from "./types.js";

function extendedTextInteraction(attributes: Record<string, string> = {}): QtiInteraction {
  return {
    type: "extendedText",
    qtiName: "qti-extended-text-interaction",
    responseIdentifier: "RESPONSE",
    responseCardinality: "single",
    responseBaseType: "string",
    choices: [],
    childElements: [],
    attributes,
    text: "",
  };
}

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

  it("parses supported extended text height line classes from attributes", () => {
    expect(
      extendedTextHeightLinesFromAttributes({
        class: "qti-counter-up qti-height-lines-6 qti-height-lines-15",
        "expected-lines": "4",
      }),
    ).toBe(6);
    expect(extendedTextHeightLinesFromAttributes({ class: "qti-height-lines-4" })).toBe(undefined);
    expect(extendedTextHeightLinesFromAttributes({ "expected-lines": "6" })).toBe(undefined);
    expect(
      extendedTextHeightLines(
        extendedTextInteraction({
          class: "qti-counter-up qti-height-lines-6 qti-height-lines-15",
          "expected-lines": "4",
        }),
      ),
    ).toBe(6);
  });

  it("lists supported extended text height line class names", () => {
    expect(SHARED_VOCABULARY_EXTENDED_TEXT_HEIGHT_LINES).toEqual([3, 6, 15]);
    expect(
      supportedExtendedTextHeightLinesClassNames([
        "qti-height-lines-6",
        "qti-height-lines-4",
        "qti-counter-up",
        "qti-height-lines-15",
      ]),
    ).toEqual(["qti-height-lines-6", "qti-height-lines-15"]);
    expect(isSupportedExtendedTextHeightLinesClassName("qti-height-lines-15")).toBe(true);
    expect(isSupportedExtendedTextHeightLinesClassName("qti-height-lines-4")).toBe(false);
    expect(formatSupportedExtendedTextHeightLinesClasses()).toBe(
      "qti-height-lines-3, qti-height-lines-6, qti-height-lines-15",
    );
  });

  it("parses extended text counter position classes in class order", () => {
    expect(
      extendedTextCounterPositionFromAttributes({ class: "qti-height-lines-6 qti-counter-up" }),
    ).toBe("up");
    expect(
      extendedTextCounterPositionFromAttributes({ class: "qti-counter-down qti-counter-up" }),
    ).toBe("down");
    expect(extendedTextCounterPositionFromAttributes({ class: "qti-height-lines-3" })).toBe(
      undefined,
    );
    expect(
      extendedTextCounterPosition(
        extendedTextInteraction({ class: "qti-height-lines-6 qti-counter-up" }),
      ),
    ).toBe("up");
    expect(SHARED_VOCABULARY_EXTENDED_TEXT_COUNTER_CLASSES).toEqual([
      "qti-counter-up",
      "qti-counter-down",
    ]);
    expect(
      supportedExtendedTextCounterClassNames([
        "qti-counter-up",
        "qti-counter-down",
        "qti-counter-x",
      ]),
    ).toEqual(["qti-counter-up", "qti-counter-down"]);
    expect(isSupportedExtendedTextCounterClassName("qti-counter-up")).toBe(true);
    expect(isSupportedExtendedTextCounterClassName("qti-counter-x")).toBe(false);
    expect(formatSupportedExtendedTextCounterClasses()).toBe("qti-counter-up, qti-counter-down");
  });
});
