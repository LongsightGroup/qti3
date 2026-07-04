import { describe, expect, it } from "vitest";

import {
  buildQti3SliderItem,
  qti3TrustedXmlFragment,
  writeQti3AssessmentItem,
  writeQti3AssessmentItemResult,
  Qti3WriterError,
} from "./index.js";
import { expectValidParsedItem } from "./test-helpers.js";

describe("qti3 slider writer", () => {
  it("writes a mapped integer slider with presentation attributes", () => {
    const xml = buildQti3SliderItem({
      identifier: "slider-1",
      title: "Slider",
      bodyHtml: qti3TrustedXmlFragment("<p>Move the handle.</p>"),
      promptHtml: qti3TrustedXmlFragment("<p>Select the impact score.</p>"),
      responseIdentifier: "RESPONSE",
      lowerBound: 0,
      upperBound: 100,
      step: 10,
      stepLabel: false,
      orientation: "horizontal",
      reverse: true,
      correctResponse: 70,
      mappings: [
        { mapKey: 60, mappedValue: 0.5 },
        { mapKey: 70, mappedValue: 1 },
      ],
      scoring: "map_response",
      classNames: ["writer-slider"],
    });

    expect(xml).toContain("<qti-slider-interaction");
    expect(xml).toContain("map_response");
    expect(xml).toContain('step-label="false"');
    expect(xml).toContain('reverse="true"');

    const item = expectValidParsedItem(xml);
    expect(item.responseDeclarations[0]).toMatchObject({
      identifier: "RESPONSE",
      cardinality: "single",
      baseType: "integer",
      correctResponse: 70,
    });
    expect(item.responseDeclarations[0]?.mapping).toMatchObject({
      defaultValue: 0,
      entries: [
        { mapKey: "60", mappedValue: 0.5 },
        { mapKey: "70", mappedValue: 1 },
      ],
    });
    expect(item.interactions[0]).toMatchObject({
      type: "slider",
      qtiName: "qti-slider-interaction",
      responseIdentifier: "RESPONSE",
      responseCardinality: "single",
      responseBaseType: "integer",
    });
    expect(item.interactions[0]?.attributes).toMatchObject({
      class: "writer-slider",
      "lower-bound": "0",
      "upper-bound": "100",
      step: "10",
      "step-label": "false",
      orientation: "horizontal",
      reverse: "true",
    });
  });

  it("infers float base type and defaults to match_correct without mappings", () => {
    const xml = writeQti3AssessmentItem({
      interactionType: "slider",
      identifier: "slider-float",
      title: "Slider",
      lowerBound: 0,
      upperBound: 1,
      step: 0.1,
      correctResponse: 0.7,
    });

    expect(xml).toContain("match_correct");
    expect(xml).not.toContain("<qti-mapping");
    const item = expectValidParsedItem(xml);
    expect(item.responseDeclarations[0]).toMatchObject({
      baseType: "float",
      correctResponse: 0.7,
    });
  });

  it("writes explicit map-response processing for custom response identifiers", () => {
    const xml = buildQti3SliderItem({
      identifier: "slider-custom-response",
      title: "Slider",
      responseIdentifier: "SLIDER",
      lowerBound: 0,
      upperBound: 10,
      step: 1,
      correctResponse: 5,
      mappings: [{ mapKey: 5, mappedValue: 1 }],
      scoring: "map_response",
    });

    expect(xml).toContain('<qti-map-response identifier="SLIDER"/>');
    const item = expectValidParsedItem(xml);
    expect(item.responseDeclarations[0]?.identifier).toBe("SLIDER");
    expect(item.interactions[0]?.responseIdentifier).toBe("SLIDER");
  });

  it("returns diagnostics for invalid slider input", () => {
    expect(() =>
      buildQti3SliderItem({
        identifier: "bad slider",
        title: "",
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
      }),
    ).toThrow(Qti3WriterError);

    const result = writeQti3AssessmentItemResult({
      interactionType: "slider",
      identifier: "bad slider",
      title: "",
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
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
        expect.arrayContaining([
          "invalid_identifier",
          "missing_title",
          "invalid_slider_bounds",
          "invalid_slider_step",
          "invalid_slider_correct_response_bounds",
          "invalid_slider_integer_value",
          "invalid_slider_mapped_value",
          "duplicate_slider_map_key",
        ]),
      );
      expect(result.diagnostics.every((diagnostic) => diagnostic.path.length > 0)).toBe(true);
    }
  });

  it("requires mappings when map_response scoring is requested", () => {
    const result = writeQti3AssessmentItemResult({
      interactionType: "slider",
      identifier: "slider-no-mapping",
      title: "Slider",
      lowerBound: 0,
      upperBound: 10,
      correctResponse: 5,
      scoring: "map_response",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
        "missing_slider_mappings",
      );
    }
  });

  it("rejects fractional slider geometry for integer base type", () => {
    const result = writeQti3AssessmentItemResult({
      interactionType: "slider",
      identifier: "slider-integer-geometry",
      title: "Slider",
      lowerBound: 0.5,
      upperBound: 10.5,
      step: 0.5,
      correctResponse: 5,
      baseType: "integer",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics.map((diagnostic) => diagnostic.path)).toEqual(
        expect.arrayContaining(["lowerBound", "upperBound", "step"]),
      );
    }
  });
});
