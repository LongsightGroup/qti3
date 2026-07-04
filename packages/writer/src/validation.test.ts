import type { QtiInteractionType } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";

import {
  qti3WriterInteractionSupport,
  qti3TrustedXmlFragment,
  validateQti3AuthoringItem,
  writeQti3AssessmentItem,
  writeQti3AssessmentItemResult,
  Qti3WriterError,
  type Qti3AuthoringItem,
} from "./index.js";
import { expectValidParsedItem } from "./test-helpers.js";

describe("qti3-writer validation", () => {
  it("reports diagnostics for each supported interaction validator", () => {
    const invalidItems: Array<{
      readonly item: Qti3AuthoringItem;
      readonly codes: readonly string[];
    }> = [
      {
        item: {
          interactionType: "choice",
          identifier: "bad choice",
          title: "",
          responseCardinality: "single",
          choices: [
            { identifier: "A", text: "A" },
            { identifier: "A", text: "Duplicate A" },
          ],
          correctResponse: ["B", "C"],
          minChoices: 2,
          maxChoices: 1,
        },
        codes: [
          "invalid_identifier",
          "missing_title",
          "duplicate_identifier",
          "invalid_choice_bounds",
          "invalid_correct_response_count",
          "unknown_choice_reference",
          "unknown_choice_reference",
        ],
      },
      {
        item: {
          interactionType: "textEntry",
          identifier: "text-entry-invalid",
          title: "Text Entry",
          bodyHtml: qti3TrustedXmlFragment(
            '<p><qti-text-entry-interaction response-identifier="BODY_ONLY"/><qti-text-entry-interaction response-identifier="BODY_ONLY"/></p>',
          ),
          responses: [
            {
              responseIdentifier: "DECLARED_ONLY",
              answers: [{ value: "x", score: Number.POSITIVE_INFINITY }],
            },
          ],
        },
        codes: [
          "invalid_text_entry_score",
          "duplicate_identifier",
          "missing_text_entry_interaction_for_response",
          "unknown_text_entry_interaction_response",
          "unknown_text_entry_interaction_response",
        ],
      },
      {
        item: {
          interactionType: "match",
          identifier: "match-invalid",
          title: "Match",
          sources: [
            { identifier: "A", text: "A", matchMax: 1.5 },
            { identifier: "A", text: "Duplicate A" },
          ],
          targets: [{ identifier: "T1", text: "T1" }],
          correctResponse: [{ sourceIdentifier: "B", targetIdentifier: "T2" }],
        },
        codes: [
          "duplicate_identifier",
          "invalid_match_max",
          "unknown_match_source_reference",
          "unknown_match_target_reference",
        ],
      },
      {
        item: {
          interactionType: "hotspot",
          identifier: "hotspot-invalid",
          title: "Hotspot",
          object: { data: "/uploads/no-extension" },
          choices: [
            { identifier: "R1", shape: "rect", coords: "" },
            { identifier: "R1", shape: "circle", coords: "1,1,2" },
          ],
          correctResponse: ["R2", "R3"],
          maxChoices: 1.5,
          minChoices: 2,
        },
        codes: [
          "missing_hotspot_object_alt",
          "unknown_hotspot_object_type",
          "duplicate_identifier",
          "missing_hotspot_coords",
          "invalid_hotspot_max_choices",
          "invalid_hotspot_choice_bounds",
          "unknown_hotspot_reference",
          "unknown_hotspot_reference",
        ],
      },
    ];

    for (const { item, codes } of invalidItems) {
      const result = writeQti3AssessmentItemResult(item);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
          expect.arrayContaining(codes),
        );
        expect(result.diagnostics.every((diagnostic) => diagnostic.path.length > 0)).toBe(true);
      }
      expect(() => writeQti3AssessmentItem(item)).toThrow(Qti3WriterError);
    }
  });

  it("validates authoring items without re-running validation in the result writer", () => {
    const item: Qti3AuthoringItem = {
      interactionType: "choice",
      identifier: "choice-once",
      title: "Choice",
      responseCardinality: "single",
      choices: [{ identifier: "A", text: "A" }],
      correctResponse: ["A"],
    };
    const diagnostics = validateQti3AuthoringItem(item);
    expect(diagnostics).toEqual([]);
    const result = writeQti3AssessmentItemResult(item);
    expect(result.ok).toBe(true);
  });

  it("declares support metadata for every interaction it writes", () => {
    const examples: readonly Qti3AuthoringItem[] = [
      {
        interactionType: "choice",
        identifier: "support-choice",
        title: "Choice",
        responseCardinality: "single",
        choices: [{ identifier: "A", text: "A" }],
        correctResponse: ["A"],
      },
      {
        interactionType: "textEntry",
        identifier: "support-text-entry",
        title: "Text Entry",
        bodyHtml: qti3TrustedXmlFragment(
          '<p><qti-text-entry-interaction response-identifier="RESPONSE"/></p>',
        ),
        responses: [{ responseIdentifier: "RESPONSE", answers: [{ value: "x" }] }],
      },
      {
        interactionType: "match",
        identifier: "support-match",
        title: "Match",
        sources: [{ identifier: "A", text: "A" }],
        targets: [{ identifier: "T1", text: "T1" }],
        correctResponse: [{ sourceIdentifier: "A", targetIdentifier: "T1" }],
      },
      {
        interactionType: "hotspot",
        identifier: "support-hotspot",
        title: "Hotspot",
        object: { data: "map.png", alt: "Map", width: 100, height: 100 },
        choices: [{ identifier: "R1", shape: "rect", coords: "1,1,2,2" }],
        correctResponse: ["R1"],
      },
    ];

    const supportedTypes = new Set<QtiInteractionType>(
      qti3WriterInteractionSupport.map((support) => support.interactionType),
    );
    expect(supportedTypes).toEqual(new Set(examples.map((item) => item.interactionType)));
    for (const support of qti3WriterInteractionSupport) {
      expect(support).toMatchObject({ writes: true, validates: true });
      expect(support.tests.length).toBeGreaterThan(0);
      expect(support.tests).toContain("packages/writer/src/validation.test.ts");
    }

    const emittedNames = examples.map((example) => {
      const item = expectValidParsedItem(writeQti3AssessmentItem(example));
      return item.interactions[0]?.qtiName;
    });
    expect(new Set(emittedNames)).toEqual(
      new Set(qti3WriterInteractionSupport.map((support) => support.qtiName)),
    );
  });
});
