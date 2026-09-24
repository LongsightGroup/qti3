import { createItemSession, parseQtiXml, visibleModalFeedback } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import {
  qti3TrustedXmlFragment,
  writeQti3AssessmentItem,
  writeQti3AssessmentItemResult,
  type Qti3OrderAuthoringItem,
} from "./index.js";
import { expectValidParsedItem } from "./test-helpers.js";

const orderItem: Qti3OrderAuthoringItem = {
  interactionType: "order",
  identifier: "order-modal-feedback",
  title: "Order with feedback",
  responseIdentifier: "ORDER",
  choices: [
    { identifier: "A", text: "First" },
    { identifier: "B", text: "Second" },
  ],
  correctOrder: ["A", "B"],
};

describe("item-level modal feedback", () => {
  it("authors response-driven rich feedback on a non-choice interaction", () => {
    const xml = writeQti3AssessmentItem({
      ...orderItem,
      modalFeedback: {
        outcomes: [
          { identifier: "EXPLANATION", cardinality: "single" },
          { identifier: "VISIBILITY", cardinality: "single" },
        ],
        entries: [
          {
            outcomeIdentifier: "EXPLANATION",
            identifier: "RIGHT",
            title: "Correct order",
            contentHtml: qti3TrustedXmlFragment(
              "<qti-content-body><p>Correct <strong>order</strong>.</p></qti-content-body>",
            ),
          },
          {
            outcomeIdentifier: "VISIBILITY",
            identifier: "HIDE_WHEN_RIGHT",
            showHide: "hide",
            text: "Try another order.",
          },
        ],
        responseProcessingXml: qti3TrustedXmlFragment(`
          <qti-response-condition>
            <qti-response-if>
              <qti-match><qti-variable identifier="ORDER"/><qti-correct identifier="ORDER"/></qti-match>
              <qti-set-outcome-value identifier="SCORE"><qti-base-value base-type="float">1</qti-base-value></qti-set-outcome-value>
              <qti-set-outcome-value identifier="EXPLANATION"><qti-base-value base-type="identifier">RIGHT</qti-base-value></qti-set-outcome-value>
              <qti-set-outcome-value identifier="VISIBILITY"><qti-base-value base-type="identifier">HIDE_WHEN_RIGHT</qti-base-value></qti-set-outcome-value>
            </qti-response-if>
            <qti-response-else>
              <qti-set-outcome-value identifier="SCORE"><qti-base-value base-type="float">0</qti-base-value></qti-set-outcome-value>
              <qti-set-outcome-value identifier="EXPLANATION"><qti-base-value base-type="identifier">WRONG</qti-base-value></qti-set-outcome-value>
            </qti-response-else>
          </qti-response-condition>`),
      },
    });
    const item = expectValidParsedItem(xml);
    const parsed = parseQtiXml(xml);
    if (!parsed.document) throw new Error("Expected a parsed item document.");
    expect(xml).not.toContain("rptemplates/match_correct");
    expect(item.modalFeedback[0]).toMatchObject({
      title: "Correct order",
      text: "Correct order.",
    });
    expect(item.modalFeedback[0]?.content).toBeDefined();
    expect(xml).toContain('show-hide="hide"');

    for (const [answer, score, identifiers] of [
      [["A", "B"], 1, ["RIGHT"]],
      [["B", "A"], 0, ["HIDE_WHEN_RIGHT"]],
    ] as const) {
      const session = createItemSession(parsed.document);
      session.respond("ORDER", [...answer]);
      const scored = session.score();
      expect(scored.outcomes.SCORE).toBe(score);
      expect(visibleModalFeedback(item, scored.outcomes).map((entry) => entry.identifier)).toEqual(
        identifiers,
      );
    }
  });

  it("rejects undeclared outcomes and interactions inside modal feedback", () => {
    const result = writeQti3AssessmentItemResult({
      ...orderItem,
      modalFeedback: {
        outcomes: [{ identifier: "EXPLANATION", cardinality: "single" }],
        entries: [
          {
            outcomeIdentifier: "UNKNOWN",
            identifier: "BAD",
            contentHtml: qti3TrustedXmlFragment(
              '<qti-choice-interaction response-identifier="ORDER"><qti-simple-choice identifier="A">A</qti-simple-choice></qti-choice-interaction>',
            ),
          },
        ],
      },
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "unknown_feedback_outcome" }),
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "invalid_feedback_content" }),
    );
  });

  it("accepts printed variables in trusted modal feedback content", () => {
    const xml = writeQti3AssessmentItem({
      ...orderItem,
      responseIdentifier: "RESPONSE",
      modalFeedback: {
        outcomes: [{ identifier: "EXPLANATION", cardinality: "single" }],
        entries: [
          {
            outcomeIdentifier: "EXPLANATION",
            identifier: "SCORE_MESSAGE",
            contentHtml: qti3TrustedXmlFragment(
              '<p>Score: <qti-printed-variable identifier="SCORE"/></p>',
            ),
          },
        ],
      },
    });
    const item = expectValidParsedItem(xml);
    expect(item.modalFeedback[0]?.content).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "element", qtiName: "p" })]),
    );
  });
});
