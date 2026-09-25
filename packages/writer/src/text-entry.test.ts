import { describe, expect, it } from "vitest";

import {
  buildQti3TextEntryItem,
  qti3TrustedXmlFragment,
  writeQti3AssessmentItemResult,
  Qti3WriterError,
} from "./index.js";
import { expectValidParsedItem } from "./test-helpers.js";

describe("qti3-writer text entry", () => {
  it.each([
    { baseType: "string" as const, correctResponse: "" },
    { baseType: "integer" as const, correctResponse: "1.5" },
    { baseType: "integer" as const, correctResponse: "0x10" },
    { baseType: "float" as const, correctResponse: "Infinity" },
  ])("reports invalid explicit answer keys through writer diagnostics", (response) => {
    const result = writeQti3AssessmentItemResult({
      interactionType: "textEntry",
      identifier: "invalid-key",
      title: "Synthetic invalid key",
      bodyHtml: qti3TrustedXmlFragment(
        '<p><qti-text-entry-interaction response-identifier="RESPONSE"/></p>',
      ),
      responses: [{ responseIdentifier: "RESPONSE", ...response }],
    });
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        expect.objectContaining({
          code: "invalid_text_entry_correct_response",
          path: "responses.0.correctResponse",
        }),
      ],
    });
  });
  it("preserves an explicit answer key independently of mapping weights", () => {
    const xml = buildQti3TextEntryItem({
      identifier: "explicit-key",
      title: "Synthetic explicit answer key",
      bodyHtml: qti3TrustedXmlFragment(
        '<p><qti-text-entry-interaction response-identifier="RESPONSE"/></p>',
      ),
      responses: [
        {
          responseIdentifier: "RESPONSE",
          correctResponse: "Paris",
          answers: [
            { value: "Paris", score: 0.5 },
            { value: "paris", score: 0.25 },
          ],
        },
      ],
    });
    expect(expectValidParsedItem(xml).responseDeclarations[0]).toMatchObject({
      correctResponse: "Paris",
      mapping: {
        entries: [
          { mapKey: "Paris", mappedValue: 0.5 },
          { mapKey: "paris", mappedValue: 0.25 },
        ],
      },
    });
  });

  it("writes an explicit answer key without requiring mapping entries", () => {
    const xml = buildQti3TextEntryItem({
      identifier: "unscored-key",
      title: "Synthetic unscored answer key",
      bodyHtml: qti3TrustedXmlFragment(
        '<p><qti-text-entry-interaction response-identifier="RESPONSE"/></p>',
      ),
      responses: [{ responseIdentifier: "RESPONSE", correctResponse: "Paris" }],
    });
    expect(expectValidParsedItem(xml).responseDeclarations[0]?.correctResponse).toBe("Paris");
  });
  it("writes text entry items with declarations, mapping, and additive response processing", () => {
    const xml = buildQti3TextEntryItem({
      identifier: "text-entry-1",
      title: "Text Entry",
      promptHtml: qti3TrustedXmlFragment("Complete it"),
      bodyHtml: qti3TrustedXmlFragment(
        '<p>Answer: <qti-text-entry-interaction response-identifier="RESPONSE" expected-length="10"/></p>',
      ),
      responses: [
        {
          responseIdentifier: "RESPONSE",
          baseType: "string",
          answers: [{ value: "deno", score: 1, caseSensitive: true }],
        },
      ],
    });

    const item = expectValidParsedItem(xml);
    const declaration = item.responseDeclarations[0];
    expect(declaration).toMatchObject({
      identifier: "RESPONSE",
      cardinality: "single",
      baseType: "string",
      correctResponse: "deno",
    });
    expect(declaration.mapping?.entries).toEqual([
      expect.objectContaining({
        mapKey: "deno",
        mappedValue: 1,
        attributes: expect.objectContaining({ "case-sensitive": "true" }),
      }),
    ]);
    expect(item.interactions[0]).toMatchObject({
      type: "textEntry",
      responseIdentifier: "RESPONSE",
      responseCardinality: "single",
      responseBaseType: "string",
    });
  });

  it("writes case-insensitive text entry mappings explicitly", () => {
    const xml = buildQti3TextEntryItem({
      interactionType: "textEntry",
      identifier: "text-entry-case-insensitive",
      title: "Text Entry",
      bodyHtml: qti3TrustedXmlFragment(
        '<p><qti-text-entry-interaction response-identifier="RESPONSE"/></p>',
      ),
      responses: [
        {
          responseIdentifier: "RESPONSE",
          answers: [{ value: "Deno", score: 1, caseSensitive: false }],
        },
      ],
    });

    const item = expectValidParsedItem(xml);
    expect(item.responseDeclarations[0]?.mapping?.entries[0]?.attributes).toMatchObject({
      "case-sensitive": "false",
    });
  });

  it("keeps text entry correct-response single-valued when alternate answers are mapped", () => {
    const xml = buildQti3TextEntryItem({
      interactionType: "textEntry",
      identifier: "text-entry-alternates",
      title: "Text Entry",
      bodyHtml: qti3TrustedXmlFragment(
        '<p><qti-text-entry-interaction response-identifier="RESPONSE"/></p>',
      ),
      responses: [
        {
          responseIdentifier: "RESPONSE",
          answers: [
            { value: "color", score: 1 },
            { value: "colour", score: 1 },
          ],
        },
      ],
    });

    const item = expectValidParsedItem(xml);
    const declaration = item.responseDeclarations[0];
    expect(declaration).toMatchObject({
      cardinality: "single",
      correctResponse: "color",
    });
    expect(declaration.mapping?.entries).toEqual([
      expect.objectContaining({ mapKey: "color", mappedValue: 1 }),
      expect.objectContaining({ mapKey: "colour", mappedValue: 1 }),
    ]);
  });

  it("preserves trusted MathML in text entry body and prompt fragments", () => {
    const math =
      '<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow><mi>x</mi><mo>=</mo><mn>4</mn></mrow></math>';
    const xml = buildQti3TextEntryItem({
      interactionType: "textEntry",
      identifier: "text-entry-mathml",
      title: "Text Entry MathML",
      promptHtml: qti3TrustedXmlFragment(`Solve ${math}`),
      bodyHtml: qti3TrustedXmlFragment(
        `<p>${math} when squared is <qti-text-entry-interaction response-identifier="RESPONSE"/></p>`,
      ),
      responses: [
        {
          responseIdentifier: "RESPONSE",
          answers: [{ value: "16", score: 1 }],
        },
      ],
    });

    const item = expectValidParsedItem(xml);
    const mathNodes = item.body
      .flatMap((node) => (node.kind === "element" ? node.children : []))
      .filter((node) => node.kind === "element" && node.qtiName === "math");

    expect(xml).toContain('<math xmlns="http://www.w3.org/1998/Math/MathML">');
    expect(item.bodyText).toContain("x = 4 when squared is");
    expect(mathNodes).toHaveLength(2);
    expect(item.interactions[0]).toMatchObject({
      type: "textEntry",
      responseIdentifier: "RESPONSE",
    });
  });

  it("returns typed diagnostics for invalid authoring input", () => {
    const result = writeQti3AssessmentItemResult({
      interactionType: "textEntry",
      identifier: "text-entry-mismatch",
      title: "Text Entry",
      bodyHtml: qti3TrustedXmlFragment(
        '<p><qti-text-entry-interaction response-identifier="BODY_ONLY"/></p>',
      ),
      responses: [{ responseIdentifier: "DECLARED_ONLY", answers: [{ value: "x" }] }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
        "missing_text_entry_interaction_for_response",
        "unknown_text_entry_interaction_response",
      ]);
    }
  });

  it("rejects text entry declarations without matching interactions", () => {
    expect(() =>
      buildQti3TextEntryItem({
        interactionType: "textEntry",
        identifier: "text-entry-empty-body",
        title: "Text Entry",
        responses: [{ responseIdentifier: "RESPONSE", answers: [{ value: "x" }] }],
      }),
    ).toThrow(Qti3WriterError);
  });
});
