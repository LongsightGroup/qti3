import { describe, expect, it } from "vitest";

import {
  buildQti3GraphicGapMatchItem,
  qti3TrustedXmlFragment,
  validateQti3GraphicGapMatchItem,
  writeQti3AssessmentItem,
  type Qti3AuthoringItem,
} from "./index.js";
import { expectValidParsedItem } from "./test-helpers.js";

describe("qti3-writer graphic gap match", () => {
  it("writes graphic gap match items with gap choices, targets, and directed pairs", () => {
    const xml = buildQti3GraphicGapMatchItem({
      identifier: "graphic-gap-match-1",
      title: "Graphic Gap Match",
      bodyHtml: qti3TrustedXmlFragment("<p>Context</p>"),
      promptHtml: qti3TrustedXmlFragment("Drag labels to the correct region."),
      object: {
        data: "timeline.svg",
        alt: "Timeline",
        type: "image/svg+xml",
        width: 480,
        height: 300,
        longDescription: "Timeline with two highlighted regions.",
      },
      choices: [
        { identifier: "A", kind: "text", text: "Planning", matchMax: 1, fixed: true },
        {
          identifier: "B",
          kind: "image",
          object: { data: "choice-b.png", alt: "Collection", type: "image/png" },
          matchMax: 1,
        },
      ],
      targets: [
        { identifier: "T1", shape: "rect", coords: "24,52,136,124", matchMax: 1 },
        { identifier: "T2", shape: "rect", coords: "184,52,296,124", matchMax: 1 },
      ],
      correctResponse: [
        { sourceIdentifier: "A", targetIdentifier: "T1" },
        { sourceIdentifier: "B", targetIdentifier: "T2" },
      ],
      minAssociations: 1,
      maxAssociations: 2,
      minAssociationsMessage: "Place at least one",
      maxAssociationsMessage: "Only two",
      classNames: ["writer-graphic-gap"],
      scoring: "map_response",
    });

    expect(xml.indexOf('data-qti-a11y-content-role="long-description"')).toBeLessThan(
      xml.indexOf("<qti-graphic-gap-match-interaction"),
    );
    expect(xml.indexOf("<p>Context</p>")).toBeGreaterThan(
      xml.indexOf("<qti-graphic-gap-match-interaction"),
    );
    expect(xml).toContain("<qti-gap-text");
    expect(xml).toContain("<qti-gap-img");

    const item = expectValidParsedItem(xml);
    const declaration = item.responseDeclarations[0];
    const interaction = item.interactions[0];
    expect(declaration).toMatchObject({
      identifier: "RESPONSE",
      cardinality: "multiple",
      baseType: "directedPair",
      correctResponse: ["A T1", "B T2"],
    });
    expect(declaration.mapping?.entries).toEqual([
      expect.objectContaining({ mapKey: "A T1", mappedValue: 1 }),
      expect.objectContaining({ mapKey: "B T2", mappedValue: 1 }),
    ]);
    expect(interaction).toMatchObject({
      type: "graphicGapMatch",
      responseIdentifier: "RESPONSE",
      responseCardinality: "multiple",
      responseBaseType: "directedPair",
    });
    expect(interaction.attributes).toMatchObject({
      class: "writer-graphic-gap",
      "min-associations": "1",
      "max-associations": "2",
      "data-min-selections-message": "Place at least one",
      "data-max-selections-message": "Only two",
      "data-qti-aria-describedby": "longdesc-graphic-gap-match-1",
    });
    expect(interaction.object).toMatchObject({
      data: "timeline.svg",
      type: "image/svg+xml",
      width: "480",
      height: "300",
      text: "Timeline",
    });
    expect(interaction.choices.map((choice) => choice.identifier)).toEqual(["A", "B", "T1", "T2"]);
    expect(item.responseProcessing?.template).toContain("rptemplates/map_response");
  });

  it("writes graphic gap match items with inline qti-gap targets in trusted bodyHtml", () => {
    const xml = buildQti3GraphicGapMatchItem({
      identifier: "graphic-gap-match-inline",
      title: "Graphic Gap Match Inline",
      promptHtml: qti3TrustedXmlFragment("Complete the workflow sentence."),
      bodyHtml: qti3TrustedXmlFragment(
        '<p>The first step is <qti-gap identifier="G1"/> before <qti-gap identifier="G2"/>.</p>',
      ),
      object: {
        data: "timeline.svg",
        alt: "Timeline",
        type: "image/svg+xml",
        width: 480,
        height: 300,
      },
      choices: [
        { identifier: "A", kind: "text", text: "planning", matchMax: 1 },
        { identifier: "B", kind: "text", text: "collecting data", matchMax: 1 },
      ],
      targets: [
        { targetType: "inlineGap", identifier: "G1", matchMax: 1 },
        { targetType: "inlineGap", identifier: "G2", matchMax: 1 },
      ],
      correctResponse: [
        { sourceIdentifier: "A", targetIdentifier: "G1" },
        { sourceIdentifier: "B", targetIdentifier: "G2" },
      ],
      maxAssociations: 2,
      scoring: "map_response",
    });

    expect(xml).toContain('<qti-gap identifier="G1"');
    expect(xml).not.toContain("qti-associable-hotspot");

    const item = expectValidParsedItem(xml);
    expect(item.responseDeclarations[0]).toMatchObject({
      cardinality: "multiple",
      baseType: "directedPair",
      correctResponse: ["A G1", "B G2"],
    });
    expect(item.responseDeclarations[0]?.mapping?.entries).toEqual([
      expect.objectContaining({ mapKey: "A G1", mappedValue: 1 }),
      expect.objectContaining({ mapKey: "B G2", mappedValue: 1 }),
    ]);
    expect(item.interactions[0]?.choices.map((choice) => [choice.role, choice.identifier])).toEqual(
      [
        ["gapChoice", "A"],
        ["gapChoice", "B"],
        ["gap", "G1"],
        ["gap", "G2"],
      ],
    );
    expect(item.interactions[0]?.gapMatchSegments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "gap", identifier: "G1" }),
        expect.objectContaining({ kind: "gap", identifier: "G2" }),
      ]),
    );
  });

  it("writes graphic gap match items through the unified writer", () => {
    const item: Qti3AuthoringItem = {
      interactionType: "graphicGapMatch",
      identifier: "graphic-gap-match-unified",
      title: "Graphic Gap Match",
      object: { data: "map.png", alt: "Map", width: 100, height: 100 },
      choices: [{ identifier: "A", kind: "text", text: "Alpha" }],
      targets: [{ identifier: "T1", shape: "rect", coords: "1,1,20,20" }],
      correctResponse: [{ sourceIdentifier: "A", targetIdentifier: "T1" }],
    };

    const parsed = expectValidParsedItem(writeQti3AssessmentItem(item));

    expect(parsed.responseDeclarations[0]).toMatchObject({
      cardinality: "multiple",
      baseType: "directedPair",
      correctResponse: ["A T1"],
    });
    expect(parsed.interactions[0]?.qtiName).toBe("qti-graphic-gap-match-interaction");
  });

  it("omits mapping when graphic gap match scoring uses match_correct", () => {
    const xml = buildQti3GraphicGapMatchItem({
      identifier: "graphic-gap-match-correct",
      title: "Graphic Gap Match",
      object: { data: "map.png", alt: "Map", width: 100, height: 100 },
      choices: [{ identifier: "A", kind: "text", text: "Alpha" }],
      targets: [{ identifier: "T1", shape: "rect", coords: "1,1,20,20" }],
      correctResponse: [{ sourceIdentifier: "A", targetIdentifier: "T1" }],
    });

    expect(xml).not.toContain("<qti-mapping");
    expect(xml).toContain("rptemplates/match_correct");
  });

  it("rejects invalid graphic gap match authoring inputs", () => {
    const diagnostics = validateQti3GraphicGapMatchItem({
      identifier: "bad graphic gap match",
      title: "",
      object: { data: "/uploads/no-extension" },
      choices: [
        { identifier: "A", kind: "text", text: "", matchMax: -1 },
        { identifier: "A", kind: "image", object: { data: "", alt: "" } },
      ],
      targets: [
        { identifier: "T1", shape: "rect", coords: "", matchMax: -1 },
        { identifier: "T1", shape: "circle", coords: "1,1,2" },
        { targetType: "inlineGap", identifier: "G1" },
      ],
      correctResponse: [
        { sourceIdentifier: "A", targetIdentifier: "T2" },
        { sourceIdentifier: "B", targetIdentifier: "T1" },
      ],
      minAssociations: 2,
      maxAssociations: 1,
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "invalid_identifier",
        "missing_title",
        "missing_graphic_gap_match_object_alt",
        "unknown_graphic_gap_match_object_type",
        "duplicate_identifier",
        "empty_graphic_gap_match_choice",
        "invalid_graphic_gap_match_choice_match_max",
        "missing_graphic_gap_match_choice_object_data",
        "missing_graphic_gap_match_choice_object_alt",
        "duplicate_identifier",
        "missing_graphic_gap_match_target_coords",
        "invalid_graphic_gap_match_target_match_max",
        "invalid_graphic_gap_match_bounds",
        "unknown_graphic_gap_match_target_reference",
        "unknown_graphic_gap_match_choice_reference",
        "missing_graphic_gap_match_body_gaps",
        "missing_graphic_gap_match_inline_gap",
      ]),
    );
    expect(diagnostics.every((diagnostic) => diagnostic.path.length > 0)).toBe(true);
  });

  it("rejects graphic gap match correct responses that exceed matchMax", () => {
    const diagnostics = validateQti3GraphicGapMatchItem({
      identifier: "graphic-gap-match-max",
      title: "Graphic Gap Match",
      object: { data: "map.png", alt: "Map", width: 100, height: 100 },
      choices: [{ identifier: "A", kind: "text", text: "Alpha", matchMax: 1 }],
      targets: [
        { identifier: "T1", shape: "rect", coords: "1,1,20,20" },
        { identifier: "T2", shape: "rect", coords: "30,1,50,20" },
      ],
      correctResponse: [
        { sourceIdentifier: "A", targetIdentifier: "T1" },
        { sourceIdentifier: "A", targetIdentifier: "T2" },
      ],
    });

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "graphic_gap_match_match_max_exceeded",
        path: "correctResponse",
        value: { identifier: "A", useCount: 2, matchMax: 1 },
      }),
    );
  });

  it("rejects graphic gap match items without a correct response", () => {
    const diagnostics = validateQti3GraphicGapMatchItem({
      identifier: "graphic-gap-match-missing-response",
      title: "Graphic Gap Match",
      object: { data: "map.png", alt: "Map", width: 100, height: 100 },
      choices: [{ identifier: "A", kind: "text", text: "Alpha" }],
      targets: [{ targetType: "inlineGap", identifier: "G1" }],
      bodyHtml: qti3TrustedXmlFragment('<p><qti-gap identifier="G1"/></p>'),
      correctResponse: [],
    });

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "missing_graphic_gap_match_correct_response",
        path: "correctResponse",
      }),
    );
  });

  it("rejects duplicate identifiers across graphic gap choices and targets", () => {
    const diagnostics = validateQti3GraphicGapMatchItem({
      identifier: "graphic-gap-match-duplicate-cross-pool",
      title: "Graphic Gap Match",
      object: { data: "map.png", alt: "Map", width: 100, height: 100 },
      choices: [{ identifier: "A", kind: "text", text: "Alpha" }],
      targets: [{ identifier: "A", shape: "rect", coords: "1,1,20,20" }],
      correctResponse: [{ sourceIdentifier: "A", targetIdentifier: "A" }],
    });

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "duplicate_identifier",
        path: "choices|targets",
      }),
    );
  });
});
