import { describe, expect, it } from "vitest";

import {
  buildQti3SelectPointItem,
  qti3TrustedXmlFragment,
  validateQti3SelectPointItem,
  writeQti3AssessmentItem,
  writeQti3AssessmentItemResult,
  Qti3WriterError,
} from "./index.js";
import { expectValidParsedItem } from "./test-helpers.js";

describe("qti3 select point writer", () => {
  it("writes a valid single-select point item with object metadata and area mapping", () => {
    const xml = buildQti3SelectPointItem({
      identifier: "select-point-1",
      title: "Select Point",
      bodyHtml: qti3TrustedXmlFragment("<p>Click the correct location.</p>"),
      promptHtml: qti3TrustedXmlFragment("<p>Mark Edinburgh.</p>"),
      responseIdentifier: "RESPONSE",
      object: {
        data: "images/uk.png",
        alt: "Map of the United Kingdom",
        width: 196,
        height: 280,
        longDescription: "A map of the United Kingdom.",
      },
      targets: [{ shape: "circle", coords: "102,113,16", mappedValue: 1 }],
      correctResponse: ["102 113"],
      minChoices: 0,
      maxChoices: 1,
      classNames: ["writer-select-point"],
    });

    expect(xml).toContain("<qti-select-point-interaction");
    expect(xml).toContain("map_response_point");
    expect(xml).toContain('data-qti-aria-describedby="longdesc-select-point-1"');

    const item = expectValidParsedItem(xml);
    expect(item.responseDeclarations[0]).toMatchObject({
      identifier: "RESPONSE",
      cardinality: "single",
      baseType: "point",
      correctResponse: "102 113",
    });
    expect(item.responseDeclarations[0]?.areaMapping).toMatchObject({
      defaultValue: 0,
      entries: [
        {
          shape: "circle",
          coords: [102, 113, 16],
          mappedValue: 1,
        },
      ],
    });
    expect(item.interactions[0]).toMatchObject({
      type: "selectPoint",
      qtiName: "qti-select-point-interaction",
      responseIdentifier: "RESPONSE",
      responseCardinality: "single",
      responseBaseType: "point",
    });
    expect(item.interactions[0]?.object).toMatchObject({
      data: "images/uk.png",
      type: "image/png",
      width: "196",
      height: "280",
      text: "Map of the United Kingdom",
    });
    expect(item.interactions[0]?.attributes).toMatchObject({
      class: "writer-select-point",
      "min-choices": "0",
      "max-choices": "1",
    });
  });

  it("writes multiple point responses through the unified writer", () => {
    const xml = writeQti3AssessmentItem({
      interactionType: "selectPoint",
      identifier: "select-point-multiple",
      title: "Select Points",
      object: { data: "plot.svg", alt: "Plot", width: 300, height: 200 },
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
    expect(item.responseDeclarations[0]?.areaMapping?.entries.map((entry) => entry.shape)).toEqual([
      "rect",
      "poly",
    ]);
  });

  it("writes explicit map-response-point processing for custom response identifiers", () => {
    const xml = buildQti3SelectPointItem({
      identifier: "select-point-custom-response",
      title: "Select Point",
      responseIdentifier: "POINT",
      object: { data: "plot.svg", alt: "Plot", width: 300, height: 200 },
      targets: [{ shape: "circle", coords: "10,10,5", mappedValue: 1 }],
      correctResponse: ["10 10"],
    });

    expect(xml).toContain('<qti-map-response-point identifier="POINT"/>');
    const item = expectValidParsedItem(xml);
    expect(item.responseDeclarations[0]?.identifier).toBe("POINT");
    expect(item.interactions[0]?.responseIdentifier).toBe("POINT");
  });

  it("returns diagnostics for invalid select point input", () => {
    expect(() =>
      buildQti3SelectPointItem({
        identifier: "bad select point",
        title: "",
        responseIdentifier: "POINT",
        object: { data: "/uploads/no-extension" },
        targets: [{ shape: "circle", coords: "1,2", mappedValue: Number.NaN }],
        correctResponse: ["1,2", "3 4"],
        minChoices: 2,
        maxChoices: 1,
      }),
    ).toThrow(Qti3WriterError);

    const result = writeQti3AssessmentItemResult({
      interactionType: "selectPoint",
      identifier: "bad select point",
      title: "",
      responseIdentifier: "POINT",
      object: { data: "/uploads/no-extension" },
      targets: [{ shape: "circle", coords: "1,2", mappedValue: Number.NaN }],
      correctResponse: ["1,2", "3 4"],
      minChoices: 2,
      maxChoices: 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
        expect.arrayContaining([
          "invalid_identifier",
          "missing_title",
          "missing_select_point_object_alt",
          "unknown_select_point_object_type",
          "invalid_select_point_bounds",
          "invalid_select_point_correct_response",
          "invalid_select_point_correct_response_count",
          "invalid_select_point_target_coords",
          "invalid_select_point_mapped_value",
        ]),
      );
      expect(result.diagnostics.every((diagnostic) => diagnostic.path.length > 0)).toBe(true);
    }
  });

  it("requires area mapping targets for map_response_point scoring", () => {
    const diagnostics = validateQti3SelectPointItem({
      identifier: "select-point-no-targets",
      title: "Select Point",
      object: { data: "map.png", alt: "Map", width: 100, height: 100 },
      correctResponse: ["10 10"],
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "missing_select_point_targets",
    );
  });
});
