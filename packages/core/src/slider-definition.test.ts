import { describe, expect, it } from "vitest";
import { parseQtiXml } from "./parser.js";
import {
  parseQtiSliderDefinition,
  parseQtiSliderValue,
  qtiSliderDiscreteValue,
  qtiSliderRatio,
  snapQtiSliderValue,
  type QtiSliderDefinition,
} from "./slider-definition.js";
import type { QtiInteraction } from "./types.js";

function sliderXml(attributes: string, responseBaseType: string = "integer"): string {
  return `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="slider-definition" title="slider-definition" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="${responseBaseType}"/>
  <qti-item-body>
    <qti-slider-interaction response-identifier="RESPONSE" ${attributes}/>
  </qti-item-body>
</qti-assessment-item>`;
}

function parsedSlider(attributes: string, responseBaseType?: string): QtiInteraction {
  const result = parseQtiXml(sliderXml(attributes, responseBaseType));
  const interaction = result.document?.item.interactions[0];
  if (!interaction) throw new Error("Expected parsed slider interaction.");
  return interaction;
}

function sliderDefinition(
  attributes: string,
  responseBaseType?: "integer" | "float",
): QtiSliderDefinition {
  const result = parseQtiSliderDefinition(parsedSlider(attributes, responseBaseType));
  if (!result.ok) throw new Error("Expected a refined slider definition.");
  return result.value;
}

describe("QTI slider definition", () => {
  it("returns every invalid presentation attribute as a focused diagnostic", () => {
    const result = parseQtiXml(
      sliderXml(
        'lower-bound="0" upper-bound="10" orientation="diagonal" reverse="backward" step-label="sometimes"',
      ),
    );

    expect(result.ok).toBe(false);
    expect(
      result.diagnostics
        .filter((entry) => entry.code === "interaction.booleanAttribute")
        .map((entry) => entry.message),
    ).toEqual([
      "qti-slider-interaction requires boolean reverse, got backward.",
      "qti-slider-interaction requires boolean step-label, got sometimes.",
    ]);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "interaction.slider.orientation" })]),
    );
  });

  it("rejects a fractional step for an integer response instead of truncating selections", () => {
    const result = parseQtiXml(sliderXml('lower-bound="0" upper-bound="2" step="0.5"'));

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "interaction.slider.integerStep" })]),
    );
  });

  it("owns the diagnostic for an unsupported response base type", () => {
    const result = parseQtiXml(sliderXml('lower-bound="0" upper-bound="10" step="1"', "string"));

    expect(result.ok).toBe(false);
    expect(
      result.diagnostics
        .filter((entry) => entry.code === "interaction.baseType")
        .map((entry) => entry.message),
    ).toEqual(["qti-slider-interaction expects integer or float base type, got string."]);
    expect(
      parseQtiSliderDefinition(parsedSlider('lower-bound="0" upper-bound="10" step="1"', "string")),
    ).toEqual({
      ok: false,
      diagnostics: [
        expect.objectContaining({
          code: "interaction.baseType",
          message: "qti-slider-interaction expects integer or float base type, got string.",
        }),
      ],
    });
  });

  it("still reports bound and step errors when the base type is unsupported", () => {
    const result = parseQtiXml(
      sliderXml('lower-bound="10" upper-bound="5" step="0" orientation="diagonal"', "identifier"),
    );

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "interaction.baseType" }),
        expect.objectContaining({ code: "interaction.slider.bounds" }),
        expect.objectContaining({ code: "interaction.numericAttribute" }),
        expect.objectContaining({ code: "interaction.slider.orientation" }),
      ]),
    );
    expect(
      result.diagnostics.filter((entry) => entry.code === "interaction.baseType"),
    ).toHaveLength(1);
  });

  it("applies the QTI integer bound rounding rules", () => {
    const result = parseQtiSliderDefinition(
      parsedSlider('lower-bound="0.2" upper-bound="9.2" step="1"'),
    );

    expect(result).toEqual({
      ok: true,
      value: {
        lowerBound: 0,
        upperBound: 10,
        step: { kind: "aligned", value: 1, intervalCount: 10 },
        orientation: "horizontal",
        reverse: false,
        stepLabels: false,
        responseBaseType: "integer",
      },
    });
  });

  it("models a float slider without an authored step as continuous", () => {
    const result = parseQtiSliderDefinition(
      parsedSlider('lower-bound="0" upper-bound="1"', "float"),
    );

    expect(result).toMatchObject({
      ok: true,
      value: { step: { kind: "continuous" }, responseBaseType: "float" },
    });
  });

  it("models an unaligned upper bound without expanding the stop list", () => {
    const result = parseQtiSliderDefinition(
      parsedSlider('lower-bound="0" upper-bound="10" step="3"'),
    );

    expect(result).toEqual({
      ok: true,
      value: {
        lowerBound: 0,
        upperBound: 10,
        step: { kind: "detachedUpper", value: 3, regularIntervalCount: 3 },
        orientation: "horizontal",
        reverse: false,
        stepLabels: false,
        responseBaseType: "integer",
      },
    });
  });

  it("preserves distinct high-precision float bounds", () => {
    const result = parseQtiSliderDefinition(
      parsedSlider(
        'lower-bound="0.123456789012345" upper-bound="0.123456789012346" step="0.000000000000001"',
        "float",
      ),
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        lowerBound: 0.123456789012345,
        upperBound: 0.123456789012346,
        step: { kind: "aligned", value: 0.000000000000001, intervalCount: 1 },
      },
    });
  });

  it("rejects a discrete scale whose interval count cannot be represented safely", () => {
    const result = parseQtiSliderDefinition(
      parsedSlider('lower-bound="0" upper-bound="1" step="1e-17"', "float"),
    );

    expect(result).toEqual({
      ok: false,
      diagnostics: [expect.objectContaining({ code: "interaction.slider.resolution" })],
    });
  });

  it("preserves representable subnormal float steps", () => {
    const result = parseQtiSliderDefinition(
      parsedSlider('lower-bound="0" upper-bound="1e-322" step="5e-324"', "float"),
    );
    if (!result.ok) throw new Error("Expected a refined subnormal slider scale.");

    expect(result.value.step).toEqual({ kind: "aligned", value: 5e-324, intervalCount: 20 });
    expect(qtiSliderDiscreteValue(result.value, 10)).toBe(5e-323);
    expect(snapQtiSliderValue(5e-323, result.value)).toBe(5e-323);
  });
});

