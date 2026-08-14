import {
  parseQtiSliderDefinition,
  parseQtiXml,
  type QtiSliderDefinition,
  type QtiSliderOrientation,
} from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import { sliderKeyboardValue, sliderTicks } from "./slider-scale.js";

interface SliderDefinitionOptions {
  readonly lowerBound?: number;
  readonly upperBound?: number;
  readonly step?: number;
  readonly orientation?: QtiSliderOrientation;
  readonly reverse?: boolean;
  readonly stepLabels?: boolean;
  readonly responseBaseType?: "integer" | "float";
}

function definition(options: SliderDefinitionOptions = {}): QtiSliderDefinition {
  const lowerBound = options.lowerBound ?? 0;
  const upperBound = options.upperBound ?? 8;
  const responseBaseType = options.responseBaseType ?? "integer";
  const attributes = [
    `lower-bound="${lowerBound}"`,
    `upper-bound="${upperBound}"`,
    ...(options.step === undefined ? [] : [`step="${options.step}"`]),
    ...(options.orientation === undefined ? [] : [`orientation="${options.orientation}"`]),
    ...(options.reverse ? ['reverse="true"'] : []),
    ...(options.stepLabels ? ['step-label="true"'] : []),
  ].join(" ");
  const parsed = parseQtiXml(
    `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="slider-scale" title="slider-scale" time-dependent="false">
      <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="${responseBaseType}"/>
      <qti-item-body>
        <qti-slider-interaction response-identifier="RESPONSE" ${attributes}/>
      </qti-item-body>
    </qti-assessment-item>`,
  );
  const interaction = parsed.document?.item.interactions[0];
  if (!interaction) throw new Error("Expected a parsed slider interaction.");
  const result = parseQtiSliderDefinition(interaction);
  if (!result.ok) throw new Error("Expected a refined slider definition.");
  return result.value;
}

describe("slider keyboard mapping", () => {
  const horizontal = definition({ step: 1 });
  const vertical = definition({
    orientation: "vertical",
    step: 1,
  });
  const reversedHorizontal = definition({
    reverse: true,
    step: 1,
  });
  const reversedVertical = definition({
    orientation: "vertical",
    reverse: true,
    step: 1,
  });
  const unaligned = definition({
    upperBound: 10,
    step: 3,
  });
  const continuous = definition({
    upperBound: 1,
    responseBaseType: "float",
  });

  it("maps orthogonal arrows onto the same authored-value axis", () => {
    expect(sliderKeyboardValue("ArrowUp", 0, horizontal)).toBe(1);
    expect(sliderKeyboardValue("ArrowDown", 1, horizontal)).toBe(0);
    expect(sliderKeyboardValue("ArrowRight", 0, vertical)).toBe(1);
    expect(sliderKeyboardValue("ArrowLeft", 1, vertical)).toBe(0);
  });

  it("uses physical direction for reversed sliders", () => {
    expect(sliderKeyboardValue("ArrowLeft", 0, reversedHorizontal)).toBe(1);
    expect(sliderKeyboardValue("ArrowRight", 1, reversedHorizontal)).toBe(0);
    expect(sliderKeyboardValue("ArrowDown", 0, reversedVertical)).toBe(1);
    expect(sliderKeyboardValue("ArrowUp", 1, reversedVertical)).toBe(0);
  });

  it("treats Home and End as authored bounds", () => {
    expect(sliderKeyboardValue("Home", 4, reversedHorizontal)).toBe(0);
    expect(sliderKeyboardValue("End", 4, unaligned)).toBe(10);
  });

  it("moves ten steps for Page keys and keeps the unaligned upper reachable", () => {
    expect(sliderKeyboardValue("PageUp", 0, horizontal)).toBe(8);
    expect(sliderKeyboardValue("PageDown", 8, horizontal)).toBe(0);
    expect(sliderKeyboardValue("ArrowRight", 9, unaligned)).toBe(10);
    expect(sliderKeyboardValue("ArrowLeft", 10, unaligned)).toBe(9);
  });

  it("uses a hundredth of the range as the continuous keyboard step", () => {
    expect(sliderKeyboardValue("ArrowRight", 0, continuous)).toBe(0.01);
    expect(sliderKeyboardValue("PageUp", 0, continuous)).toBe(0.1);
  });
});

describe("slider tick sampling", () => {
  it("shows only endpoints when step labels are off or the slider is continuous", () => {
    expect(
      sliderTicks(
        definition({
          step: 1,
        }),
      ),
    ).toEqual({
      density: "endpoints",
      ticks: [
        { kind: "endpoint", label: "0", ratio: 0 },
        { kind: "endpoint", label: "8", ratio: 1 },
      ],
    });
    expect(
      sliderTicks(
        definition({
          stepLabels: true,
          upperBound: 1,
          responseBaseType: "float",
        }),
      ).density,
    ).toBe("endpoints");
  });

  it("includes an unaligned upper bound among the authored step labels", () => {
    expect(
      sliderTicks(
        definition({
          upperBound: 10,
          stepLabels: true,
          step: 3,
        }),
      ).ticks.map((tick) => tick.label),
    ).toEqual(["0", "3", "6", "9", "10"]);
  });

  it("samples dense step labels down to nine positions including both bounds", () => {
    const ticks = sliderTicks(
      definition({
        upperBound: 100,
        stepLabels: true,
        step: 1,
      }),
    );
    expect(ticks.density).toBe("sampled");
    expect(ticks.ticks.map((tick) => tick.label)).toEqual([
      "0",
      "13",
      "25",
      "38",
      "50",
      "63",
      "75",
      "88",
      "100",
    ]);
  });
});
