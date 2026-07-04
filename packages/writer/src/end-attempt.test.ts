import { describe, expect, it } from "vitest";

import {
  buildQti3EndAttemptItem,
  qti3TrustedXmlFragment,
  writeQti3AssessmentItem,
  writeQti3AssessmentItemResult,
  Qti3WriterError,
} from "./index.js";
import { expectValidParsedItem } from "./test-helpers.js";

describe("qti3 end-attempt writer", () => {
  it("writes an end-attempt interaction with a boolean response", () => {
    const xml = buildQti3EndAttemptItem({
      identifier: "end-attempt-1",
      title: "End Attempt",
      promptHtml: qti3TrustedXmlFragment("Use the button when ready."),
      bodyHtml: qti3TrustedXmlFragment("<p>You can stop after viewing the hint.</p>"),
      responseIdentifier: "END_ATTEMPT",
      buttonTitle: "Show Hint",
      countAttempt: true,
      classNames: ["end-attempt-button"],
    });

    expect(xml).toContain("<qti-end-attempt-interaction");
    expect(xml).toContain('title="Show Hint"');
    expect(xml).toContain('count-attempt="true"');
    expect(xml).toContain("<qti-set-outcome-value");

    const item = expectValidParsedItem(xml);
    expect(item.responseDeclarations[0]).toMatchObject({
      identifier: "END_ATTEMPT",
      cardinality: "single",
      baseType: "boolean",
    });
    expect(item.interactions[0]).toMatchObject({
      type: "endAttempt",
      qtiName: "qti-end-attempt-interaction",
      responseIdentifier: "END_ATTEMPT",
      responseCardinality: "single",
      responseBaseType: "boolean",
    });
    expect(item.interactions[0]?.attributes).toMatchObject({
      title: "Show Hint",
      "count-attempt": "true",
      class: "end-attempt-button",
    });
  });

  it("supports unified writer without count-attempt", () => {
    const xml = writeQti3AssessmentItem({
      interactionType: "endAttempt",
      identifier: "end-attempt-unified",
      title: "End Attempt",
      buttonTitle: "Finish",
    });

    expect(xml).not.toContain("count-attempt=");
    const item = expectValidParsedItem(xml);
    expect(item.interactions[0]?.qtiName).toBe("qti-end-attempt-interaction");
  });

  it("returns diagnostics for invalid end-attempt input", () => {
    expect(() =>
      buildQti3EndAttemptItem({
        identifier: "bad end",
        title: "",
        responseIdentifier: "bad response",
        buttonTitle: "",
      }),
    ).toThrow(Qti3WriterError);

    const result = writeQti3AssessmentItemResult({
      interactionType: "endAttempt",
      identifier: "bad end",
      title: "",
      responseIdentifier: "bad response",
      buttonTitle: "",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
        expect.arrayContaining([
          "invalid_identifier",
          "missing_title",
          "missing_end_attempt_button_title",
        ]),
      );
      expect(result.diagnostics.every((diagnostic) => diagnostic.path.length > 0)).toBe(true);
    }
  });
});
