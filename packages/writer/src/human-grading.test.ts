import { describe, expect, it } from "vitest";
import { scoreQtiItemServerSide } from "@longsightgroup/qti3-core";
import { validQtiDocument } from "../../../tests/fixtures/valid-qti-document.js";
import { qti3TrustedXmlFragment, writeQti3AssessmentItemResult } from "./index.js";

// QTI external-scored="human" identifies an external grading authority, not an automatic zero.
describe("explicit human grading", () => {
  for (const interactionType of ["extendedText", "upload"] as const) {
    it(`keeps ${interactionType} SCORE pending for default and custom response identifiers`, () => {
      for (const responseIdentifier of ["RESPONSE", "SUBMISSION"]) {
        const result = writeQti3AssessmentItemResult({
          interactionType,
          identifier: "MANUAL",
          title: "Manual submission",
          responseIdentifier,
          externalScored: "human",
          bodyHtml: qti3TrustedXmlFragment("<p>Submit your work.</p>"),
          rubricHtml: qti3TrustedXmlFragment("<p>Source maximum: 7 points.</p>"),
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        validQtiDocument(result.xml);
        for (const trustedResponses of [{}, { [responseIdentifier]: "submission" }]) {
          const scored = scoreQtiItemServerSide({ itemXml: result.xml, trustedResponses });
          expect(scored.ok).toBe(true);
          expect(scored.score).toBeNull();
        }
        expect(result.xml).toContain('external-scored="human"');
        expect(result.xml).toContain('view="scorer"');
      }
    });
  }
  it("rejects a second scoring authority with a specific conflict diagnostic", () => {
    const upload = writeQti3AssessmentItemResult({
      interactionType: "upload",
      identifier: "UPLOAD",
      title: "Upload",
      externalScored: "human",
      correctResponse: "answer.pdf",
    });
    const essay = writeQti3AssessmentItemResult({
      interactionType: "extendedText",
      identifier: "ESSAY",
      title: "Essay",
      externalScored: "human",
      modalFeedback: {
        outcomes: [{ identifier: "FB", cardinality: "single" }],
        entries: [{ outcomeIdentifier: "FB", identifier: "EXPLANATION", text: "Explanation" }],
        responseProcessingXml: qti3TrustedXmlFragment("<qti-response-processing/>"),
      },
    });
    for (const result of [upload, essay]) {
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.diagnostics.map((d) => d.code)).toContain("conflicting_manual_scoring");
    }
  });
});
