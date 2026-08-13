import { describe, expect, it } from "vitest";
import { parseQtiXml } from "./parser.js";
import { parseQtiSliderDefinition } from "./slider-definition.js";
import type { QtiBaseType, QtiInteraction } from "./types.js";

function sliderXml(
  attributes: string,
  responseBaseType: Extract<QtiBaseType, "integer" | "float"> = "integer",
): string {
  return `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="slider-definition" title="slider-definition" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="${responseBaseType}"/>
  <qti-item-body>
    <qti-slider-interaction response-identifier="RESPONSE" ${attributes}/>
  </qti-item-body>
</qti-assessment-item>`;
}

function parsedSlider(attributes: string, responseBaseType?: "integer" | "float"): QtiInteraction {
  const result = parseQtiXml(sliderXml(attributes, responseBaseType));
  const interaction = result.document?.item.interactions[0];
  if (!interaction) throw new Error("Expected parsed slider interaction.");
  return interaction;
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

  it("applies the QTI integer bound rounding rules", () => {
    const result = parseQtiSliderDefinition(
      parsedSlider('lower-bound="0.2" upper-bound="9.2" step="1"'),
    );

    expect(result).toEqual({
      ok: true,
      value: {
        lowerBound: 0,
        upperBound: 10,
        step: { kind: "discrete", value: 1 },
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
        step: { kind: "discrete", value: 0.000000000000001 },
      },
    });
  });
});
