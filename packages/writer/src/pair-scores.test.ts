import { describe, expect, it } from "vitest";
import { scoreQtiItemServerSide } from "@longsightgroup/qti3-core";
import { validQtiDocument } from "../../../tests/fixtures/valid-qti-document.js";
import {
  qti3TrustedXmlFragment,
  writeQti3AssessmentItemResult,
  type Qti3MatchAuthoringItem,
} from "./index.js";

const match: Qti3MatchAuthoringItem = {
  interactionType: "match",
  identifier: "PAIR",
  title: "Weighted pairs",
  scoring: "map_response",
  sources: [
    { identifier: "A", text: "First", matchMax: 1 },
    { identifier: "B", text: "Second", matchMax: 1 },
  ],
  targets: [
    { identifier: "X", text: "First target", matchMax: 1 },
    { identifier: "Y", text: "Second target", matchMax: 1 },
  ],
  correctResponse: [
    { sourceIdentifier: "A", targetIdentifier: "X", score: 0.25 },
    { sourceIdentifier: "B", targetIdentifier: "Y", score: 0.75 },
  ],
};
describe("explicit pair map scores", () => {
  it("preserves non-unit weights and default unit weights for matching", () => {
    for (const weighted of [true, false]) {
      const result = writeQti3AssessmentItemResult({
        ...match,
        correctResponse: weighted
          ? match.correctResponse
          : match.correctResponse.map(({ sourceIdentifier, targetIdentifier }) => ({
              sourceIdentifier,
              targetIdentifier,
            })),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected pair item");
      validQtiDocument(result.xml);
      for (const [response, expected] of [
        [[], 0],
        [["A X"], weighted ? 0.25 : 1],
        [["B Y"], weighted ? 0.75 : 1],
        [["A X", "B Y"], weighted ? 1 : 2],
        [["A Y"], 0],
      ] as const) {
        const scored = scoreQtiItemServerSide({
          itemXml: result.xml,
          trustedResponses: { RESPONSE: [...response] },
        });
        expect(scored.ok).toBe(true);
        expect(scored.score).toBe(expected);
      }
    }
  });
  it("preserves normalized weights for gap matching", () => {
    const result = writeQti3AssessmentItemResult({
      interactionType: "gapMatch",
      identifier: "GAPS",
      title: "Two gaps",
      bodyHtml: qti3TrustedXmlFragment(
        '<p><qti-gap identifier="X"/> and <qti-gap identifier="Y"/></p>',
      ),
      choices: [{ identifier: "A", kind: "text", text: "Answer", matchMax: 0 }],
      targets: [{ identifier: "X" }, { identifier: "Y" }],
      correctResponse: [
        { sourceIdentifier: "A", targetIdentifier: "X", score: 0.5 },
        { sourceIdentifier: "A", targetIdentifier: "Y", score: 0.5 },
      ],
      scoring: "map_response",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected gap item");
    validQtiDocument(result.xml);
    expect(
      scoreQtiItemServerSide({ itemXml: result.xml, trustedResponses: { RESPONSE: ["A X"] } })
        .score,
    ).toBe(0.5);
    expect(
      scoreQtiItemServerSide({
        itemXml: result.xml,
        trustedResponses: { RESPONSE: ["A X", "A Y"] },
      }).score,
    ).toBe(1);
  });
  it("rejects nonfinite weights and weights combined with all-or-nothing processing", () => {
    for (const item of [
      { ...match, scoring: "match_correct" as const },
      { ...match, correctResponse: [{ sourceIdentifier: "A", targetIdentifier: "X", score: NaN }] },
      {
        ...match,
        correctResponse: [{ sourceIdentifier: "A", targetIdentifier: "X", score: Infinity }],
      },
    ]) {
      const result = writeQti3AssessmentItemResult(item);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Expected rejection");
      expect(result.diagnostics.some((d) => d.code === "invalid_pair_score")).toBe(true);
    }
  });
});
