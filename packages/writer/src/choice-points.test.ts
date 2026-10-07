import { describe, expect, it } from "vitest";
import { createItemSession, scoreQtiItemServerSide } from "@longsightgroup/qti3-core";
import { validQtiDocument } from "../../../tests/fixtures/valid-qti-document.js";
import {
  qti3TrustedXmlFragment,
  writeQti3AssessmentItemResult,
  type Qti3ChoiceAuthoringItem,
} from "./index.js";

function choice(overrides: Partial<Qti3ChoiceAuthoringItem> = {}): Qti3ChoiceAuthoringItem {
  return {
    interactionType: "choice",
    identifier: "choice-points",
    title: "Choice points",
    responseCardinality: "single",
    choices: [
      { identifier: "A", text: "Alpha" },
      { identifier: "B", text: "Beta" },
      { identifier: "C", text: "Gamma" },
    ],
    correctResponse: ["A"],
    maximumScore: 3,
    ...overrides,
  };
}

// QTI 3 BPIG §§3.4–3.5: SCORE comes from processing, not normal-maximum metadata.
// This authoring policy splits mapped credit equally and never deducts for wrong choices.
// Explicit examples are independent of the writer and its score normalization helpers.
describe("choice point maximum through XML and the shared scoring engine", () => {
  for (const responseIdentifier of ["RESPONSE", "ANSWER"]) {
    for (const responseCardinality of ["single", "multiple"] as const) {
      for (const scoring of ["match_correct", "map_response"] as const) {
        for (const feedback of [false, true]) {
          it.each([
            { maximumScore: 3, half: 1.5 },
            { maximumScore: 2.5, half: 1.25 },
            { maximumScore: 0, half: 0 },
          ])(
            `${responseIdentifier}/${responseCardinality}/${scoring}/feedback=${feedback} awards $maximumScore points`,
            ({ maximumScore, half }) => {
              const result = writeQti3AssessmentItemResult(
                choice({
                  responseIdentifier,
                  responseCardinality,
                  correctResponse: responseCardinality === "single" ? ["A"] : ["A", "B"],
                  scoring,
                  maximumScore,
                  feedback: feedback
                    ? {
                        entries: [
                          { choiceIdentifier: "A", identifier: "HINT", text: "Alpha hint" },
                        ],
                      }
                    : undefined,
                }),
              );
              expect(result.ok).toBe(true);
              if (!result.ok) throw new Error("Expected valid point authoring.");
              const document = validQtiDocument(result.xml);
              const maximum = document.item.outcomeDeclarations.find(
                (d) => d.identifier === "MAXSCORE",
              );
              const score = document.item.outcomeDeclarations.find((d) => d.identifier === "SCORE");
              expect(maximum?.defaultValue).toBe(maximumScore);
              expect(score?.attributes["normal-maximum"]).toBe(
                maximumScore === 0 ? undefined : String(maximumScore),
              );
              const rows =
                responseCardinality === "single"
                  ? ([
                      [null, 0],
                      ["C", 0],
                      ["A", maximumScore],
                    ] as const)
                  : ([
                      [null, 0],
                      [[], 0],
                      [["C"], 0],
                      [["A"], scoring === "match_correct" ? 0 : half],
                      [["A", "C"], scoring === "match_correct" ? 0 : half],
                      [["A", "B"], maximumScore],
                      [["A", "B", "C"], scoring === "match_correct" ? 0 : maximumScore],
                    ] as const);
              for (const [response, expected] of rows) {
                const session = createItemSession(document);
                session.respond(
                  responseIdentifier,
                  typeof response === "string" || response === null
                    ? response
                    : Array.from(response),
                );
                const outcomes = session.score().outcomes;
                expect(outcomes.SCORE).toBe(expected);
                expect(outcomes.MAXSCORE).toBe(maximumScore);
                if (feedback) {
                  const selected =
                    response === "A" || (Array.isArray(response) && response.includes("A"));
                  expect(outcomes.FEEDBACK).toEqual(
                    selected ? (responseCardinality === "multiple" ? ["HINT"] : "HINT") : null,
                  );
                }
              }
            },
          );
        }
      }
    }
  }

  it("awards the exact full maximum for three mapped correct choices and retains implicit scoring", () => {
    for (const [maximumScore, expected] of [
      [2.5, 2.5],
      [undefined, 3],
    ] as const) {
      const result = writeQti3AssessmentItemResult(
        choice({
          responseCardinality: "multiple",
          correctResponse: ["A", "B", "C"],
          scoring: "map_response",
          maximumScore,
        }),
      );
      if (!result.ok) throw new Error("Expected a valid three-choice item.");
      const session = createItemSession(validQtiDocument(result.xml));
      session.respond("RESPONSE", ["A", "B", "C"]);
      expect(session.score().outcomes.SCORE).toBe(expected);
    }
  });

  it("uses authoritative point scores at the server seam without scaling totals or trusting forged outcomes", () => {
    const scores: number[] = [];
    const maxima: number[] = [];
    for (const [item, response, expectedScore, expectedMaximum] of [
      [choice(), "A", 3, 3],
      [
        choice({
          responseCardinality: "multiple",
          correctResponse: ["A", "B"],
          scoring: "map_response",
          maximumScore: 2.5,
        }),
        ["A", "C"],
        1.25,
        2.5,
      ],
      [choice({ maximumScore: 0 }), "A", 0, 0],
    ] as const) {
      const written = writeQti3AssessmentItemResult(item);
      if (!written.ok) throw new Error("Expected valid server-scored XML.");
      validQtiDocument(written.xml);
      const result = scoreQtiItemServerSide({
        itemXml: written.xml,
        trustedResponses: { RESPONSE: response, SCORE: 999, MAXSCORE: 999 },
      });
      expect(result.ok).toBe(true);
      expect(result.score).toBe(expectedScore);
      expect(result.outcomes.MAXSCORE).toBe(expectedMaximum);
      expect(result.responses).not.toHaveProperty("SCORE");
      expect(result.responses).not.toHaveProperty("MAXSCORE");
      if (typeof result.score !== "number" || typeof result.outcomes.MAXSCORE !== "number") {
        throw new Error("Expected numeric server-owned scores.");
      }
      scores.push(result.score);
      maxima.push(result.outcomes.MAXSCORE);
    }
    expect(scores.reduce((total, score) => total + score, 0)).toBe(4.25);
    expect(maxima.reduce((total, maximum) => total + maximum, 0)).toBe(5.5);
  });

  it.each([-1, NaN, Infinity, -Infinity])("rejects invalid point maximum %s", (maximumScore) => {
    expect(writeQti3AssessmentItemResult(choice({ maximumScore }))).toMatchObject({
      ok: false,
      diagnostics: [{ code: "invalid_choice_maximum_score", path: "maximumScore" }],
    });
  });

  it("refuses a point override of a custom scoring program without changing caller data", () => {
    const item = choice({
      modalFeedback: {
        outcomes: [{ identifier: "FEEDBACK", cardinality: "single" }],
        entries: [{ outcomeIdentifier: "FEEDBACK", identifier: "HINT", text: "Hint" }],
        responseProcessingXml: qti3TrustedXmlFragment(
          '<qti-response-processing><qti-set-outcome-value identifier="SCORE"><qti-base-value base-type="float">7</qti-base-value></qti-set-outcome-value></qti-response-processing>',
        ),
      },
    });
    const before = JSON.stringify(item);
    expect(writeQti3AssessmentItemResult(item)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "conflicting_choice_score_program", path: "maximumScore" }],
    });
    expect(JSON.stringify(item)).toBe(before);
    const preserved = writeQti3AssessmentItemResult({ ...item, maximumScore: undefined });
    if (!preserved.ok) throw new Error("Expected unchanged custom processing to remain writable.");
    expect(createItemSession(validQtiDocument(preserved.xml)).score().outcomes.SCORE).toBe(7);
  });

  it("refuses competing maximum declarations and unreachable complete answers", () => {
    for (const overrides of [
      {
        modalFeedback: {
          outcomes: [{ identifier: "MAXSCORE", cardinality: "single" as const }],
          entries: [{ outcomeIdentifier: "MAXSCORE", identifier: "HINT", text: "Hint" }],
        },
      },
      { responseIdentifier: "MAXSCORE" },
      {
        feedback: {
          outcomeIdentifier: "MAXSCORE",
          entries: [{ choiceIdentifier: "A", identifier: "HINT", text: "Hint" }],
        },
      },
      { responseCardinality: "multiple" as const, correctResponse: ["A", "B"], maxChoices: 1 },
      { responseCardinality: "multiple" as const, correctResponse: ["A"], minChoices: 2 },
    ]) {
      const result = writeQti3AssessmentItemResult(choice(overrides));
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Expected conflicting point authoring to fail.");
      expect(result.diagnostics.map((d) => d.code)).toContain("conflicting_choice_score_program");
    }
  });
});
