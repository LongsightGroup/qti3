import { describe, expect, it } from "vitest";

import {
  buildQti3HottextItem,
  qti3TrustedXmlFragment,
  validateQti3HottextItem,
  writeQti3AssessmentItem,
  type Qti3AuthoringItem,
} from "./index.js";
import { expectValidParsedItem } from "./test-helpers.js";

describe("qti3-writer hottext", () => {
  it("writes single-select hottext with prompt, messages, vocabulary, and rich content", () => {
    const xml = buildQti3HottextItem({
      identifier: "hottext-1",
      title: "Hottext",
      responseIdentifier: "RESPONSE",
      promptHtml: qti3TrustedXmlFragment("Select the claim."),
      bodyHtml: qti3TrustedXmlFragment(
        '<p>The claim is <qti-hottext identifier="A"/>. The date is <qti-hottext identifier="B"/>.</p>',
      ),
      choices: [
        { identifier: "A", contentHtml: qti3TrustedXmlFragment("<em>small parks help</em>") },
        { identifier: "B", text: "Tuesday" },
      ],
      correctResponse: ["A"],
      minChoices: 1,
      maxChoices: 1,
      minChoicesMessage: "Pick one",
      maxChoicesMessage: "Only one",
      classNames: ["writer-hottext"],
      sharedVocabulary: { "selections-tone": "dark", "unselected-hidden": true },
    });

    const item = expectValidParsedItem(xml);
    const declaration = item.responseDeclarations[0];
    const interaction = item.interactions[0];
    expect(declaration).toMatchObject({
      identifier: "RESPONSE",
      cardinality: "single",
      baseType: "identifier",
      correctResponse: "A",
    });
    expect(interaction).toMatchObject({
      type: "hottext",
      responseIdentifier: "RESPONSE",
      responseCardinality: "single",
      responseBaseType: "identifier",
      prompt: "Select the claim.",
    });
    expect(interaction.attributes).toMatchObject({
      class: "writer-hottext qti-selections-dark qti-unselected-hidden",
      "min-choices": "1",
      "max-choices": "1",
      "data-min-selections-message": "Pick one",
      "data-max-selections-message": "Only one",
    });
    expect(interaction.choices.map((choice) => choice.identifier)).toEqual(["A", "B"]);
    expect(interaction.choices.map((choice) => choice.text)).toEqual([
      "small parks help",
      "Tuesday",
    ]);
    expect(interaction.hottextSegments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "hottext", identifier: "A", text: "small parks help" }),
        expect.objectContaining({ kind: "hottext", identifier: "B", text: "Tuesday" }),
      ]),
    );
    expect(xml).not.toContain('<qti-hottext identifier="A"/>');
    expect(item.responseProcessing?.template).toContain("rptemplates/match_correct");
  });

  it("writes multi-select hottext with multiple correct responses", () => {
    const xml = buildQti3HottextItem({
      identifier: "hottext-multi",
      title: "Hottext multi",
      bodyHtml: qti3TrustedXmlFragment(
        '<p><qti-hottext identifier="A"/> <qti-hottext identifier="B"/> <qti-hottext identifier="C"/></p>',
      ),
      choices: [
        { identifier: "A", text: "Alpha" },
        { identifier: "B", text: "Beta" },
        { identifier: "C", text: "Gamma" },
      ],
      correctResponse: ["A", "C"],
      maxChoices: 2,
    });

    const item = expectValidParsedItem(xml);
    expect(item.responseDeclarations[0]).toMatchObject({
      cardinality: "multiple",
      correctResponse: ["A", "C"],
    });
    expect(item.interactions[0]?.attributes["max-choices"]).toBe("2");
  });

  it("supports the unified writer API", () => {
    const item: Qti3AuthoringItem = {
      interactionType: "hottext",
      identifier: "hottext-unified",
      title: "Hottext unified",
      bodyHtml: qti3TrustedXmlFragment('<p>Choose <qti-hottext identifier="A"/>.</p>'),
      choices: [{ identifier: "A", text: "A" }],
      correctResponse: ["A"],
    };

    const parsed = expectValidParsedItem(writeQti3AssessmentItem(item));
    expect(parsed.interactions[0]?.qtiName).toBe("qti-hottext-interaction");
  });

  it("requires at least one correct response", () => {
    const diagnostics = validateQti3HottextItem({
      identifier: "hottext-missing-correct",
      title: "Hottext",
      bodyHtml: qti3TrustedXmlFragment('<p><qti-hottext identifier="A"/></p>'),
      choices: [{ identifier: "A", text: "A" }],
      correctResponse: [],
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "missing_hottext_correct_response",
    );
    expect(() =>
      buildQti3HottextItem({
        identifier: "hottext-missing-correct",
        title: "Hottext",
        bodyHtml: qti3TrustedXmlFragment('<p><qti-hottext identifier="A"/></p>'),
        choices: [{ identifier: "A", text: "A" }],
        correctResponse: [],
      }),
    ).toThrow("at least one correct response");
  });

  it("rejects invalid hottext authoring inputs", () => {
    const diagnostics = validateQti3HottextItem({
      identifier: "bad hottext",
      title: "",
      responseIdentifier: "bad response",
      bodyHtml: qti3TrustedXmlFragment(
        '<p><qti-hottext/><qti-hottext identifier="UNKNOWN"/><qti-hottext identifier="UNKNOWN"/></p>',
      ),
      choices: [
        { identifier: "A", text: "" },
        { identifier: "A", text: "Duplicate" },
      ],
      correctResponse: ["B", "C"],
      minChoices: 2,
      maxChoices: 1,
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "invalid_identifier",
        "missing_title",
        "duplicate_identifier",
        "empty_hottext_choice",
        "invalid_hottext_choice_bounds",
        "invalid_hottext_correct_response_count",
        "unknown_hottext_reference",
        "missing_hottext_placeholder_identifier",
        "duplicate_identifier",
        "unknown_hottext_placeholder",
        "missing_hottext_placeholder_for_choice",
      ]),
    );
    expect(() =>
      buildQti3HottextItem({
        identifier: "hottext-invalid",
        title: "Invalid",
        bodyHtml: qti3TrustedXmlFragment('<p><qti-hottext identifier="A"/></p>'),
        choices: [{ identifier: "A", text: "A" }],
        correctResponse: ["A", "B"],
        maxChoices: 1,
      }),
    ).toThrow("Single-response hottext");
  });
});
