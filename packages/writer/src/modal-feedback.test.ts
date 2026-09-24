import { createItemSession, parseQtiXml, visibleModalFeedback } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import {
  qti3TrustedXmlFragment,
  writeQti3AssessmentItem,
  writeQti3AssessmentItemResult,
  type Qti3OrderAuthoringItem,
  type Qti3AuthoringItem,
  type Qti3ChoiceAuthoringItem,
  type Qti3ModalFeedbackEntry,
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
  it.each(["textEntry", "inlineChoice"] as const)(
    "checks every %s response for outcome collisions",
    (interactionType) => {
      const identifiers = ["FIRST", "SECOND"];
      const common = { identifier: "collision", title: "Collision" };
      const item: Qti3AuthoringItem =
        interactionType === "textEntry"
          ? {
              ...common,
              interactionType,
              bodyHtml: qti3TrustedXmlFragment(
                identifiers
                  .map((id) => `<qti-text-entry-interaction response-identifier="${id}"/>`)
                  .join(" "),
              ),
              responses: identifiers.map((responseIdentifier) => ({
                responseIdentifier,
                answers: [{ value: "yes" }],
              })),
            }
          : {
              ...common,
              interactionType,
              bodyHtml: qti3TrustedXmlFragment(
                identifiers
                  .map((id) => `<qti-inline-choice-interaction response-identifier="${id}"/>`)
                  .join(" "),
              ),
              slots: identifiers.map((responseIdentifier) => ({
                responseIdentifier,
                correctResponse: "A",
                options: [
                  { identifier: "A", text: "A" },
                  { identifier: "B", text: "B" },
                ],
              })),
            };
      for (const identifier of [...identifiers, "EXPLANATION"]) {
        const result = writeQti3AssessmentItemResult({
          ...item,
          modalFeedback: {
            outcomes: [{ identifier, cardinality: "single" }],
            entries: [{ outcomeIdentifier: identifier, identifier: "RIGHT", text: "Correct." }],
          },
        });
        if (identifier === "EXPLANATION") {
          expect(result.ok).toBe(true);
          if (result.ok) expectValidParsedItem(result.xml);
        } else {
          expect(result.ok).toBe(false);
          expect(result.diagnostics).toContainEqual(
            expect.objectContaining({
              code: "invalid_feedback_outcome",
              path: "modalFeedback.outcomes.0.identifier",
            }),
          );
        }
      }
    },
  );

  it.each(["choice", "item"] as const)(
    "uses the same content contract for %s feedback",
    (model) => {
      const base: Qti3ChoiceAuthoringItem = {
        interactionType: "choice",
        identifier: "content",
        title: "Content",
        responseCardinality: "single",
        choices: [
          { identifier: "A", text: "A" },
          { identifier: "B", text: "B" },
        ],
        correctResponse: ["A"],
      };
      const cases: readonly {
        content: Pick<Qti3ModalFeedbackEntry, "text" | "contentHtml">;
        expectedText?: string;
      }[] = [
        {
          content: { text: "Visible explanation", contentHtml: qti3TrustedXmlFragment(" ") },
          expectedText: "Visible explanation",
        },
        {
          content: { text: " ", contentHtml: qti3TrustedXmlFragment("<p>Rich explanation</p>") },
          expectedText: "Rich explanation",
        },
        {
          content: {
            contentHtml: qti3TrustedXmlFragment('<img src="diagram.png" alt="Diagram"/>'),
          },
          expectedText: "Diagram",
        },
        {
          content: {
            contentHtml: qti3TrustedXmlFragment('<qti-printed-variable identifier="SCORE"/>'),
          },
          expectedText: "",
        },
        { content: { contentHtml: qti3TrustedXmlFragment("<p></p>") } },
        { content: { contentHtml: qti3TrustedXmlFragment("<p>Unclosed") } },
        { content: { text: "Text", contentHtml: qti3TrustedXmlFragment("<p>HTML</p>") } },
        {
          content: {
            contentHtml: qti3TrustedXmlFragment(
              '<qti-text-entry-interaction response-identifier="RESPONSE"/>',
            ),
          },
        },
      ];
      for (const { content, expectedText } of cases) {
        const result = writeQti3AssessmentItemResult({
          ...base,
          ...(model === "choice"
            ? {
                feedback: { entries: [{ choiceIdentifier: "A", identifier: "RIGHT", ...content }] },
              }
            : {
                modalFeedback: {
                  outcomes: [{ identifier: "FEEDBACK", cardinality: "single" }],
                  entries: [{ outcomeIdentifier: "FEEDBACK", identifier: "RIGHT", ...content }],
                },
              }),
        });
        if (expectedText === undefined) {
          expect(result.ok).toBe(false);
          expect(result.diagnostics).toContainEqual(
            expect.objectContaining({ code: "invalid_feedback_content" }),
          );
        } else {
          expect(result.ok).toBe(true);
          if (result.ok)
            expect(expectValidParsedItem(result.xml).modalFeedback[0]?.text).toBe(expectedText);
        }
      }
    },
  );

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
