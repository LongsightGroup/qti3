import { describe, expect, it } from "vitest";

import {
  buildQti3OrderItem,
  qti3TrustedXmlFragment,
  validateQti3OrderItem,
  writeQti3AssessmentItem,
  type Qti3AuthoringItem,
} from "./index.js";
import { expectValidParsedItem } from "./test-helpers.js";

describe("qti3-writer order", () => {
  it("writes order items with ordered cardinality, limits, messages, and vocabulary", () => {
    const xml = buildQti3OrderItem({
      identifier: "order-1",
      title: "Ordering",
      bodyHtml: qti3TrustedXmlFragment("<p>Context</p>"),
      promptHtml: qti3TrustedXmlFragment("Arrange these"),
      choices: [
        { identifier: "A", text: "First", fixed: true },
        { identifier: "B", text: "Second" },
        { identifier: "C", contentHtml: qti3TrustedXmlFragment("<em>Third</em>") },
      ],
      correctOrder: ["B", "A", "C"],
      minChoices: 1,
      maxChoices: 3,
      minChoicesMessage: "Move at least one",
      maxChoicesMessage: "Only three",
      shuffle: true,
      choiceVisibility: "hide",
      classNames: ["writer-order"],
      sharedVocabulary: { orientation: "horizontal" },
    });

    const item = expectValidParsedItem(xml);
    const declaration = item.responseDeclarations[0];
    const interaction = item.interactions[0];
    expect(declaration).toMatchObject({
      identifier: "RESPONSE",
      cardinality: "ordered",
      baseType: "identifier",
      correctResponse: ["B", "A", "C"],
    });
    expect(interaction).toMatchObject({
      type: "order",
      responseIdentifier: "RESPONSE",
      responseCardinality: "ordered",
      responseBaseType: "identifier",
    });
    expect(interaction.attributes).toMatchObject({
      class: "writer-order qti-orientation-horizontal",
      "min-choices": "1",
      "max-choices": "3",
      "data-min-selections-message": "Move at least one",
      "data-max-selections-message": "Only three",
      shuffle: "true",
    });
    expect(interaction.choices.map((choice) => choice.identifier)).toEqual(["A", "B", "C"]);
    expect(interaction.choices.map((choice) => choice.text)).toEqual(["First", "Second", "Third"]);
    expect(interaction.choices[0]?.attributes).toMatchObject({
      fixed: "true",
      "show-hide": "hide",
    });
    expect(interaction.choices[1]?.attributes).toMatchObject({ "show-hide": "hide" });
    expect(item.responseProcessing?.template).toContain("rptemplates/match_correct");
  });

  it("defaults correct order to the display choice order", () => {
    const item: Qti3AuthoringItem = {
      interactionType: "order",
      identifier: "order-default-correct",
      title: "Ordering",
      choices: [
        { identifier: "A", text: "A" },
        { identifier: "B", text: "B" },
      ],
    };
    const parsed = expectValidParsedItem(writeQti3AssessmentItem(item));

    expect(parsed.responseDeclarations[0]).toMatchObject({
      cardinality: "ordered",
      correctResponse: ["A", "B"],
    });
    expect(parsed.interactions[0]?.attributes.shuffle).toBe("false");
    expect(parsed.interactions[0]?.qtiName).toBe("qti-order-interaction");
  });

  it("requires explicit correct order to cover every choice unless subset ordering is configured", () => {
    const incomplete = {
      identifier: "order-incomplete",
      title: "Ordering",
      choices: [
        { identifier: "A", text: "A" },
        { identifier: "B", text: "B" },
        { identifier: "C", text: "C" },
      ],
      correctOrder: ["A", "B"],
    };

    expect(validateQti3OrderItem(incomplete).map((diagnostic) => diagnostic.code)).toContain(
      "incomplete_order_correct_order",
    );
    expect(() => buildQti3OrderItem(incomplete)).toThrow("must include every choice");

    const subset = expectValidParsedItem(buildQti3OrderItem({ ...incomplete, maxChoices: 2 }));
    expect(subset.responseDeclarations[0]?.correctResponse).toEqual(["A", "B"]);
    expect(subset.interactions[0]?.attributes["max-choices"]).toBe("2");
  });

  it("rejects invalid order authoring inputs", () => {
    const diagnostics = validateQti3OrderItem({
      identifier: "bad order",
      title: "",
      choices: [
        { identifier: "A", text: "" },
        { identifier: "A", text: "Duplicate" },
      ],
      correctOrder: ["B", "B"],
      minChoices: 3,
      maxChoices: 1,
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "invalid_identifier",
        "missing_title",
        "duplicate_identifier",
        "empty_order_choice",
        "invalid_order_bounds",
        "unknown_order_reference",
      ]),
    );
    expect(diagnostics.every((diagnostic) => diagnostic.path.length > 0)).toBe(true);
    expect(() =>
      buildQti3OrderItem({
        identifier: "order-missing-choices",
        title: "Ordering",
        choices: [{ identifier: "A", text: "A" }],
      }),
    ).toThrow("at least two choices");
  });
});
