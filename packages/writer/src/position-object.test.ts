import { describe, expect, it } from "vitest";

import {
  buildQti3PositionObjectItem,
  qti3TrustedXmlFragment,
  validateQti3PositionObjectItem,
  writeQti3AssessmentItem,
  writeQti3AssessmentItemResult,
  Qti3WriterError,
} from "./index.js";
import { expectValidParsedItem } from "./test-helpers.js";

describe("qti3 position object writer", () => {
  it("writes a valid position object item with stage and movable object metadata", () => {
    const xml = buildQti3PositionObjectItem({
      identifier: "position-object-1",
      title: "Position Object",
      bodyHtml: qti3TrustedXmlFragment("<p>Place the marker.</p>"),
      promptHtml: qti3TrustedXmlFragment("<p>Drag the marker to Edinburgh.</p>"),
      responseIdentifier: "RESPONSE",
      stageObject: {
        data: "images/uk.png",
        alt: "Map of the United Kingdom",
        type: "image/png",
        width: 206,
        height: 280,
        longDescription: "A map of the United Kingdom.",
      },
      movableObject: {
        data: "images/airport.png",
        alt: "Airport marker",
        type: "image/png",
        width: 16,
        height: 16,
      },
      targets: [{ shape: "circle", coords: "118,184,12", mappedValue: 1 }],
      correctResponse: ["118 184"],
      centerPoint: "118 184",
      minChoices: 0,
      maxChoices: 1,
      classNames: ["writer-position-object"],
    });

    expect(xml).toContain("<qti-position-object-stage>");
    expect(xml).toContain("<qti-position-object-interaction");
    expect(xml).toContain('center-point="118 184"');
    expect(xml).toContain("map_response_point");

    const item = expectValidParsedItem(xml);
    expect(item.responseDeclarations[0]).toMatchObject({
      identifier: "RESPONSE",
      cardinality: "single",
      baseType: "point",
      correctResponse: "118 184",
    });
    expect(item.responseDeclarations[0]?.areaMapping).toMatchObject({
      defaultValue: 0,
      entries: [{ shape: "circle", coords: [118, 184, 12], mappedValue: 1 }],
    });
    expect(item.interactions[0]).toMatchObject({
      type: "positionObject",
      qtiName: "qti-position-object-interaction",
      responseIdentifier: "RESPONSE",
      responseCardinality: "single",
      responseBaseType: "point",
    });
    expect(item.interactions[0]?.positionObjectStage).toMatchObject({
      data: "images/uk.png",
      type: "image/png",
      width: "206",
      height: "280",
      text: "Map of the United Kingdom",
    });
    expect(item.interactions[0]?.object).toMatchObject({
      data: "images/airport.png",
      type: "image/png",
      width: "16",
      height: "16",
      text: "Airport marker",
    });
    expect(item.interactions[0]?.attributes).toMatchObject({
      class: "writer-position-object",
      "center-point": "118 184",
      "min-choices": "0",
      "max-choices": "1",
    });
  });

  it("writes multiple position points through the unified writer", () => {
    const xml = writeQti3AssessmentItem({
      interactionType: "positionObject",
      identifier: "position-object-multiple",
      title: "Position Objects",
      stageObject: { data: "stage.svg", alt: "Stage", width: 300, height: 200 },
      movableObject: { data: "marker.svg", alt: "Marker", width: 24, height: 24 },
      targets: [
        { shape: "rect", coords: "10,10,50,50", mappedValue: 1 },
        { shape: "poly", coords: "100,100,120,120,140,100", mappedValue: 2 },
      ],
      correctResponse: ["20 20", "120 110"],
      maxChoices: 2,
    });

    const item = expectValidParsedItem(xml);
    expect(item.responseDeclarations[0]).toMatchObject({
      cardinality: "multiple",
      baseType: "point",
      correctResponse: ["20 20", "120 110"],
    });
    expect(item.interactions[0]?.positionObjectStage?.data).toBe("stage.svg");
    expect(item.interactions[0]?.object?.data).toBe("marker.svg");
  });

  it("writes explicit map-response-point processing for custom response identifiers", () => {
    const xml = buildQti3PositionObjectItem({
      identifier: "position-object-custom-response",
      title: "Position Object",
      responseIdentifier: "POINT",
      stageObject: { data: "stage.svg", alt: "Stage", width: 300, height: 200 },
      movableObject: { data: "marker.svg", alt: "Marker", width: 24, height: 24 },
      targets: [{ shape: "circle", coords: "10,10,5", mappedValue: 1 }],
      correctResponse: ["10 10"],
    });

    expect(xml).toContain('<qti-map-response-point identifier="POINT"/>');
    const item = expectValidParsedItem(xml);
    expect(item.responseDeclarations[0]?.identifier).toBe("POINT");
    expect(item.interactions[0]?.responseIdentifier).toBe("POINT");
  });

  it("returns diagnostics for invalid position object input", () => {
    expect(() =>
      buildQti3PositionObjectItem({
        identifier: "bad position object",
        title: "",
        responseIdentifier: "bad response",
        stageObject: { data: "/uploads/no-extension" },
        movableObject: { data: "marker.png" },
        targets: [{ shape: "circle", coords: "1,2", mappedValue: Number.NaN }],
        correctResponse: ["1,2", "3 4", "3   4"],
        centerPoint: "1,2",
        minChoices: 2,
        maxChoices: 1,
      }),
    ).toThrow(Qti3WriterError);

    const result = writeQti3AssessmentItemResult({
      interactionType: "positionObject",
      identifier: "bad position object",
      title: "",
      responseIdentifier: "bad response",
      stageObject: { data: "/uploads/no-extension" },
      movableObject: { data: "marker.png" },
      targets: [{ shape: "circle", coords: "1,2", mappedValue: Number.NaN }],
      correctResponse: ["1,2", "3 4", "3   4"],
      centerPoint: "1,2",
      minChoices: 2,
      maxChoices: 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
        expect.arrayContaining([
          "invalid_identifier",
          "missing_title",
          "missing_position_object_stage_object_alt",
          "unknown_position_object_stage_object_type",
          "missing_position_object_movable_object_alt",
          "invalid_position_object_bounds",
          "duplicate_identifier",
          "invalid_position_object_correct_response",
          "invalid_position_object_correct_response_count",
          "invalid_position_object_center_point",
          "invalid_position_object_target_coords",
          "invalid_position_object_mapped_value",
        ]),
      );
      expect(result.diagnostics.every((diagnostic) => diagnostic.path.length > 0)).toBe(true);
    }
  });

  it("requires area mapping targets for map_response_point scoring", () => {
    const diagnostics = validateQti3PositionObjectItem({
      identifier: "position-object-no-targets",
      title: "Position Object",
      stageObject: { data: "stage.png", alt: "Stage", width: 100, height: 100 },
      movableObject: { data: "marker.png", alt: "Marker", width: 16, height: 16 },
      correctResponse: ["10 10"],
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "missing_position_object_targets",
    );
  });
});
