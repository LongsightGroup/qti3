import { createItemSession, visibleModalFeedback } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import { validQtiDocument } from "../../../tests/fixtures/valid-qti-document.js";
import {
  qti3TrustedXmlFragment,
  writeQti3AssessmentItemResult,
  type Qti3ChoiceAuthoringItem,
} from "./index.js";

// QTI 3 BPIG §3.7.3 and the official ASI schema require qti-content-body in modal feedback.
// These same emitted bytes are XSD-validated by the release gate, then scored and projected.
describe("writer modal feedback content body", () => {
  for (const model of ["choice", "item"] as const) {
    it.each([
      { text: "Read the explanation." },
      {
        contentHtml: qti3TrustedXmlFragment(
          '<p>Read <a href="https://example.org/explanation">the explanation</a>.</p>',
        ),
      },
    ])(`emits valid ${model} feedback with text or rich content`, (content) => {
      const item: Qti3ChoiceAuthoringItem = {
        interactionType: "choice",
        identifier: "feedback-schema",
        title: "Feedback content body",
        responseCardinality: "single",
        choices: [
          { identifier: "A", text: "Alpha" },
          { identifier: "B", text: "Beta" },
        ],
        correctResponse: ["A"],
        ...(model === "choice"
          ? { feedback: { entries: [{ choiceIdentifier: "A", identifier: "RIGHT", ...content }] } }
          : {
              modalFeedback: {
                outcomes: [
                  { identifier: "FEEDBACK", cardinality: "single", defaultValues: ["RIGHT"] },
                ],
                entries: [{ outcomeIdentifier: "FEEDBACK", identifier: "RIGHT", ...content }],
              },
            }),
      };
      const result = writeQti3AssessmentItemResult(item);
      if (!result.ok) throw new Error("Expected valid modal feedback.");
      const document = validQtiDocument(result.xml);
      expect(result.xml).toContain("<qti-content-body>");
      const session = createItemSession(document);
      session.respond("RESPONSE", "A");
      const outcomes = session.score().outcomes;
      expect(outcomes.SCORE).toBe(1);
      expect(outcomes.FEEDBACK).toBe("RIGHT");
      expect(visibleModalFeedback(document.item, outcomes)).toMatchObject([
        { identifier: "RIGHT", text: "Read the explanation." },
      ]);
    });
  }
});
