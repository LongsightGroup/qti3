import type { QtiDocument, QtiInteraction } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
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
          {
            type: "choice",
            responseIdentifier: "RESPONSE",
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
          } as unknown as QtiInteraction,
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
        minimumRequiredResponses({
          type,
          attributes: { "min-choices": "0" },
        } as unknown as QtiInteraction),
      ).toBe(0);
      expect(
        minimumRequiredResponses({
          type,
          attributes: { "min-choices": "2" },
        } as unknown as QtiInteraction),
      ).toBe(2);
      expect(
        minimumRequiredResponses({
          type,
          attributes: {},
        } as unknown as QtiInteraction),
      ).toBe(1);
    },
  );

  it("does not require unscored responses without an authored minimum", () => {
    const document = {
      item: {
        interactions: [
          {
            type: "choice",
            responseIdentifier: "RESPONSE",
            choices: [],
            attributes: {},
          } as unknown as QtiInteraction,
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
      responseValidationPolicy({ correctResponse: null }, {
        type: "choice",
        attributes: {},
      } as unknown as QtiInteraction),
    ).toEqual({
      checkMinimum: false,
      checkMaximum: false,
      checkMatchMax: false,
    });
  });

  it("validates maximum response counts for unscored graphic gap match responses", () => {
    const document = {
      item: {
        interactions: [
          {
            type: "graphicGapMatch",
            responseIdentifier: "RESPONSE",
            choices: [],
            attributes: { "data-max-selections-message": "Too many placements." },
          } as unknown as QtiInteraction,
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
