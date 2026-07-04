import { describe, expect, it } from "vitest";

import {
  buildQti3GraphicAssociateItem,
  qti3TrustedXmlFragment,
  validateQti3GraphicAssociateItem,
  writeQti3AssessmentItem,
  type Qti3AuthoringItem,
} from "./index.js";
import { expectValidParsedItem } from "./test-helpers.js";

describe("qti3-writer graphic associate", () => {
  it("writes graphic associate items with pair responses, object metadata, and hotspots", () => {
    const xml = buildQti3GraphicAssociateItem({
      identifier: "graphic-associate-1",
      title: "Graphic Associate",
      bodyHtml: qti3TrustedXmlFragment("<p>Context</p>"),
      promptHtml: qti3TrustedXmlFragment("Connect the related areas."),
      object: {
        data: "map.svg",
        alt: "Map of related areas",
        type: "image/svg+xml",
        width: 480,
        height: 300,
        longDescription: "The map contains four labeled regions.",
      },
      hotspots: [
        {
          identifier: "A",
          hotspotLabel: "Planning",
          shape: "rect",
          coords: "24,52,136,124",
          matchMax: 1,
        },
        {
          identifier: "B",
          hotspotLabel: "Collection",
          shape: "rect",
          coords: "184,52,296,124",
          matchMax: 1,
        },
        {
          identifier: "C",
          hotspotLabel: "Analysis",
          shape: "rect",
          coords: "344,52,456,124",
          matchMax: 1,
        },
        {
          identifier: "D",
          hotspotLabel: "Report",
          shape: "rect",
          coords: "184,178,296,250",
          matchMax: 1,
        },
      ],
      correctResponse: [
        { sourceIdentifier: "A", targetIdentifier: "B" },
        { sourceIdentifier: "C", targetIdentifier: "D" },
      ],
      scoring: "map_response",
      minAssociations: 1,
      maxAssociations: 2,
      classNames: ["writer-graphic-associate"],
    });

    const item = expectValidParsedItem(xml);
    const declaration = item.responseDeclarations[0];
    const interaction = item.interactions[0];
    expect(declaration).toMatchObject({
      identifier: "RESPONSE",
      cardinality: "multiple",
      baseType: "pair",
      correctResponse: ["A B", "C D"],
    });
    expect(declaration.mapping?.entries).toEqual([
      expect.objectContaining({ mapKey: "A B", mappedValue: 1 }),
      expect.objectContaining({ mapKey: "C D", mappedValue: 1 }),
    ]);
    expect(interaction).toMatchObject({
      type: "graphicAssociate",
      responseIdentifier: "RESPONSE",
      responseCardinality: "multiple",
      responseBaseType: "pair",
    });
    expect(interaction.attributes).toMatchObject({
      class: "writer-graphic-associate",
      "min-associations": "1",
      "max-associations": "2",
      "data-qti-aria-describedby": "longdesc-graphic-associate-1",
    });
    expect(interaction.object).toMatchObject({
      data: "map.svg",
      type: "image/svg+xml",
      width: "480",
      height: "300",
      text: "Map of related areas",
      attributes: expect.objectContaining({ alt: "Map of related areas" }),
    });
    expect(interaction.choices.map((choice) => choice.identifier)).toEqual(["A", "B", "C", "D"]);
    expect(interaction.choices[0]?.attributes).toMatchObject({
      "hotspot-label": "Planning",
      "match-max": "1",
    });
    expect(item.responseProcessing?.template).toContain("rptemplates/map_response");
  });

  it("writes graphic associate items through the unified writer", () => {
    const item: Qti3AuthoringItem = {
      interactionType: "graphicAssociate",
      identifier: "graphic-associate-unified",
      title: "Graphic Associate",
      object: { data: "map.png", alt: "Map", width: 200, height: 120 },
      hotspots: [
        { identifier: "A", shape: "circle", coords: "50,50,10" },
        { identifier: "B", shape: "circle", coords: "150,50,10" },
      ],
      correctResponse: [{ sourceIdentifier: "A", targetIdentifier: "B" }],
    };
    const parsed = expectValidParsedItem(writeQti3AssessmentItem(item));

    expect(parsed.responseDeclarations[0]).toMatchObject({
      cardinality: "multiple",
      baseType: "pair",
      correctResponse: ["A B"],
    });
    expect(parsed.interactions[0]?.qtiName).toBe("qti-graphic-associate-interaction");
  });

  it("omits mapping when graphic associate scoring defaults to match_correct", () => {
    const xml = buildQti3GraphicAssociateItem({
      identifier: "graphic-associate-match-correct",
      title: "Graphic Associate",
      object: { data: "map.png", alt: "Map" },
      hotspots: [
        { identifier: "A", shape: "circle", coords: "50,50,10" },
        { identifier: "B", shape: "circle", coords: "150,50,10" },
      ],
      correctResponse: [{ sourceIdentifier: "A", targetIdentifier: "B" }],
    });

    expect(xml).not.toContain("<qti-mapping");
    expect(xml).toContain("rptemplates/match_correct");
  });

  it("rejects invalid graphic associate authoring inputs", () => {
    const diagnostics = validateQti3GraphicAssociateItem({
      identifier: "bad graphic associate",
      title: "",
      object: { data: "/uploads/no-extension", width: 0, height: -1 },
      hotspots: [
        { identifier: "A", shape: "rect", coords: "", matchMax: -1 },
        { identifier: "A", shape: "circle", coords: "1,1,2" },
      ],
      correctResponse: [
        { sourceIdentifier: "A", targetIdentifier: "A" },
        { sourceIdentifier: "A", targetIdentifier: "B" },
        { sourceIdentifier: "B", targetIdentifier: "A" },
      ],
      minAssociations: 2,
      maxAssociations: 1,
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "invalid_identifier",
        "missing_title",
        "missing_graphic_associate_object_alt",
        "unknown_graphic_associate_object_type",
        "invalid_graphic_associate_object_width",
        "invalid_graphic_associate_object_height",
        "duplicate_identifier",
        "missing_graphic_associate_coords",
        "invalid_graphic_associate_match_max",
        "invalid_graphic_associate_bounds",
        "invalid_graphic_associate_self_pair",
        "unknown_graphic_associate_reference",
        "duplicate_identifier",
      ]),
    );
    expect(diagnostics.every((diagnostic) => diagnostic.path.length > 0)).toBe(true);
  });

  it("rejects graphic associate correct responses that exceed a hotspot matchMax", () => {
    const diagnostics = validateQti3GraphicAssociateItem({
      identifier: "graphic-associate-match-max",
      title: "Graphic Associate",
      object: { data: "map.png", alt: "Map" },
      hotspots: [
        { identifier: "A", shape: "circle", coords: "50,50,10", matchMax: 1 },
        { identifier: "B", shape: "circle", coords: "150,50,10" },
        { identifier: "C", shape: "circle", coords: "50,120,10" },
      ],
      correctResponse: [
        { sourceIdentifier: "A", targetIdentifier: "B" },
        { sourceIdentifier: "A", targetIdentifier: "C" },
      ],
    });

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "graphic_associate_match_max_exceeded",
        path: "correctResponse",
        value: { identifier: "A", useCount: 2, matchMax: 1 },
      }),
    );
  });
});
