import { createItemSession, visibleModalFeedback } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import { validQtiDocument } from "../../../tests/fixtures/valid-qti-document.js";
import {
  buildQti3ChoiceItem,
  buildQti3InlineChoiceItem,
  qti3TrustedXmlFragment,
  writeQti3AssessmentItemResult,
  type Qti3ChoiceAuthoringItem,
  type Qti3InlineChoiceAuthoringItem,
} from "./index.js";

const responseFeedback = {
  correct: { text: "Complete answer." },
  incorrect: {
    contentHtml: qti3TrustedXmlFragment(
      '<p>Try again. <a href="https://example.org/explanation">Explanation</a></p>',
    ),
  },
};

function choice(
  responseIdentifier: string,
  responseCardinality: "single" | "multiple",
  scoring: "match_correct" | "map_response",
  maximumScore: number | undefined,
): Qti3ChoiceAuthoringItem {
  return {
    interactionType: "choice",
    identifier: "response-feedback",
    title: "Response feedback",
    responseIdentifier,
    responseCardinality,
    scoring,
    maximumScore,
    choices: [
      { identifier: "A", text: "Alpha" },
      { identifier: "B", text: "Beta" },
      { identifier: "C", text: "Gamma" },
    ],
    correctResponse: responseCardinality === "single" ? ["A"] : ["A", "B"],
    responseFeedback,
  };
}

