import { describe, expect, it } from "vitest";
import { createItemSession, parseQtiXml, visibleModalFeedback } from "@longsightgroup/qti3-core";

import {
  buildQti3ChoiceItem,
  qti3TrustedXmlFragment,
  writeQti3AssessmentItem,
  type Qti3AuthoringItem,
} from "./index.js";
import { expectValidParsedItem } from "./test-helpers.js";

describe("qti3-writer choice", () => {
  it.each(["match_correct", "map_response"] as const)(
    "shows feedback for every selected choice with multiple cardinality and %s scoring",
    (scoring) => {
      const xml = buildQti3ChoiceItem({
        identifier: `multiple-feedback-${scoring}`,
        title: "Multiple choice feedback",
        responseIdentifier: "ANSWERS",
        responseCardinality: "multiple",
        choices: [
          { identifier: "A", text: "A" },
          { identifier: "B", text: "B" },
          { identifier: "C", text: "C" },
          { identifier: "D", text: "D" },
        ],
        correctResponse: ["A", "B"],
        scoring,
        feedback: {
          outcomeIdentifier: "EXPLANATION",
          entries: [
            { choiceIdentifier: "A", identifier: "A_HINT", text: "A is right." },
            { choiceIdentifier: "B", identifier: "B_HINT", text: "B is right." },
            { choiceIdentifier: "C", identifier: "C_HINT", text: "C is wrong." },
          ],
        },
      });
      const item = expectValidParsedItem(xml);
      const parsed = parseQtiXml(xml);
      if (!parsed.document) throw new Error("Expected a parsed item document.");
      expect(item.outcomeDeclarations).toContainEqual(
        expect.objectContaining({
          identifier: "EXPLANATION",
          cardinality: "multiple",
          baseType: "identifier",
        }),
      );
      expect(xml).toContain('<qti-variable identifier="ANSWERS"/>');
      expect(xml).toContain('max-choices="0"');
      expect(xml).toContain("<qti-member>");
      expect(xml).toContain("<qti-multiple>");
      const processingXml = xml.slice(xml.indexOf("<qti-response-processing>"));
      if (scoring === "map_response") {
        expect(processingXml).toContain('<qti-map-response identifier="ANSWERS"/>');
        expect(processingXml).not.toContain("<qti-correct");
      } else {
        expect(processingXml).toContain('<qti-correct identifier="ANSWERS"/>');
        expect(processingXml).not.toContain("<qti-map-response");
      }

      for (const [response, score, identifiers] of [
        [[], 0, []],
        [["A"], scoring === "match_correct" ? 0 : 1, ["A_HINT"]],
        [["A", "B"], scoring === "match_correct" ? 1 : 2, ["A_HINT", "B_HINT"]],
        [["A", "C"], scoring === "match_correct" ? 0 : 1, ["A_HINT", "C_HINT"]],
        [["D"], 0, []],
      ] as const) {
        const session = createItemSession(parsed.document);
        session.respond("ANSWERS", [...response]);
        const scored = session.score();
        expect(scored.outcomes.SCORE).toBe(score);
        expect(scored.outcomes.EXPLANATION).toEqual(identifiers.length ? identifiers : null);
        expect(
          visibleModalFeedback(item, scored.outcomes).map((entry) => entry.identifier),
        ).toEqual(identifiers);
      }
    },
  );

  it.each(["match_correct", "map_response"] as const)(
    "writes and scores mapped modal feedback with %s",
    (scoring) => {
      const xml = buildQti3ChoiceItem({
        identifier: `feedback-${scoring}`,
        title: "Choice feedback",
        responseCardinality: "single",
        choices: [
          { identifier: "A", text: "A" },
          { identifier: "B", text: "B" },
          { identifier: "C", text: "C" },
        ],
        correctResponse: ["B"],
        scoring,
        feedback: {
          entries: [
            {
              choiceIdentifier: " B ",
              identifier: "RIGHT",
              contentHtml: qti3TrustedXmlFragment("<p>Correct <strong>answer</strong>.</p>"),
            },
            { choiceIdentifier: "A", identifier: "A", text: "Less < more." },
          ],
        },
      });
      const item = expectValidParsedItem(xml);
      const parsed = parseQtiXml(xml);
      expect(parsed.document).toBeDefined();
      if (!parsed.document) throw new Error("Expected a parsed item document.");

      expect(item.outcomeDeclarations).toContainEqual(
        expect.objectContaining({
          identifier: "FEEDBACK",
          cardinality: "single",
          baseType: "identifier",
        }),
      );
      expect(item.modalFeedback).toMatchObject([
        {
          identifier: "RIGHT",
          outcomeIdentifier: "FEEDBACK",
          showHide: "show",
          text: "Correct answer.",
        },
        { identifier: "A", outcomeIdentifier: "FEEDBACK", showHide: "show", text: "Less < more." },
      ]);
      expect(xml).not.toContain("rptemplates/");
      expect(xml).toContain("<qti-null/>");
      expect(xml).toContain("<p>Correct <strong>answer</strong>.</p>");
      expect(xml).toContain("Less &lt; more.");
      expect(xml).toContain("<qti-response-processing>");
      const processingXml = xml.slice(xml.indexOf("<qti-response-processing>"));
      if (scoring === "map_response") {
        expect(processingXml).toContain("<qti-map-response");
        expect(processingXml).not.toContain("<qti-correct");
        expect(item.responseDeclarations[0]?.mapping?.entries).toHaveLength(3);
      } else {
        expect(processingXml).toContain("<qti-correct");
        expect(processingXml).not.toContain("<qti-map-response");
      }

      for (const [response, score, feedbackIdentifier] of [
        ["B", 1, "RIGHT"],
        ["A", 0, "A"],
      ] as const) {
        const session = createItemSession(parsed.document);
        session.respond("RESPONSE", response);
        const scored = session.score();
        expect(scored.outcomes.SCORE).toBe(score);
        expect(scored.outcomes.FEEDBACK).toBe(feedbackIdentifier);
        expect(visibleModalFeedback(item, scored.outcomes)).toMatchObject([
          { identifier: feedbackIdentifier },
        ]);
      }
      for (const response of [undefined, "C"] as const) {
        const session = createItemSession(parsed.document);
        if (response !== undefined) session.respond("RESPONSE", response);
        const scored = session.score();
        expect(scored.outcomes.FEEDBACK).toBeNull();
        expect(visibleModalFeedback(item, scored.outcomes)).toEqual([]);
      }
    },
  );

  it.each(["match_correct", "map_response"] as const)(
    "uses a custom response identifier for feedback and %s scoring",
    (scoring) => {
      const xml = buildQti3ChoiceItem({
        identifier: `feedback-answer-${scoring}`,
        title: "Custom response feedback",
        responseIdentifier: "ANSWER",
        responseCardinality: "single",
        choices: [
          { identifier: "A", text: "A" },
          { identifier: "B", text: "B" },
        ],
        correctResponse: ["B"],
        scoring,
        feedback: {
          outcomeIdentifier: "EXPLANATION",
          entries: [
            { choiceIdentifier: "B", identifier: "RIGHT", text: "Right." },
            { choiceIdentifier: "A", identifier: "WRONG", text: "Try again." },
          ],
        },
      });
      const item = expectValidParsedItem(xml);
      const parsed = parseQtiXml(xml);
      if (!parsed.document) throw new Error("Expected a parsed item document.");
      for (const [answer, score, feedbackIdentifier] of [
        ["B", 1, "RIGHT"],
        ["A", 0, "WRONG"],
      ] as const) {
        const session = createItemSession(parsed.document);
        session.respond("ANSWER", answer);
        const scored = session.score();
        expect(scored.outcomes).toMatchObject({ SCORE: score, EXPLANATION: feedbackIdentifier });
        expect(visibleModalFeedback(item, scored.outcomes)).toMatchObject([
          { identifier: feedbackIdentifier },
        ]);
      }
      expect(xml).toContain('<qti-variable identifier="ANSWER"/>');
      expect(xml).not.toContain('<qti-variable identifier="RESPONSE"/>');
      expect(xml).toContain("<qti-response-processing>");
      const processingXml = xml.slice(xml.indexOf("<qti-response-processing>"));
      if (scoring === "map_response") {
        expect(processingXml).toContain('<qti-map-response identifier="ANSWER"/>');
        expect(processingXml).not.toContain("<qti-correct");
      } else {
        expect(processingXml).toContain('<qti-correct identifier="ANSWER"/>');
        expect(processingXml).not.toContain("<qti-map-response");
      }
    },
  );

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
    expect(parsed.responseProcessing?.template).toContain("rptemplates/match_correct");
  });

  it("normalizes choice identifiers and response references before serialization", () => {
    const item = expectValidParsedItem(
      buildQti3ChoiceItem({
        identifier: "choice-normalized-identifiers",
        title: "Normalized identifiers",
        responseCardinality: "single",
        choices: [
          { identifier: " A ", text: "A" },
          { identifier: " B ", text: "B" },
        ],
        correctResponse: [" B "],
        scoring: "map_response",
      }),
    );

    expect(item.responseDeclarations[0]).toMatchObject({
      correctResponse: "B",
      mapping: {
        entries: [
          expect.objectContaining({ mapKey: "A", mappedValue: 0 }),
          expect.objectContaining({ mapKey: "B", mappedValue: 1 }),
        ],
      },
    });
    expect(item.interactions[0]?.choices.map((choice) => choice.identifier)).toEqual(["A", "B"]);
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
