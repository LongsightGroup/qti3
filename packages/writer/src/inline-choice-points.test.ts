import { createItemSession, type QtiDocument } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import { validQtiDocument } from "../../../tests/fixtures/valid-qti-document.js";
import {
  qti3TrustedXmlFragment,
  writeQti3AssessmentItemResult,
  type Qti3InlineChoiceAuthoringItem,
} from "./index.js";

function dropdown(slots: number): Qti3InlineChoiceAuthoringItem {
  const identifiers = slots === 1 ? ["RESPONSE"] : ["FIRST", "SECOND"];
  return {
    interactionType: "inlineChoice",
    identifier: "POINTS",
    title: "Dropdown points",
    bodyHtml: qti3TrustedXmlFragment(
      `<p>${identifiers.map((id) => `<qti-inline-choice-interaction response-identifier="${id}"/>`).join(" and ")}</p>`,
    ),
    slots: identifiers.map((responseIdentifier) => ({
      responseIdentifier,
      correctResponse: "A",
      options: [
        { identifier: "A", text: "Alpha" },
        { identifier: "B", text: "Beta" },
      ],
    })),
  };
}

function score(document: QtiDocument, values: readonly (string | null)[]) {
  const session = createItemSession(document);
  document.item.responseDeclarations.forEach((declaration, index) => {
    session.respond(declaration.identifier, values[index] ?? null);
  });
  return session.score().outcomes.SCORE;
}

describe("explicit dropdown point maxima", () => {
  it.each([0, 3, 3.125])(
    "preserves %s points when matching choice and dropdown presentations",
    (maximumScore) => {
      const item = dropdown(1);
      const inline = writeQti3AssessmentItemResult({ ...item, maximumScore });
      const choice = writeQti3AssessmentItemResult({
        interactionType: "choice",
        identifier: "POINTS",
        title: "Choice points",
        responseCardinality: "single",
        maximumScore,
        choices: [
          { identifier: "A", text: "Alpha" },
          { identifier: "B", text: "Beta" },
        ],
        correctResponse: ["A"],
      });
      expect(inline.ok).toBe(true);
      expect(choice.ok).toBe(true);
      if (!inline.ok || !choice.ok) throw new Error("Expected valid point presentations.");
      const inlineDocument = validQtiDocument(inline.xml);
      const choiceDocument = validQtiDocument(choice.xml);
      expect(createItemSession(inlineDocument).score().outcomes.MAXSCORE).toBe(maximumScore);
      for (const [response, expected] of [
        ["A", maximumScore],
        ["B", 0],
        [null, 0],
      ] as const) {
        expect(score(inlineDocument, [response])).toBe(expected);
        expect(score(choiceDocument, [response])).toBe(expected);
      }
      if (maximumScore === 0) expect(inline.xml).not.toContain("normal-maximum=");
      else expect(inline.xml).toContain(`normal-maximum="${maximumScore}"`);
    },
  );

  it.each([0, 3, 3.125])(
    "awards the %s item maximum only when every dropdown is correct",
    (maximumScore) => {
      const result = writeQti3AssessmentItemResult({ ...dropdown(2), maximumScore });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected valid multi-slot points.");
      const document = validQtiDocument(result.xml);
      expect(createItemSession(document).score().outcomes.MAXSCORE).toBe(maximumScore);
      for (const [responses, expected] of [
        [["A", "A"], maximumScore],
        [["A", "B"], 0],
        [["B", "A"], 0],
        [["B", "B"], 0],
        [["A", null], 0],
        [[null, null], 0],
      ] as const)
        expect(score(document, responses)).toBe(expected);
    },
  );

  it("preserves the existing per-slot matching score when the maximum is omitted", () => {
    const result = writeQti3AssessmentItemResult(dropdown(2));
    if (!result.ok) throw new Error("Expected ordinary dropdown matching.");
    const document = validQtiDocument(result.xml);
    expect(score(document, ["A", "A"])).toBe(2);
    expect(score(document, ["A", "B"])).toBe(0);
    expect(result.xml).not.toContain('identifier="MAXSCORE"');
  });

  it.each([-1, NaN, Infinity, -Infinity])(
    "refuses invalid maximum %s rather than emitting a default",
    (maximumScore) => {
      const result = writeQti3AssessmentItemResult({ ...dropdown(1), maximumScore });
      expect(result).toMatchObject({
        ok: false,
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: "invalid_inline_choice_maximum_score",
            path: "maximumScore",
          }),
        ]),
      });
      expect(result).not.toHaveProperty("xml");
    },
  );

  it("refuses to apply a point maximum to authored option mappings", () => {
    const result = writeQti3AssessmentItemResult({
      ...dropdown(1),
      maximumScore: 3,
      scoring: "map_response",
    });
    expect(result).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        expect.objectContaining({
          code: "conflicting_inline_choice_score_program",
          path: "maximumScore",
        }),
      ]),
    });
    expect(result).not.toHaveProperty("xml");
  });
});

// A maximum cannot authorize replacement of a custom program or collide with its outcome.
it.each([
  {
    name: "custom processing",
    modalFeedback: {
      outcomes: [{ identifier: "FEEDBACK", cardinality: "multiple" as const }],
      entries: [{ outcomeIdentifier: "FEEDBACK", identifier: "HINT", text: "Hint" }],
      responseProcessingXml: qti3TrustedXmlFragment(
        '<qti-response-processing><qti-set-outcome-value identifier="SCORE"><qti-base-value base-type="float">7</qti-base-value></qti-set-outcome-value></qti-response-processing>',
      ),
    },
  },
  {
    name: "existing maximum",
    modalFeedback: {
      outcomes: [{ identifier: "MAXSCORE", cardinality: "single" as const }],
      entries: [{ outcomeIdentifier: "MAXSCORE", identifier: "HINT", text: "Hint" }],
    },
  },
])("refuses points with $name instead of replacing the program", ({ modalFeedback }) => {
  const result = writeQti3AssessmentItemResult({ ...dropdown(1), maximumScore: 3, modalFeedback });
  expect(result).toMatchObject({
    ok: false,
    diagnostics: expect.arrayContaining([
      expect.objectContaining({
        code: "conflicting_inline_choice_score_program",
        path: "maximumScore",
      }),
    ]),
  });
  expect(result).not.toHaveProperty("xml");
});

it("refuses a MAXSCORE response that would collide with the generated outcome", () => {
  const item = dropdown(1);
  const result = writeQti3AssessmentItemResult({
    ...item,
    maximumScore: 3,
    bodyHtml: qti3TrustedXmlFragment(
      '<p><qti-inline-choice-interaction response-identifier="MAXSCORE"/></p>',
    ),
    slots: item.slots.map((slot) => ({ ...slot, responseIdentifier: "MAXSCORE" })),
  });
  expect(result).toMatchObject({
    ok: false,
    diagnostics: expect.arrayContaining([
      expect.objectContaining({
        code: "conflicting_inline_choice_score_program",
        path: "maximumScore",
      }),
    ]),
  });
  expect(result).not.toHaveProperty("xml");
});
