import type { QtiDocument, QtiInteraction } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import {
  cloneDiagnostics,
  responseCount,
  responseIsEmpty,
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
    const original = [{ code: "x", severity: "error" as const, message: "m", source: { line: 1 } }];
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
            choices: [{ identifier: "A", text: "A", role: "simpleChoice", qtiName: "qti-simple-choice", attributes: {}, source: { start: 0, end: 0 } }],
            attributes: {},
          } as QtiInteraction,
        ],
        responseDeclarations: [{ identifier: "RESPONSE", correctResponse: "A", cardinality: "single", baseType: "identifier" }],
      },
    } as unknown as QtiDocument;

    const diagnostics = validateItemResponses(document, {
      itemIdentifier: "item",
      status: "open",
      responses: { RESPONSE: null },
      outcomes: {},
    });
    expect(diagnostics.some((entry) => entry.code === "response.required")).toBe(true);
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