// QTI 3.0.1 information model §§6.9.21 (match), 6.9.32 (isNull), 2.6.2 (modal feedback):
// https://www.imsglobal.org/sites/default/files/spec/qti/v3/info/imsqti_asi_v3p0p1_infomodel_v1p0.html
// This authoring
// policy classifies exact answer-key matches, not score == maximum (mapped distractors can
// still earn the maximum, and zero-point items have equal correct/incorrect scores).
describe("whole-response feedback through public writers, QTI processing and projection", () => {
  for (const responseIdentifier of ["RESPONSE", "ANSWER"]) {
    for (const responseCardinality of ["single", "multiple"] as const) {
      for (const scoring of ["match_correct", "map_response"] as const) {
        it.each([undefined, 0, 2.5])(
          `${responseIdentifier}/${responseCardinality}/${scoring} preserves maximum %s and exact conditions`,
          (maximumScore) => {
            const input = choice(responseIdentifier, responseCardinality, scoring, maximumScore);
            for (const xml of [buildQti3ChoiceItem(input), written(input)]) {
              const document = validQtiDocument(xml);
              const session = createItemSession(document);
              const full =
                maximumScore ??
                (scoring === "map_response" && responseCardinality === "multiple" ? 2 : 1);
              const half = maximumScore === undefined ? 1 : maximumScore / 2;
              const rows =
                responseCardinality === "single"
                  ? ([
                      ["A", full, "CORRECT"],
                      ["C", 0, "INCORRECT"],
                      [null, 0, null],
                    ] as const)
                  : ([
                      [["B", "A"], full, "CORRECT"],
                      [["A"], scoring === "map_response" ? half : 0, "INCORRECT"],
                      [["A", "B", "C"], scoring === "map_response" ? full : 0, "INCORRECT"],
                      [["C"], 0, "INCORRECT"],
                      [[], 0, null],
                      [null, 0, null],
                    ] as const);
              // Reuse the session: a stale correct/incorrect explanation must clear on retry/null.
              for (const [response, score, feedback] of rows) {
                session.respond(
                  responseIdentifier,
                  typeof response === "string" || response === null ? response : [...response],
                );
                const outcomes = session.score().outcomes;
                expect(outcomes.SCORE).toBe(score);
                expect(outcomes.RESPONSE_FEEDBACK).toBe(feedback);
                expect(
                  visibleModalFeedback(document.item, outcomes).map((entry) => entry.identifier),
                ).toEqual(feedback === null ? [] : [feedback]);
              }
            }
          },
        );
      }
    }
  }

  it.each(["all_or_nothing", "map_response"] as const)(
    "classifies the complete dropdown response with %s scoring, retaining partial and blank slots",
    (scoring) => {
      const input: Qti3InlineChoiceAuthoringItem = {
        interactionType: "inlineChoice",
        identifier: "dropdown-feedback",
        title: "Dropdown feedback",
        scoring,
        bodyHtml: qti3TrustedXmlFragment(
          '<p><qti-inline-choice-interaction response-identifier="FIRST"/> <qti-inline-choice-interaction response-identifier="SECOND"/></p>',
        ),
        slots: ["FIRST", "SECOND"].map((responseIdentifier) => ({
          responseIdentifier,
          correctResponse: "A",
          options: [
            { identifier: "A", text: "Alpha" },
            { identifier: "B", text: "Beta" },
          ],
        })),
        responseFeedback: { ...responseFeedback, outcomeIdentifier: "EXPLANATION" },
      };
      for (const xml of [buildQti3InlineChoiceItem(input), written(input)]) {
        const document = validQtiDocument(xml);
        const session = createItemSession(document);
        for (const [first, second, score, feedback] of [
          ["A", "A", 2, "CORRECT"],
          ["A", "B", scoring === "map_response" ? 1 : 0, "INCORRECT"],
          ["A", null, scoring === "map_response" ? 1 : 0, "INCORRECT"],
          [null, null, 0, null],
        ] as const) {
          session.respond("FIRST", first);
          session.respond("SECOND", second);
          const outcomes = session.score().outcomes;
          expect(outcomes.SCORE).toBe(score);
          expect(outcomes.EXPLANATION).toBe(feedback);
          expect(
            visibleModalFeedback(document.item, outcomes).map((entry) => entry.identifier),
          ).toEqual(feedback === null ? [] : [feedback]);
        }
      }
    },
  );

  it("allows one explanation without displaying the other condition or changing its score", () => {
    for (const condition of ["correct", "incorrect"] as const) {
      const input = {
        ...choice("RESPONSE", "single", "match_correct", 0),
        responseFeedback: { [condition]: { text: "Only explanation." } },
      };
      const document = validQtiDocument(written(input));
      const session = createItemSession(document);
      for (const response of ["A", "C", null]) {
        session.respond("RESPONSE", response);
        const outcomes = session.score().outcomes;
        expect(outcomes.SCORE).toBe(0);
        expect(visibleModalFeedback(document.item, outcomes).map((entry) => entry.text)).toEqual(
          (condition === "correct" && response === "A") ||
            (condition === "incorrect" && response === "C")
            ? ["Only explanation."]
            : [],
        );
      }
    }
  });

  it.each([0, 2.5])(
    "retains dropdown maximum %s while classifying the response independently",
    (maximumScore) => {
      const input: Qti3InlineChoiceAuthoringItem = {
        interactionType: "inlineChoice",
        identifier: "weighted-dropdown-feedback",
        title: "Weighted dropdown",
        bodyHtml: qti3TrustedXmlFragment(
          '<p><qti-inline-choice-interaction response-identifier="ANSWER"/></p>',
        ),
        slots: [
          {
            responseIdentifier: "ANSWER",
            correctResponse: "A",
            options: [
              { identifier: "A", text: "Alpha" },
              { identifier: "B", text: "Beta" },
            ],
          },
        ],
        maximumScore,
        responseFeedback,
      };
      const document = validQtiDocument(written(input));
      const session = createItemSession(document);
      for (const [response, score, feedback] of [
        ["A", maximumScore, "CORRECT"],
        ["B", 0, "INCORRECT"],
        [null, 0, null],
      ] as const) {
        session.respond("ANSWER", response);
        const outcomes = session.score().outcomes;
        expect(outcomes.SCORE).toBe(score);
        expect(outcomes.MAXSCORE).toBe(maximumScore);
        expect(outcomes.RESPONSE_FEEDBACK).toBe(feedback);
      }
      const collision = writeQti3AssessmentItemResult({
        ...input,
        responseFeedback: { ...responseFeedback, outcomeIdentifier: "MAXSCORE" },
      });
      expect(collision.ok).toBe(false);
      expect(collision.diagnostics).toContainEqual(
        expect.objectContaining({ code: "conflicting_inline_choice_score_program" }),
      );
      const choiceCollision = writeQti3AssessmentItemResult({
        ...choice("RESPONSE", "single", "match_correct", maximumScore),
        responseFeedback: { ...responseFeedback, outcomeIdentifier: "MAXSCORE" },
      });
      expect(choiceCollision.ok).toBe(false);
      expect(choiceCollision.diagnostics).toContainEqual(
        expect.objectContaining({ code: "conflicting_choice_score_program" }),
      );
    },
  );

  it("rejects conflicting models and unkeyed dropdowns without changing caller data", () => {
    const input = choice("RESPONSE", "single", "match_correct", undefined);
    for (const conflict of [
      { feedback: { entries: [{ choiceIdentifier: "A", identifier: "HINT", text: "Hint" }] } },
      {
        modalFeedback: {
          outcomes: [{ identifier: "OTHER", cardinality: "single" as const }],
          entries: [{ outcomeIdentifier: "OTHER", identifier: "HINT", text: "Hint" }],
          responseProcessingXml: qti3TrustedXmlFragment(
            '<qti-set-outcome-value identifier="SCORE"><qti-base-value base-type="float">7</qti-base-value></qti-set-outcome-value>',
          ),
        },
      },
    ]) {
      const candidate = { ...input, ...conflict };
      const before = JSON.stringify(candidate);
      const result = writeQti3AssessmentItemResult(candidate);
      expect(result.ok).toBe(false);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({ code: "conflicting_feedback_models" }),
      );
      expect(JSON.stringify(candidate)).toBe(before);
    }
    const result = writeQti3AssessmentItemResult({
      interactionType: "inlineChoice",
      identifier: "unkeyed",
      title: "Unkeyed",
      bodyHtml: qti3TrustedXmlFragment(
        '<p><qti-inline-choice-interaction response-identifier="SLOT"/></p>',
      ),
      slots: [{ responseIdentifier: "SLOT", options: [{ identifier: "A", text: "Alpha" }] }],
      responseFeedback,
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "missing_feedback_correct_response",
        path: "slots.0.correctResponse",
      }),
    );
  });

  it("rejects answer keys made unreachable by selection limits independently of points", () => {
    for (const limits of [{ maxChoices: 1 }, { minChoices: 3 }]) {
      const result = writeQti3AssessmentItemResult({
        ...choice("RESPONSE", "multiple", "map_response", undefined),
        ...limits,
      });
      expect(result.ok).toBe(false);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "unreachable_feedback_correct_response",
          path: "correctResponse",
        }),
      );
    }
  });

  it("uses the shared content and outcome contract for explanation diagnostics", () => {
    const input = choice("ANSWER", "single", "match_correct", undefined);
    for (const [feedback, code, path] of [
      [{}, "missing_feedback_entries", "responseFeedback.entries"],
      [{ correct: { text: " " } }, "invalid_feedback_content", "responseFeedback.correct"],
      [
        { correct: { text: "Text", contentHtml: qti3TrustedXmlFragment("<p>HTML</p>") } },
        "invalid_feedback_content",
        "responseFeedback.correct",
      ],
      [
        { ...responseFeedback, outcomeIdentifier: "ANSWER" },
        "invalid_feedback_outcome",
        "responseFeedback.outcomeIdentifier",
      ],
      [
        { ...responseFeedback, outcomeIdentifier: "SCORE" },
        "invalid_feedback_outcome",
        "responseFeedback.outcomeIdentifier",
      ],
      [
        {
          correct: {
            contentHtml: qti3TrustedXmlFragment(
              '<p><qti-text-entry-interaction response-identifier="HIDDEN"/></p>',
            ),
          },
        },
        "feedback.interaction.forbidden",
        "responseFeedback.correct.contentHtml",
      ],
    ] as const) {
      const result = writeQti3AssessmentItemResult({ ...input, responseFeedback: feedback });
      expect(result.ok).toBe(false);
      expect(result.diagnostics).toContainEqual(expect.objectContaining({ code, path }));
    }
  });
});

function written(input: Qti3ChoiceAuthoringItem | Qti3InlineChoiceAuthoringItem): string {
  const result = writeQti3AssessmentItemResult(input);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.xml;
}
