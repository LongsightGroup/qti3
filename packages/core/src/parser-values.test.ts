import { describe, expect, it } from "vitest";
import {
  coerceValue,
  parseFiniteNumber,
  parseInteger,
  parseQtiPair,
  parseXmlBoolean,
} from "./parser-values.js";
import { isBooleanAttribute } from "./validation-primitives.js";

describe("parseXmlBoolean", () => {
  it.each([
    ["true", true],
    ["false", false],
    ["1", true],
    ["0", false],
    [" TRUE ", true],
    [" False ", false],
    [undefined, undefined],
    ["", undefined],
    ["yes", undefined],
  ] as const)("parses %j as %j", (value, expected) => {
    expect(parseXmlBoolean(value)).toBe(expected);
  });

  it("coerces declaration boolean values with numeric XML literals", () => {
    expect(coerceValue("1", "boolean")).toBe(true);
    expect(coerceValue("0", "boolean")).toBe(false);
  });

  it("only coerces complete finite numeric values", () => {
    expect(coerceValue("12", "integer")).toBe(12);
    expect(coerceValue("12garbage", "integer")).toBe("12garbage");
    expect(coerceValue("1.5", "float")).toBe(1.5);
    expect(coerceValue("1.5garbage", "float")).toBe("1.5garbage");
    expect(coerceValue("0x10", "float")).toBe("0x10");
    expect(coerceValue("0b10", "float")).toBe("0b10");
    expect(coerceValue("Infinity", "float")).toBe("Infinity");
  });

  it("canonicalizes pair values without changing directed-pair endpoint order", () => {
    expect(parseQtiPair(" B   A ", "pair")).toBe("A B");
    expect(parseQtiPair(" B   A ", "directedPair")).toBe("B A");
    expect(coerceValue("B A", "pair")).toBe("A B");
    expect(parseQtiPair("A", "pair")).toBeUndefined();
  });

  it.each([
    ["0", 0],
    ["+1", 1],
    ["-1.5", -1.5],
    ["1.", 1],
    [".5", 0.5],
    ["-.5", -0.5],
    ["1e2", 100],
    ["1E-2", 0.01],
    [" 1.5 ", 1.5],
  ] as const)("parses QTI float lexical value %j", (value, expected) => {
    expect(parseFiniteNumber(value)).toBe(expected);
  });

  it.each(["", ".", "+", "0x10", "0b10", "0o10", "1_000", "1f", "INF", "NaN"])(
    "rejects non-finite or non-QTI float lexical value %j",
    (value) => {
      expect(parseFiniteNumber(value)).toBeUndefined();
    },
  );

  it("parses complete integer lexical values", () => {
    expect(parseInteger(" -12 ")).toBe(-12);
    expect(parseInteger("12.5")).toBeUndefined();
    expect(parseInteger("12garbage")).toBeUndefined();
  });

  it("shares boolean validation with isBooleanAttribute", () => {
    expect(isBooleanAttribute("1")).toBe(true);
    expect(isBooleanAttribute(" TRUE ")).toBe(true);
    expect(isBooleanAttribute("maybe")).toBe(false);
  });
});
