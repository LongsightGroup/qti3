import type { QtiInteraction } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import {
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
  it("parses order choices positioning and orientation", () => {
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
});
