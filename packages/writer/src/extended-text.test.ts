import { describe, expect, it } from "vitest";

import {
  buildQti3ExtendedTextItem,
  qti3TrustedXmlFragment,
  validateQti3ExtendedTextItem,
  writeQti3AssessmentItem,
} from "./index.js";
import { expectValidParsedItem } from "./test-helpers.js";

describe("qti3 extended text writer", () => {
  it("writes a valid extended text item with prompt, rubric, and shared vocabulary classes", () => {
    const xml = buildQti3ExtendedTextItem({
      identifier: "extended-text-1",
      title: "Essay",
      bodyHtml: qti3TrustedXmlFragment("<p>Read the passage.</p>"),
      promptHtml: qti3TrustedXmlFragment("<p>Write at least three sentences.</p>"),
      rubricHtml: qti3TrustedXmlFragment("<p>Score 0-3 using a holistic rubric.</p>"),
      responseIdentifier: "RESPONSE",
      expectedLength: 150,
      expectedLines: 5,
      minStrings: 1,
      maxStrings: 1,
      placeholderText: "Write your answer...",
      patternMask: "^[A-Za-z\\s]+$",
      patternMessage: "Letters and spaces only",
      format: "plain",
      classNames: ["qti-height-lines-15", "qti-counter-down"],
    });

    expect(xml).toContain("<qti-extended-text-interaction");
    expect(xml).toContain('expected-length="150"');
    expect(xml).toContain('expected-lines="5"');
    expect(xml).toContain('placeholder-text="Write your answer..."');
    expect(xml).toContain('data-patternmask-message="Letters and spaces only"');
    expect(xml).toContain('class="qti-height-lines-15 qti-counter-down"');
    expect(xml).toContain("<qti-rubric-block");

    const item = expectValidParsedItem(xml);
    const interaction = item.interactions[0];
    expect(interaction).toMatchObject({
      type: "extendedText",
      qtiName: "qti-extended-text-interaction",
      responseIdentifier: "RESPONSE",
    });
    expect(interaction.attributes).toMatchObject({
      "expected-length": "150",
      "expected-lines": "5",
      "min-strings": "1",
      "max-strings": "1",
      "placeholder-text": "Write your answer...",
      "pattern-mask": "^[A-Za-z\\s]+$",
      format: "plain",
    });
    expect(item.responseDeclarations[0]).toMatchObject({
      identifier: "RESPONSE",
      cardinality: "single",
      baseType: "string",
    });
  });

  it("preserves xhtml response format through the unified writer", () => {
    const xml = writeQti3AssessmentItem({
      interactionType: "extendedText",
      identifier: "extended-text-xhtml",
      title: "Formatted response",
      bodyHtml: qti3TrustedXmlFragment("<p>Use formatting.</p>"),
      promptHtml: qti3TrustedXmlFragment("<p>Write a formatted response.</p>"),
      responseIdentifier: "RESPONSE",
      expectedLength: 200,
      expectedLines: 6,
      format: "xhtml",
    });

    const item = expectValidParsedItem(xml);
    expect(item.interactions[0]?.attributes.format).toBe("xhtml");
  });

  it("escapes plain text and attributes while assembling trusted fragments", () => {
    const xml = buildQti3ExtendedTextItem({
      identifier: "extended-text-escaped",
      title: "Essay <unsafe>",
      bodyHtml: qti3TrustedXmlFragment("<p>Trusted <strong>body</strong>.</p>"),
      promptHtml: qti3TrustedXmlFragment("<p>Trusted prompt.</p>"),
      responseIdentifier: "RESPONSE",
      placeholderText: `Use "quotes" & apostrophes`,
    });

    expect(xml).toContain('title="Essay &lt;unsafe&gt;"');
    expect(xml).toContain('placeholder-text="Use &quot;quotes&quot; &amp; apostrophes"');
    expect(xml).toContain("<strong>body</strong>");
    expectValidParsedItem(xml);
  });

  it("reports diagnostics for invalid extended text inputs", () => {
    const diagnostics = validateQti3ExtendedTextItem({
      identifier: "bad extended text",
      title: "",
      responseIdentifier: "bad response",
      stringIdentifier: "bad string id",
      responseBaseType: "integer",
      responseCardinality: "multiple",
      expectedLength: 1.5,
      minStrings: 3,
      maxStrings: 2,
      patternMask: "[",
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- deliberate invalid runtime value.
      format: "markdown" as "plain",
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "invalid_identifier",
        "missing_title",
        "invalid_extended_text_response_base_type",
        "invalid_extended_text_response_cardinality",
        "invalid_extended_text_numeric_attribute",
        "invalid_extended_text_string_bounds",
        "invalid_extended_text_pattern_mask",
        "invalid_extended_text_format",
      ]),
    );
    expect(diagnostics.every((diagnostic) => diagnostic.path.length > 0)).toBe(true);
  });
});
