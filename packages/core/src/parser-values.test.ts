import { describe, expect, it } from "vitest";
import { coerceValue, parseXmlBoolean } from "./parser-values.js";
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

  it("shares boolean validation with isBooleanAttribute", () => {
    expect(isBooleanAttribute("1")).toBe(true);
    expect(isBooleanAttribute(" TRUE ")).toBe(true);
    expect(isBooleanAttribute("maybe")).toBe(false);
  });
});
