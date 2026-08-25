import { describe, expect, it } from "vitest";
import { roundToDecimalPlaces, roundToSignificantFigures } from "./processing-operators.js";

describe("decimal rounding operators", () => {
  it.each([
    [0.615, 2, 0.62],
    [1.005, 2, 1.01],
    [2.675, 2, 2.68],
    [-0.615, 2, -0.62],
    [9.995, 2, 10],
    [123_456_789_012_345.5, 0, 123_456_789_012_346],
  ])("rounds %s to %s decimal places as %s", (value, figures, expected) => {
    expect(roundToDecimalPlaces(value, figures)).toBe(expected);
  });

  it("returns the input when decimal places exceed binary float significance", () => {
    const value = 1.234_567_890_123_456_7;
    expect(roundToDecimalPlaces(value, 20)).toBe(value);
  });

  it.each([
    [0.000_123_4, 3, 0.000_123],
    [1.005, 3, 1.01],
    [-1.005, 3, -1.01],
    [9.995, 3, 10],
    [98_765_432_101_234.5, 10, 98_765_432_100_000],
  ])("rounds %s to %s significant figures as %s", (value, figures, expected) => {
    expect(roundToSignificantFigures(value, figures)).toBe(expected);
  });

  it("preserves zero and values already within the requested significant figures", () => {
    expect(roundToSignificantFigures(0, 3)).toBe(0);
    const value = 1.234_567_890_123_456_7;
    expect(roundToSignificantFigures(value, 20)).toBe(value);
  });

  it("preserves the existing signed-zero behavior", () => {
    expect(Object.is(roundToDecimalPlaces(-0, 2), -0)).toBe(true);
    expect(Object.is(roundToSignificantFigures(-0, 3), 0)).toBe(true);
  });

  it("preserves existing non-finite behavior", () => {
    expect(roundToDecimalPlaces(Number.POSITIVE_INFINITY, 2)).toBe(Number.POSITIVE_INFINITY);
    expect(roundToDecimalPlaces(Number.NEGATIVE_INFINITY, 2)).toBe(Number.NEGATIVE_INFINITY);
    expect(roundToDecimalPlaces(Number.NaN, 2)).toBeNaN();
    expect(roundToSignificantFigures(Number.POSITIVE_INFINITY, 3)).toBeNaN();
    expect(roundToSignificantFigures(Number.NEGATIVE_INFINITY, 3)).toBeNaN();
    expect(roundToSignificantFigures(Number.NaN, 3)).toBeNaN();
  });
});
