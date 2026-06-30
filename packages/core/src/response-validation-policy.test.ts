import { describe, expect, it } from "vitest";
import {
  minimumMediaPlays,
  minimumRequiredResponses,
  responseValidationPolicy,
} from "./response-validation-policy.js";
import type { QtiInteraction } from "./types.js";

function testInteraction(
  overrides: Partial<QtiInteraction> & Pick<QtiInteraction, "type">,
): QtiInteraction {
  return {
    type: overrides.type,
    registryStatus: overrides.registryStatus ?? "supported",
    qtiName: overrides.qtiName ?? "qti-choice-interaction",
    responseIdentifier: overrides.responseIdentifier ?? "RESPONSE",
    choices: overrides.choices ?? [],
    childElements: overrides.childElements ?? [],
    attributes: overrides.attributes ?? {},
    text: overrides.text ?? "",
    source: overrides.source ?? { line: 1, column: 1, offset: 0, path: "interaction" },
  };
}

describe("response validation policy", () => {
  it.each([
    ["optional choice", testInteraction({ type: "choice", attributes: {} }), 0],
    ["required choice", testInteraction({ type: "choice", attributes: { required: "true" } }), 1],
    [
      "authored zero minimum",
      testInteraction({ type: "choice", attributes: { "min-choices": "0" } }),
      0,
    ],
    [
      "authored minimum",
      testInteraction({ type: "choice", attributes: { "min-choices": "2" } }),
      2,
    ],
  ] as const)("derives minimumRequiredResponses for %s", (_label, interaction, minimum) => {
    expect(minimumRequiredResponses(interaction)).toBe(minimum);
  });

  it.each([
    ["optional media", testInteraction({ type: "media", attributes: {} }), 0],
    ["required media", testInteraction({ type: "media", attributes: { required: "true" } }), 1],
    ["explicit min-plays", testInteraction({ type: "media", attributes: { "min-plays": "2" } }), 2],
  ] as const)("derives minimumMediaPlays for %s", (_label, interaction, minimum) => {
    expect(minimumMediaPlays(interaction)).toBe(minimum);
  });

  it("skips policy checks for optional unscored interactions without authored limits", () => {
    expect(
      responseValidationPolicy(
        { correctResponse: null },
        testInteraction({ type: "choice", attributes: {} }),
      ),
    ).toEqual({
      checkMinimum: false,
      checkMaximum: false,
      checkMatchMax: false,
    });
  });

  it("enables minimum checks for required interactions without authored minimums", () => {
    expect(
      responseValidationPolicy(
        { correctResponse: null },
        testInteraction({ type: "extendedText", attributes: { required: "true" } }),
      ),
    ).toMatchObject({
      checkMinimum: true,
      checkMaximum: false,
      checkMatchMax: true,
    });
  });

  it("still validates authored zero minimums", () => {
    expect(
      responseValidationPolicy(
        { correctResponse: null },
        testInteraction({ type: "choice", attributes: { "min-choices": "0" } }),
      ),
    ).toMatchObject({
      checkMinimum: true,
      checkMaximum: false,
      checkMatchMax: true,
    });
  });

  it("treats explicit required=false as optional", () => {
    expect(
      minimumRequiredResponses(
        testInteraction({ type: "choice", attributes: { required: "false" } }),
      ),
    ).toBe(0);
  });
});
