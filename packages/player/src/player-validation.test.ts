import type { QtiDocument } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import { testInteraction } from "./interaction-test-fixtures.js";
import {
  cloneDiagnostics,
  minimumRequiredResponses,
  responseCount,
  responseIsEmpty,
  responseValidationPolicy,
  validateItemResponses,
} from "./player-validation.js";
import { isResolvableAssetUrl, isSafeUrl as contentIsSafeUrl } from "./content/content-dom.js";

describe("player-validation", () => {
  it("detects empty and non-empty responses", () => {
    expect(responseIsEmpty(null)).toBe(true);
    expect(responseIsEmpty("")).toBe(true);
    expect(responseIsEmpty([])).toBe(true);
    expect(responseCount("A")).toBe(1);
    expect(responseCount(["A", "B"])).toBe(2);
  });

  it("clones diagnostics without sharing nested source objects", () => {
    const original = [
      {
        code: "x",
        severity: "error" as const,
        message: "m",
        source: { line: 1, column: 1, offset: 0, path: "item" },
      },
    ];
    const cloned = cloneDiagnostics(original);
    cloned[0]!.source!.line = 2;
    expect(original[0]!.source!.line).toBe(1);
  });

  it("requires a response when declaration expects scoring", () => {
    const document = {
      item: {
        interactions: [
          testInteraction({
            type: "choice",
            choices: [
              {
                identifier: "A",
                text: "A",
                role: "simpleChoice",
                qtiName: "qti-simple-choice",
                attributes: {},
                source: { line: 1, column: 1, offset: 0, path: "choice" },
              },
            ],
            attributes: {},
          }),
        ],
        responseDeclarations: [
          {
            identifier: "RESPONSE",
            correctResponse: "A",
            cardinality: "single",
            baseType: "identifier",
          },
        ],
      },
    } as unknown as QtiDocument;

    const diagnostics = validateItemResponses(document, {
      schema: "qti3.attempt-state.v1",
      itemIdentifier: "item",
      status: "interacting",
      responses: { RESPONSE: null },
      outcomes: {},
      validationMessages: [],
    });
    expect(diagnostics.some((entry) => entry.code === "response.required")).toBe(true);
  });

  it.each(["order", "graphicOrder"] as const)(
    "parses authored minimum response counts for %s",
    (type) => {
      expect(
        minimumRequiredResponses(testInteraction({ type, attributes: { "min-choices": "0" } })),
      ).toBe(0);
      expect(
        minimumRequiredResponses(testInteraction({ type, attributes: { "min-choices": "2" } })),
      ).toBe(2);
      expect(minimumRequiredResponses(testInteraction({ type, attributes: {} }))).toBe(0);
      expect(
        minimumRequiredResponses(testInteraction({ type, attributes: { required: "true" } })),
      ).toBe(1);
    },
  );

  it("does not require unscored responses without an authored minimum", () => {
    const document = {
      item: {
        interactions: [
          testInteraction({
            type: "choice",
            choices: [],
            attributes: {},
          }),
        ],
        responseDeclarations: [
          {
            identifier: "RESPONSE",
            correctResponse: null,
            cardinality: "single",
            baseType: "identifier",
          },
        ],
      },
    } as unknown as QtiDocument;

    const diagnostics = validateItemResponses(document, {
      schema: "qti3.attempt-state.v1",
      itemIdentifier: "item",
      status: "interacting",
      responses: { RESPONSE: null },
      outcomes: {},
      validationMessages: [],
    });

    expect(diagnostics).toEqual([]);
  });

  it("skips validation policy for unscored responses without authored limits", () => {
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

  it("enables minimum checks for required unscored interactions", () => {
    expect(
      responseValidationPolicy(
        { correctResponse: null },
        testInteraction({ type: "choice", attributes: { required: "true" } }),
      ),
    ).toMatchObject({
      checkMinimum: true,
      checkMaximum: false,
      checkMatchMax: true,
    });
  });

  it.each(["order", "graphicOrder"] as const)(
    "ignores max-choices without min-choices for %s interactions",
    (type) => {
      expect(
        responseValidationPolicy(
          { correctResponse: null },
          testInteraction({ type, attributes: { "max-choices": "1" } }),
        ),
      ).toEqual({
        checkMinimum: false,
        checkMaximum: false,
        checkMatchMax: false,
      });

      const document = {
        item: {
          interactions: [
            testInteraction({
              type,
              choices: [],
              attributes: { "max-choices": "1", "data-max-selections-message": "Too many." },
            }),
          ],
          responseDeclarations: [
            {
              identifier: "RESPONSE",
              correctResponse: null,
              cardinality: "ordered",
              baseType: "identifier",
            },
          ],
        },
      } as unknown as QtiDocument;

      const diagnostics = validateItemResponses(document, {
        schema: "qti3.attempt-state.v1",
        itemIdentifier: "item",
        status: "interacting",
        responses: { RESPONSE: ["A", "B"] },
        outcomes: {},
        validationMessages: [],
      });

      expect(diagnostics.some((entry) => entry.code === "response.maximum")).toBe(false);
    },
  );

  it("validates maximum response counts for unscored graphic gap match responses", () => {
    const document = {
      item: {
        interactions: [
          testInteraction({
            type: "graphicGapMatch",
            choices: [],
            attributes: {
              "max-associations": "1",
              "data-max-selections-message": "Too many placements.",
            },
          }),
        ],
        responseDeclarations: [
          {
            identifier: "RESPONSE",
            correctResponse: null,
            cardinality: "multiple",
            baseType: "directedPair",
          },
        ],
      },
    } as unknown as QtiDocument;

    const diagnostics = validateItemResponses(document, {
      schema: "qti3.attempt-state.v1",
      itemIdentifier: "item",
      status: "interacting",
      responses: { RESPONSE: ["A T1", "B T2"] },
      outcomes: {},
      validationMessages: [],
    });

    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "response.maximum",
        message: "Too many placements.",
        path: "RESPONSE",
      }),
    ]);
  });
});

describe("content-dom url policy", () => {
  it("accepts safe relative and https urls", () => {
    expect(contentIsSafeUrl("./item.png")).toBe(true);
    expect(contentIsSafeUrl("https://example.com/x")).toBe(true);
    expect(contentIsSafeUrl("javascript:alert(1)")).toBe(false);
  });

  it("identifies resolvable relative asset urls", () => {
    expect(isResolvableAssetUrl("items/picture.png")).toBe(true);
    expect(isResolvableAssetUrl("https://example.com/x")).toBe(false);
    expect(isResolvableAssetUrl("data:image/png;base64,abc")).toBe(false);
  });
});
