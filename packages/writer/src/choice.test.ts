import { describe, expect, it } from "vitest";

import {
  buildQti3ChoiceItem,
  qti3TrustedXmlFragment,
  writeQti3AssessmentItem,
  type Qti3AuthoringItem,
} from "./index.js";
import { expectValidParsedItem } from "./test-helpers.js";

describe("qti3-writer choice", () => {
  it("writes single choice items with escaped text, shared vocabulary, and map_response scoring", () => {
    const xml = buildQti3ChoiceItem({
      identifier: "choice-1",
      title: "Choice <One>",
      bodyHtml: qti3TrustedXmlFragment("<p>Context</p>"),
      promptHtml: qti3TrustedXmlFragment("Pick one"),
      responseCardinality: "single",
      choices: [
        { identifier: "A", text: "Less < more" },
        { identifier: "B", text: "Correct", fixed: true },
      ],
      correctResponse: ["B"],
      shuffle: true,
      minChoices: 1,
      maxChoices: 1,
      scoring: "map_response",
      choiceVisibility: "hide",
      sharedVocabulary: { "labels-style": "decimal", "selections-tone": "dark" },
    });

    const item = expectValidParsedItem(xml);
    const declaration = item.responseDeclarations[0];
    const interaction = item.interactions[0];

    expect(item.attributes.title).toBe("Choice <One>");
    expect(declaration).toMatchObject({
      identifier: "RESPONSE",
      cardinality: "single",
      baseType: "identifier",
      correctResponse: "B",
    });
    expect(declaration.mapping?.entries).toEqual([
      expect.objectContaining({ mapKey: "A", mappedValue: 0 }),
      expect.objectContaining({ mapKey: "B", mappedValue: 1 }),
    ]);
    expect(interaction).toMatchObject({
      type: "choice",
      responseIdentifier: "RESPONSE",
      responseCardinality: "single",
    });
    expect(interaction.attributes).toMatchObject({
      class: "qti-labels-decimal qti-selections-dark",
      shuffle: "true",
      "min-choices": "1",
      "max-choices": "1",
    });
    expect(interaction.choices.map((choice) => choice.identifier)).toEqual(["A", "B"]);
    expect(interaction.choices[0]?.text).toBe("Less < more");
    expect(interaction.choices[1]?.attributes).toMatchObject({
      fixed: "true",
      "show-hide": "hide",
    });
    expect(item.responseProcessing?.template).toContain("rptemplates/map_response");
  });

  it("writes multiple choice items through the unified writer", () => {
    const item: Qti3AuthoringItem = {
      interactionType: "choice",
      identifier: "choice-multiple",
      title: "Multiple",
      responseCardinality: "multiple",
      choices: [
        { identifier: "A", text: "A" },
        { identifier: "B", text: "B" },
        { identifier: "C", text: "C" },
      ],
      correctResponse: ["A", "C"],
      minChoices: 1,
      maxChoices: 0,
    };
    const xml = writeQti3AssessmentItem(item);

    const parsed = expectValidParsedItem(xml);
    expect(parsed.responseDeclarations[0]).toMatchObject({
      identifier: "RESPONSE",
      cardinality: "multiple",
      baseType: "identifier",
      correctResponse: ["A", "C"],
    });
    expect(parsed.interactions[0]?.attributes).toMatchObject({
      "min-choices": "1",
      "max-choices": "0",
    });
  });

  it("preserves trusted MathML in prompts, body fragments, and rich choice content", () => {
    const math =
      '<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow><mn>2</mn><mo>+</mo><mn>2</mn></mrow></math>';
    const xml = buildQti3ChoiceItem({
      identifier: "choice-mathml",
      title: "Choice MathML",
      bodyHtml: qti3TrustedXmlFragment(`<p>Evaluate ${math}</p>`),
      promptHtml: qti3TrustedXmlFragment(`Choose the expression equal to ${math}.`),
      responseCardinality: "single",
      maxChoices: 1,
      choices: [
        { identifier: "A", contentHtml: qti3TrustedXmlFragment(math) },
        { identifier: "B", text: "5" },
      ],
      correctResponse: ["A"],
    });

    const item = expectValidParsedItem(xml);
    const interaction = item.interactions[0];
    const firstChoice = interaction.choices[0];
    const bodyMath = item.body
      .flatMap((node) => (node.kind === "element" ? node.children : []))
      .find((node) => node.kind === "element" && node.qtiName === "math");

    expect(xml).toContain('<math xmlns="http://www.w3.org/1998/Math/MathML">');
    expect(interaction.prompt).toBe("Choose the expression equal to 2 + 2 .");
    expect(
      interaction.promptContent?.some((node) => node.kind === "element" && node.qtiName === "math"),
    ).toBe(true);
    expect(bodyMath).toMatchObject({ kind: "element", qtiName: "math" });
    expect(firstChoice.text).toBe("2 + 2");
    expect(
      firstChoice.content?.some((node) => node.kind === "element" && node.qtiName === "math"),
    ).toBe(true);
  });

  it("rejects invalid choice correct responses instead of writing lossy XML", () => {
    expect(() =>
      buildQti3ChoiceItem({
        interactionType: "choice",
        identifier: "choice-missing-correct",
        title: "Choice",
        responseCardinality: "single",
        choices: [{ identifier: "A", text: "A" }],
        correctResponse: [],
      }),
    ).toThrow("at least one correct response");

    expect(() =>
      buildQti3ChoiceItem({
        interactionType: "choice",
        identifier: "choice-unknown-correct",
        title: "Choice",
        responseCardinality: "multiple",
        choices: [{ identifier: "A", text: "A" }],
        correctResponse: ["B"],
      }),
    ).toThrow('unknown choice "B"');
  });

  it("rejects duplicate choice identifiers", () => {
    expect(() =>
      buildQti3ChoiceItem({
        interactionType: "choice",
        identifier: "choice-duplicate",
        title: "Choice",
        responseCardinality: "single",
        choices: [
          { identifier: "A", text: "A" },
          { identifier: "A", text: "Duplicate A" },
        ],
        correctResponse: ["A"],
      }),
    ).toThrow('Choice identifier "A" must be unique');
  });
});
