import { describe, expect, it } from "vitest";

import {
  buildQti3InlineChoiceItem,
  qti3TrustedXmlFragment,
  validateQti3InlineChoiceItem,
  writeQti3AssessmentItem,
  type Qti3AuthoringItem,
} from "./index.js";
import { expectValidParsedItem } from "./test-helpers.js";

describe("qti3-writer inline choice", () => {
  it("writes inline-choice interactions from trusted body placeholders", () => {
    const xml = buildQti3InlineChoiceItem({
      identifier: "inline-choice-1",
      title: "Inline choice",
      bodyHtml: qti3TrustedXmlFragment(
        '<p>The capital is <qti-inline-choice-interaction response-identifier="RESPONSE"/>.</p>',
      ),
      slots: [
        {
          responseIdentifier: "RESPONSE",
          correctResponse: "B",
          shuffle: true,
          required: true,
          classNames: ["slot-width"],
          options: [
            { identifier: "A", text: "Lyon", fixed: true },
            { identifier: "B", contentHtml: qti3TrustedXmlFragment("<em>Paris</em>") },
          ],
        },
      ],
      classNames: ["writer-inline-choice"],
    });

    const item = expectValidParsedItem(xml);
    const declaration = item.responseDeclarations[0];
    const interaction = item.interactions[0];
    expect(declaration).toMatchObject({
      identifier: "RESPONSE",
      cardinality: "single",
      baseType: "identifier",
      correctResponse: "B",
    });
    expect(interaction).toMatchObject({
      type: "inlineChoice",
      responseIdentifier: "RESPONSE",
      responseCardinality: "single",
      responseBaseType: "identifier",
      contextText: "The capital is.",
    });
    expect(interaction.attributes).toMatchObject({
      shuffle: "true",
      required: "true",
      class: "writer-inline-choice slot-width",
    });
    expect(interaction.choices.map((choice) => choice.identifier)).toEqual(["A", "B"]);
    expect(interaction.choices.map((choice) => choice.text)).toEqual(["Lyon", "Paris"]);
    expect(interaction.choices[0]?.attributes.fixed).toBe("true");
    expect(xml).not.toContain('<qti-inline-choice-interaction response-identifier="RESPONSE"/>');
    expect(item.responseProcessing).toBeDefined();
  });

  it("writes mapping for partial scoring across multiple inline choices", () => {
    const xml = buildQti3InlineChoiceItem({
      identifier: "inline-choice-map",
      title: "Inline choice map",
      bodyHtml: qti3TrustedXmlFragment(
        '<p><qti-inline-choice-interaction response-identifier="FIRST"/> and <qti-inline-choice-interaction response-identifier="SECOND"/></p>',
      ),
      scoring: "map_response",
      slots: [
        {
          responseIdentifier: "FIRST",
          correctResponse: "B",
          options: [
            { identifier: "A", text: "A", score: 0.25 },
            { identifier: "B", text: "B", score: 1 },
          ],
        },
        {
          responseIdentifier: "SECOND",
          correctResponse: "C",
          options: [
            { identifier: "C", text: "C", score: 2 },
            { identifier: "D", text: "D", score: 0 },
          ],
        },
      ],
    });

    const item = expectValidParsedItem(xml);
    expect(item.responseDeclarations).toHaveLength(2);
    expect(item.responseDeclarations[0]?.mapping?.entries).toMatchObject([
      { mapKey: "A", mappedValue: 0.25 },
      { mapKey: "B", mappedValue: 1 },
    ]);
    expect(item.responseDeclarations[1]?.mapping?.entries).toMatchObject([
      { mapKey: "C", mappedValue: 2 },
      { mapKey: "D", mappedValue: 0 },
    ]);
    expect(xml).toContain('<qti-map-response identifier="FIRST"/>');
    expect(xml).toContain('<qti-map-response identifier="SECOND"/>');
  });

  it("supports the unified writer API", () => {
    const item: Qti3AuthoringItem = {
      interactionType: "inlineChoice",
      identifier: "inline-choice-unified",
      title: "Inline choice unified",
      bodyHtml: qti3TrustedXmlFragment(
        '<p>Select <qti-inline-choice-interaction response-identifier="RESPONSE"></qti-inline-choice-interaction>.</p>',
      ),
      slots: [
        {
          responseIdentifier: "RESPONSE",
          correctResponse: "A",
          options: [
            { identifier: "A", text: "Yes" },
            { identifier: "B", text: "No" },
          ],
        },
      ],
    };

    const parsed = expectValidParsedItem(writeQti3AssessmentItem(item));
    expect(parsed.interactions[0]?.qtiName).toBe("qti-inline-choice-interaction");
  });

  it("rejects invalid inline-choice authoring inputs", () => {
    const diagnostics = validateQti3InlineChoiceItem({
      identifier: "bad inline",
      title: "",
      bodyHtml: qti3TrustedXmlFragment(
        '<p><qti-inline-choice-interaction response-identifier="UNKNOWN"/></p>',
      ),
      slots: [
        {
          responseIdentifier: "RESPONSE",
          correctResponse: "C",
          options: [
            { identifier: "A", text: "" },
            { identifier: "A", text: "Duplicate" },
          ],
        },
      ],
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "invalid_identifier",
        "missing_title",
        "duplicate_identifier",
        "empty_inline_choice_option",
        "unknown_inline_choice_correct_response",
        "unknown_inline_choice_placeholder",
        "missing_inline_choice_placeholder_for_slot",
      ]),
    );
    expect(() =>
      buildQti3InlineChoiceItem({
        identifier: "inline-choice-invalid",
        title: "Invalid",
        bodyHtml: qti3TrustedXmlFragment(
          '<p><qti-inline-choice-interaction response-identifier="RESPONSE"/></p>',
        ),
        slots: [
          {
            responseIdentifier: "RESPONSE",
            options: [
              { identifier: "A", text: "A" },
              { identifier: "B", text: "B" },
            ],
          },
        ],
      }),
    ).toThrow("correct response");
  });
});
