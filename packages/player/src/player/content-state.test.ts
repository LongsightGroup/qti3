import { describe, expect, it } from "vitest";
import {
  currentVariableValue,
  isFeedbackVisible,
  isTemplateContentVisible,
} from "./content-state.js";

describe("content-state", () => {
  it("resolves variable values in outcome, template, then response order", () => {
    expect(
      currentVariableValue(
        {
          itemIdentifier: "item",
          status: "interacting",
          responses: { RESPONSE: "A" },
          outcomes: { SCORE: 1 },
          templateValues: { TEMP: "x" },
          validationMessages: [],
        } as never,
        "SCORE",
      ),
    ).toBe(1);
    expect(
      currentVariableValue(
        {
          itemIdentifier: "item",
          status: "interacting",
          responses: { RESPONSE: "A" },
          outcomes: {},
          templateValues: { TEMP: "x" },
          validationMessages: [],
        } as never,
        "TEMP",
      ),
    ).toBe("x");
    expect(
      currentVariableValue(
        {
          itemIdentifier: "item",
          status: "interacting",
          responses: { RESPONSE: "A" },
          outcomes: {},
          templateValues: {},
          validationMessages: [],
        } as never,
        "RESPONSE",
      ),
    ).toBe("A");
  });

  it("evaluates feedback and template visibility", () => {
    expect(
      isFeedbackVisible(
        {
          kind: "feedback",
          identifier: "FB1",
          outcomeIdentifier: "OUTCOME",
          showHide: "show",
          feedbackType: "block",
          attributes: {},
          children: [],
        },
        "FB1",
      ),
    ).toBe(true);

    const element = {
      dataset: {
        templateIdentifier: "TEMP",
        templateValueIdentifier: "A",
        showHide: "show",
      },
    };
    expect(isTemplateContentVisible(element, "A")).toBe(true);
    expect(isTemplateContentVisible(element, "B")).toBe(false);
  });
});
