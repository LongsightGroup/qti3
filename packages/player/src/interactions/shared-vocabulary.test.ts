import type { QtiInteraction } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import {
  gapInputWidth,
  gapMatchUsesPlacement,
  orderSharedVocabularyLayout,
  sharedVocabularyChoicesLayout,
  sharedVocabularyLabel,
} from "./shared-vocabulary.js";

function interaction(attributes: Record<string, string> = {}): QtiInteraction {
  return {
    type: "order",
    qtiName: "qti-order-interaction",
    responseIdentifier: "RESPONSE",
    responseCardinality: "ordered",
    responseBaseType: "identifier",
    choices: [],
    childElements: [],
    attributes,
    text: "",
  };
}

describe("shared vocabulary", () => {
  it("falls back to deprecated orientation attribute when no orientation class is present", () => {
    expect(
      orderSharedVocabularyLayout(
        interaction({
          class: "qti-choices-left qti-labels-decimal",
          orientation: "vertical",
          "data-choices-container-width": "220",
        }),
      ),
    ).toEqual({
      choicesPosition: "left",
      orientation: "vertical",
      choicesContainerWidth: 220,
    });
  });

  it("uses the first order choices position when multiple are authored", () => {
    expect(
      orderSharedVocabularyLayout(interaction({ class: "qti-choices-right qti-choices-top" })),
    ).toEqual({
      choicesPosition: "right",
      orientation: "horizontal",
    });
  });

  it("uses order orientation classes before deprecated orientation attributes", () => {
    expect(
      orderSharedVocabularyLayout(
        interaction({
          class: "qti-choices-left qti-orientation-horizontal",
          orientation: "vertical",
        }),
      ),
    ).toEqual({
      choicesPosition: "left",
      orientation: "horizontal",
    });
    expect(
      orderSharedVocabularyLayout(
        interaction({ class: "qti-choices-left qti-orientation-vertical" }),
      ),
    ).toEqual({
      choicesPosition: "left",
      orientation: "vertical",
    });
  });

  it("uses horizontal orientation when both orientation classes are authored", () => {
    expect(
      orderSharedVocabularyLayout(
        interaction({
          class: "qti-choices-left qti-orientation-vertical qti-orientation-horizontal",
        }),
      ),
    ).toEqual({
      choicesPosition: "left",
      orientation: "horizontal",
    });
  });

  it("parses shared choices-bank positioning for non-order interactions", () => {
    expect(
      sharedVocabularyChoicesLayout(
        interaction({
          class: "qti-choices-bottom",
          "data-choices-container-width": "180",
        }),
      ),
    ).toEqual({
      choicesPosition: "bottom",
      choicesContainerWidth: 180,
    });
  });

  it("does not enable split order layout without a position class", () => {
    expect(orderSharedVocabularyLayout(interaction({ class: "qti-labels-decimal" }))).toBe(
      undefined,
    );
  });

  it("formats shared vocabulary labels and suffixes", () => {
    expect(
      sharedVocabularyLabel(
        interaction({ class: "qti-labels-lower-alpha qti-labels-suffix-parenthesis" }),
        1,
      ),
    ).toBe("b)");
    expect(sharedVocabularyLabel(interaction({ class: "qti-labels-none" }), 0)).toBe("");
    expect(sharedVocabularyLabel(interaction({ class: "qti-labels-decimal" }), 2)).toBe("3.");
    for (const [index, expected] of [
      [0, "一."],
      [9, "十."],
      [10, "十一."],
      [11, "十二."],
      [19, "二十."],
      [20, "二十一."],
      [26, "27."],
    ] as const) {
      expect(
        sharedVocabularyLabel(
          interaction({ class: "qti-labels-cjk-ideographic qti-labels-suffix-period" }),
          index,
        ),
      ).toBe(expected);
    }
  });

  it("ignores invalid order choices container widths", () => {
    expect(
      orderSharedVocabularyLayout(
        interaction({
          class: "qti-choices-top",
          "data-choices-container-width": "wide",
        }),
      ),
    ).toEqual({
      choicesPosition: "top",
      orientation: "horizontal",
    });
  });

  it("parses supported gap input width classes", () => {
    expect(gapInputWidth({ class: "qti-input-width-10 qti-input-width-3" })).toBe(10);
    expect(gapInputWidth({ class: "qti-input-width-8" })).toBe(undefined);
    expect(gapInputWidth({ class: "qti-gap-placement" })).toBe(undefined);
  });

  it("detects gap match placement shared vocabulary", () => {
    expect(
      gapMatchUsesPlacement(interaction({ class: "qti-gap-placement qti-choices-left" })),
    ).toBe(true);
    expect(gapMatchUsesPlacement(interaction({ class: "qti-choices-left" }))).toBe(false);
  });
});
