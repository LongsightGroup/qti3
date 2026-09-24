import { createItemSession, parseQtiXml } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import {
  buildQti3ChoiceItem,
  buildQti3CustomInteractionItem,
  buildQti3PortableCustomItem,
  qti3TrustedXmlFragment,
  writeQti3AssessmentItemResult,
  type Qti3AuthoringItem,
} from "./index.js";

const ownProcessing = qti3TrustedXmlFragment(
  '<qti-set-outcome-value identifier="SCORE"><qti-base-value base-type="float">3</qti-base-value></qti-set-outcome-value>',
);
const feedbackProcessing = qti3TrustedXmlFragment(
  '<qti-set-outcome-value identifier="SCORE"><qti-base-value base-type="float">7</qti-base-value></qti-set-outcome-value>',
);

describe("feedback processing ownership", () => {
  it.each(["custom", "portableCustom"] as const)(
    "rejects competing %s processing and preserves either sole source",
    (interactionType) => {
      const base = {
        identifier: "processing",
        title: "Processing",
        interactionMarkupHtml: qti3TrustedXmlFragment("<p>Widget</p>"),
      };
      const item: Qti3AuthoringItem =
        interactionType === "custom"
          ? { ...base, interactionType }
          : {
              ...base,
              interactionType,
              customInteractionTypeIdentifier: "urn:test:pci",
              module: "widget",
            };
      const modalFeedback = {
        outcomes: [{ identifier: "FEEDBACK", cardinality: "single" as const }],
        entries: [{ outcomeIdentifier: "FEEDBACK", identifier: "RIGHT", text: "Feedback" }],
      };
      const conflicting = {
        ...item,
        responseProcessingXml: ownProcessing,
        modalFeedback: { ...modalFeedback, responseProcessingXml: feedbackProcessing },
      };
      const result = writeQti3AssessmentItemResult(conflicting);
      expect(result.ok).toBe(false);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "conflicting_response_processing",
          path: "modalFeedback.responseProcessingXml",
        }),
      );
      if (conflicting.interactionType === "custom")
        expect(() => buildQti3CustomInteractionItem(conflicting)).toThrow();
      else expect(() => buildQti3PortableCustomItem(conflicting)).toThrow();

      for (const [useOwn, expectedScore] of [
        [true, 3],
        [false, 7],
      ] as const) {
        const written = writeQti3AssessmentItemResult({
          ...item,
          responseProcessingXml: useOwn ? ownProcessing : undefined,
          modalFeedback: {
            ...modalFeedback,
            responseProcessingXml: useOwn ? undefined : feedbackProcessing,
          },
        });
        expect(written.ok).toBe(true);
        if (!written.ok) throw new Error("Expected valid authoring item");
        expect(written.xml.match(/<qti-response-processing>/g)).toHaveLength(1);
        const parsed = parseQtiXml(written.xml);
        if (!parsed.document) throw new Error("Expected a document");
        expect(createItemSession(parsed.document).score().outcomes.SCORE).toBe(expectedScore);
      }
    },
  );

  it.each(["match_correct", "map_response"] as const)(
    "uses equivalent %s scoring with or without feedback",
    (scoring) => {
      for (const withFeedback of [false, true]) {
        const xml = buildQti3ChoiceItem({
          identifier: "scoring",
          title: "Scoring",
          responseIdentifier: "ANSWER",
          responseCardinality: "single",
          scoring,
          choices: [
            { identifier: "A", text: "A" },
            { identifier: "B", text: "B" },
          ],
          correctResponse: ["A"],
          feedback: withFeedback
            ? { entries: [{ choiceIdentifier: "A", identifier: "RIGHT", text: "Right" }] }
            : undefined,
        });
        const parsed = parseQtiXml(xml);
        expect(parsed.ok).toBe(true);
        if (!parsed.document) throw new Error("Expected a document");
        const session = createItemSession(parsed.document);
        session.respond("ANSWER", "A");
        expect(session.score().outcomes.SCORE).toBe(1);
        session.respond("ANSWER", "B");
        expect(session.score().outcomes.SCORE).toBe(0);
      }
    },
  );

  it.each([undefined, 0, 2])(
    "applies multiple-choice selection limits independently of feedback: %s",
    (maxChoices) => {
      const xml = buildQti3ChoiceItem({
        identifier: "limits",
        title: "Limits",
        responseCardinality: "multiple",
        maxChoices,
        choices: [
          { identifier: "A", text: "A" },
          { identifier: "B", text: "B" },
        ],
        correctResponse: ["A", "B"],
      });
      expect(xml).toContain(`max-choices="${maxChoices ?? 0}"`);
      expect(parseQtiXml(xml).ok).toBe(true);
    },
  );
});
