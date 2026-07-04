import type { QtiInteractionType } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";

import {
  qti3WriterPlannedInteractionMigrationOrder,
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
          interactionType: "order",
          identifier: "order-invalid",
          title: "Order",
          choices: [
            { identifier: "A", text: "" },
            { identifier: "A", text: "Duplicate A" },
          ],
          correctOrder: ["B"],
          minChoices: 2,
          maxChoices: 1,
        },
        codes: [
          "duplicate_identifier",
          "empty_order_choice",
          "invalid_order_bounds",
          "unknown_order_reference",
        ],
      },
      {
        item: {
          interactionType: "associate",
          identifier: "associate-invalid",
          title: "Associate",
          choices: [
            { identifier: "A", text: "" },
            { identifier: "A", text: "Duplicate A" },
          ],
          correctResponse: [{ sourceIdentifier: "A", targetIdentifier: "B" }],
          minAssociations: 2,
          maxAssociations: 1,
        },
        codes: [
          "duplicate_identifier",
          "empty_associate_choice",
          "invalid_associate_bounds",
          "unknown_associate_reference",
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
      {
        item: {
          interactionType: "graphicAssociate",
          identifier: "graphic-associate-invalid",
          title: "Graphic Associate",
          object: { data: "/uploads/no-extension" },
          hotspots: [
            { identifier: "A", shape: "rect", coords: "", matchMax: -1 },
            { identifier: "A", shape: "circle", coords: "1,1,2" },
            { identifier: "C", shape: "circle", coords: "2,2,3", matchMax: 1 },
          ],
          correctResponse: [
            { sourceIdentifier: "A", targetIdentifier: "A" },
            { sourceIdentifier: "C", targetIdentifier: "A" },
            { sourceIdentifier: "C", targetIdentifier: "B" },
          ],
          minAssociations: 2,
          maxAssociations: 1,
        },
        codes: [
          "missing_graphic_associate_object_alt",
          "unknown_graphic_associate_object_type",
          "duplicate_identifier",
          "missing_graphic_associate_coords",
          "invalid_graphic_associate_match_max",
          "invalid_graphic_associate_bounds",
          "invalid_graphic_associate_self_pair",
          "unknown_graphic_associate_reference",
          "graphic_associate_match_max_exceeded",
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
        interactionType: "order",
        identifier: "support-order",
        title: "Order",
        choices: [
          { identifier: "A", text: "A" },
          { identifier: "B", text: "B" },
        ],
      },
      {
        interactionType: "associate",
        identifier: "support-associate",
        title: "Associate",
        choices: [
          { identifier: "A", text: "A" },
          { identifier: "B", text: "B" },
        ],
        correctResponse: [{ sourceIdentifier: "A", targetIdentifier: "B" }],
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
      {
        interactionType: "graphicAssociate",
        identifier: "support-graphic-associate",
        title: "Graphic Associate",
        object: { data: "map.png", alt: "Map", width: 100, height: 100 },
        hotspots: [
          { identifier: "A", shape: "circle", coords: "25,25,10" },
          { identifier: "B", shape: "circle", coords: "75,25,10" },
        ],
        correctResponse: [{ sourceIdentifier: "A", targetIdentifier: "B" }],
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

  it("keeps planned qflow migrations separate from supported writer interactions", () => {
    const supportedTypes = new Set(
      qti3WriterInteractionSupport.map((support) => support.interactionType),
    );
    const plannedTypes = qti3WriterPlannedInteractionMigrationOrder.map(
      (planned) => planned.interactionType,
    );

    expect(plannedTypes).toEqual([
      "inlineChoice",
      "hottext",
      "gapMatch",
      "extendedText",
      "upload",
      "media",
      "graphicOrder",
      "graphicGapMatch",
      "selectPoint",
      "positionObject",
      "slider",
      "custom",
      "portableCustom",
      "drawing",
      "endAttempt",
    ]);
    expect(new Set(plannedTypes).size).toBe(plannedTypes.length);
    expect(plannedTypes.every((interactionType) => !supportedTypes.has(interactionType))).toBe(
      true,
    );
    expect(qti3WriterPlannedInteractionMigrationOrder.map((planned) => planned.priority)).toEqual(
      Array.from(
        { length: qti3WriterPlannedInteractionMigrationOrder.length },
        (_, index) => index + 1,
      ),
    );
  });
});
