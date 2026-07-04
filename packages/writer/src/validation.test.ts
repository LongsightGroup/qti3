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
import { expectValidParsedItemAllowingDiagnostics } from "./test-helpers.js";

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
          interactionType: "extendedText",
          identifier: "extended-text-invalid",
          title: "Extended Text",
          responseIdentifier: "bad response",
          stringIdentifier: "bad string id",
          responseBaseType: "integer",
          responseCardinality: "multiple",
          expectedLength: -1,
          minStrings: 2,
          maxStrings: 1,
          patternMask: "[",
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- deliberate invalid runtime value.
          format: "markdown" as "plain",
        },
        codes: [
          "invalid_identifier",
          "invalid_identifier",
          "invalid_extended_text_response_base_type",
          "invalid_extended_text_response_cardinality",
          "invalid_extended_text_format",
          "invalid_extended_text_numeric_attribute",
          "invalid_extended_text_string_bounds",
          "invalid_extended_text_pattern_mask",
        ],
      },
      {
        item: {
          interactionType: "upload",
          identifier: "upload-invalid",
          title: "Upload",
          responseIdentifier: "bad response",
          maxFileSize: 1.5,
          correctResponse: "",
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- deliberate invalid runtime value.
          scoring: "map_response" as "match_correct",
        },
        codes: [
          "invalid_identifier",
          "invalid_upload_max_file_size",
          "empty_upload_correct_response",
          "invalid_upload_scoring",
        ],
      },
      {
        item: {
          interactionType: "media",
          identifier: "media-invalid",
          title: "Media",
          responseIdentifier: "bad response",
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- deliberate invalid runtime value.
          kind: "stream" as "video",
          sources: [{ src: "" }],
          minPlays: 2,
          maxPlays: 1,
          width: 0,
          captionSrc: "captions.srt",
        },
        codes: [
          "invalid_identifier",
          "invalid_media_kind",
          "missing_media_source_src",
          "invalid_media_play_bounds",
          "invalid_media_dimension",
          "invalid_media_caption_kind",
          "invalid_media_caption_src",
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
          interactionType: "hottext",
          identifier: "hottext-invalid",
          title: "Hottext",
          bodyHtml: qti3TrustedXmlFragment(
            '<p><qti-hottext identifier="BODY_ONLY"/><qti-hottext identifier="BODY_ONLY"/></p>',
          ),
          choices: [
            { identifier: "DECLARED_ONLY", text: "" },
            { identifier: "DECLARED_ONLY", text: "Duplicate" },
          ],
          correctResponse: ["UNKNOWN"],
          minChoices: 2,
          maxChoices: 1,
        },
        codes: [
          "duplicate_identifier",
          "empty_hottext_choice",
          "invalid_hottext_choice_bounds",
          "unknown_hottext_reference",
          "duplicate_identifier",
          "unknown_hottext_placeholder",
          "unknown_hottext_placeholder",
          "missing_hottext_placeholder_for_choice",
          "missing_hottext_placeholder_for_choice",
        ],
      },
      {
        item: {
          interactionType: "gapMatch",
          identifier: "gap-match-invalid",
          title: "Gap Match",
          bodyHtml: qti3TrustedXmlFragment('<p><qti-gap identifier="BODY_ONLY"/></p>'),
          choices: [
            { identifier: "A", kind: "text", text: "" },
            { identifier: "A", kind: "text", text: "Duplicate" },
          ],
          targets: [{ identifier: "DECLARED_ONLY" }],
          correctResponse: [{ sourceIdentifier: "B", targetIdentifier: "T2" }],
          minAssociations: 2,
          maxAssociations: 1,
        },
        codes: [
          "duplicate_identifier",
          "empty_gap_match_choice",
          "invalid_gap_match_bounds",
          "unknown_gap_match_body_gap",
          "missing_gap_match_body_gap",
          "unknown_gap_match_choice_reference",
          "unknown_gap_match_target_reference",
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
          interactionType: "graphicOrder",
          identifier: "graphic-order-invalid",
          title: "Graphic Order",
          responseIdentifier: "bad response",
          object: { data: "/uploads/no-extension" },
          hotspots: [
            { identifier: "A", shape: "rect", coords: "" },
            { identifier: "A", shape: "circle", coords: "1,1,2" },
          ],
          correctOrder: ["B"],
          minChoices: 2,
          maxChoices: 1,
        },
        codes: [
          "invalid_identifier",
          "missing_graphic_order_object_alt",
          "unknown_graphic_order_object_type",
          "duplicate_identifier",
          "missing_graphic_order_coords",
          "invalid_graphic_order_bounds",
          "unknown_graphic_order_reference",
        ],
      },
      {
        item: {
          interactionType: "selectPoint",
          identifier: "select-point-invalid",
          title: "Select Point",
          responseIdentifier: "bad response",
          object: { data: "/uploads/no-extension" },
          targets: [{ shape: "circle", coords: "1,2" }],
          correctResponse: ["1,2", "3 4"],
          minChoices: 2,
          maxChoices: 1,
        },
        codes: [
          "invalid_identifier",
          "missing_select_point_object_alt",
          "unknown_select_point_object_type",
          "invalid_select_point_bounds",
          "invalid_select_point_correct_response",
          "invalid_select_point_correct_response_count",
          "invalid_select_point_target_coords",
        ],
      },
      {
        item: {
          interactionType: "positionObject",
          identifier: "position-object-invalid",
          title: "Position Object",
          responseIdentifier: "bad response",
          stageObject: { data: "/uploads/no-extension" },
          movableObject: { data: "marker.png" },
          targets: [{ shape: "circle", coords: "1,2" }],
          correctResponse: ["1,2", "3 4"],
          centerPoint: "1,2",
          minChoices: 2,
          maxChoices: 1,
        },
        codes: [
          "invalid_identifier",
          "missing_position_object_stage_object_alt",
          "unknown_position_object_stage_object_type",
          "missing_position_object_movable_object_alt",
          "invalid_position_object_bounds",
          "invalid_position_object_correct_response",
          "invalid_position_object_correct_response_count",
          "invalid_position_object_center_point",
          "invalid_position_object_target_coords",
        ],
      },
      {
        item: {
          interactionType: "slider",
          identifier: "slider-invalid",
          title: "Slider",
          responseIdentifier: "bad response",
          lowerBound: 10,
          upperBound: 5,
          step: 0,
          correctResponse: 12,
          baseType: "integer",
          mappings: [
            { mapKey: 1.5, mappedValue: 1 },
            { mapKey: 1.5, mappedValue: Number.NaN },
          ],
          scoring: "map_response",
        },
        codes: [
          "invalid_identifier",
          "invalid_slider_bounds",
          "invalid_slider_step",
          "invalid_slider_correct_response_bounds",
          "invalid_slider_integer_value",
          "invalid_slider_mapped_value",
          "duplicate_slider_map_key",
        ],
      },
      {
        item: {
          interactionType: "custom",
          identifier: "bad custom",
          title: "",
          responseIdentifier: "bad response",
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- deliberate invalid runtime value.
          responseBaseType: "json" as "string",
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- deliberate invalid runtime value.
          responseCardinality: "list" as "single",
          attributes: [
            { name: "", value: "empty" },
            { name: "data mode", value: "bad" },
            { name: "class", value: "reserved" },
          ],
          interactionMarkupHtml: qti3TrustedXmlFragment(""),
        },
        codes: [
          "invalid_identifier",
          "missing_title",
          "invalid_custom_response_base_type",
          "invalid_custom_response_cardinality",
          "missing_custom_attribute_name",
          "invalid_custom_attribute_name",
          "reserved_custom_attribute_name",
          "missing_custom_interaction_markup",
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
      {
        item: {
          interactionType: "graphicGapMatch",
          identifier: "graphic-gap-match-invalid",
          title: "Graphic Gap Match",
          object: { data: "/uploads/no-extension" },
          choices: [
            { identifier: "A", kind: "text", text: "" },
            { identifier: "A", kind: "text", text: "Duplicate" },
          ],
          targets: [{ identifier: "T1", shape: "rect", coords: "" }],
          correctResponse: [{ sourceIdentifier: "B", targetIdentifier: "T2" }],
          minAssociations: 2,
          maxAssociations: 1,
        },
        codes: [
          "missing_graphic_gap_match_object_alt",
          "unknown_graphic_gap_match_object_type",
          "duplicate_identifier",
          "empty_graphic_gap_match_choice",
          "missing_graphic_gap_match_target_coords",
          "invalid_graphic_gap_match_bounds",
          "unknown_graphic_gap_match_choice_reference",
          "unknown_graphic_gap_match_target_reference",
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
        interactionType: "inlineChoice",
        identifier: "support-inline-choice",
        title: "Inline Choice",
        bodyHtml: qti3TrustedXmlFragment(
          '<p><qti-inline-choice-interaction response-identifier="RESPONSE"/></p>',
        ),
        slots: [
          {
            responseIdentifier: "RESPONSE",
            correctResponse: "A",
            options: [
              { identifier: "A", text: "A" },
              { identifier: "B", text: "B" },
            ],
          },
        ],
      },
      {
        interactionType: "hottext",
        identifier: "support-hottext",
        title: "Hottext",
        bodyHtml: qti3TrustedXmlFragment('<p><qti-hottext identifier="A"/></p>'),
        choices: [{ identifier: "A", text: "A" }],
        correctResponse: ["A"],
      },
      {
        interactionType: "gapMatch",
        identifier: "support-gap-match",
        title: "Gap Match",
        bodyHtml: qti3TrustedXmlFragment('<p><qti-gap identifier="G1"/></p>'),
        choices: [{ identifier: "A", kind: "text", text: "A" }],
        targets: [{ identifier: "G1" }],
        correctResponse: [{ sourceIdentifier: "A", targetIdentifier: "G1" }],
      },
      {
        interactionType: "extendedText",
        identifier: "support-extended-text",
        title: "Extended Text",
        bodyHtml: qti3TrustedXmlFragment("<p>Write a paragraph.</p>"),
        responseIdentifier: "RESPONSE",
        expectedLength: 200,
      },
      {
        interactionType: "upload",
        identifier: "support-upload",
        title: "Upload",
        bodyHtml: qti3TrustedXmlFragment("<p>Upload the requested file.</p>"),
        responseIdentifier: "RESPONSE",
      },
      {
        interactionType: "media",
        identifier: "support-media",
        title: "Media",
        responseIdentifier: "RESPONSE",
        kind: "audio",
        sources: [{ src: "audio.mp3", type: "audio/mpeg" }],
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
        interactionType: "graphicOrder",
        identifier: "support-graphic-order",
        title: "Graphic Order",
        object: { data: "map.png", alt: "Map", width: 100, height: 100 },
        hotspots: [
          { identifier: "A", shape: "circle", coords: "25,25,10" },
          { identifier: "B", shape: "circle", coords: "75,25,10" },
        ],
        correctOrder: ["A", "B"],
      },
      {
        interactionType: "selectPoint",
        identifier: "support-select-point",
        title: "Select Point",
        object: { data: "map.png", alt: "Map", width: 100, height: 100 },
        targets: [{ shape: "circle", coords: "25,25,10", mappedValue: 1 }],
        correctResponse: ["25 25"],
      },
      {
        interactionType: "positionObject",
        identifier: "support-position-object",
        title: "Position Object",
        stageObject: { data: "stage.png", alt: "Stage", width: 100, height: 100 },
        movableObject: { data: "marker.png", alt: "Marker", width: 16, height: 16 },
        targets: [{ shape: "circle", coords: "25,25,10", mappedValue: 1 }],
        correctResponse: ["25 25"],
      },
      {
        interactionType: "slider",
        identifier: "support-slider",
        title: "Slider",
        lowerBound: 0,
        upperBound: 100,
        step: 10,
        correctResponse: 70,
        mappings: [{ mapKey: 70, mappedValue: 1 }],
      },
      {
        interactionType: "custom",
        identifier: "support-custom",
        title: "Custom",
        interactionMarkupHtml: qti3TrustedXmlFragment('<div class="widget">Ready</div>'),
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
      {
        interactionType: "graphicGapMatch",
        identifier: "support-graphic-gap-match",
        title: "Graphic Gap Match",
        object: { data: "map.png", alt: "Map", width: 100, height: 100 },
        choices: [{ identifier: "A", kind: "text", text: "Alpha" }],
        targets: [{ identifier: "T1", shape: "rect", coords: "1,1,20,20" }],
        correctResponse: [{ sourceIdentifier: "A", targetIdentifier: "T1" }],
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
      const xml = writeQti3AssessmentItem(example);
      const item =
        example.interactionType === "custom"
          ? expectValidParsedItemAllowingDiagnostics(xml, ["interaction.deprecated"])
          : expectValidParsedItem(xml);
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

    expect(plannedTypes).toEqual(["portableCustom", "drawing", "endAttempt"]);
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