describe("QTI slider value domain", () => {
  const aligned = sliderDefinition('lower-bound="0" upper-bound="10" step="1"');
  const unaligned = sliderDefinition('lower-bound="0" upper-bound="10" step="3"');
  const continuous = sliderDefinition('lower-bound="0" upper-bound="1"', "float");

  it("snaps aligned discrete values to the nearest regular stop", () => {
    expect(snapQtiSliderValue(1.4, aligned)).toBe(1);
    expect(snapQtiSliderValue(1.6, aligned)).toBe(2);
    expect(snapQtiSliderValue(-2, aligned)).toBe(0);
    expect(snapQtiSliderValue(12, aligned)).toBe(10);
  });

  it("parses only values that belong to the refined domain", () => {
    expect(parseQtiSliderValue(3, aligned)).toEqual({ ok: true, value: 3 });
    expect(parseQtiSliderValue("3", aligned)).toEqual({ ok: true, value: 3 });
    expect(parseQtiSliderValue(3.5, aligned)).toEqual({ ok: false, reason: "notInteger" });
    expect(parseQtiSliderValue(11, aligned)).toEqual({ ok: false, reason: "outsideBounds" });
    expect(parseQtiSliderValue(4, unaligned)).toEqual({
      ok: false,
      reason: "outsideStepSequence",
    });
  });

  it("snaps an unaligned upper bound to the closer of the last regular stop and the endpoint", () => {
    expect(snapQtiSliderValue(8, unaligned)).toBe(9);
    expect(snapQtiSliderValue(9.6, unaligned)).toBe(10);
    expect(snapQtiSliderValue(9.9, unaligned)).toBe(10);
    expect(qtiSliderDiscreteValue(unaligned, 3)).toBe(9);
  });

  it("clamps continuous values without inventing a step sequence", () => {
    expect(snapQtiSliderValue(0.42, continuous)).toBe(0.42);
    expect(snapQtiSliderValue(-1, continuous)).toBe(0);
    expect(snapQtiSliderValue(2, continuous)).toBe(1);
    expect(qtiSliderRatio(0.25, continuous)).toBe(0.25);
  });
});
