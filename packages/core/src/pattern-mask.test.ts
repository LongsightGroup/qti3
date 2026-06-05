import { describe, expect, it } from "vitest";
import { compileQtiPatternMask, isValidQtiPatternMask } from "./pattern-mask.js";
import { parseQtiXml } from "./parser.js";
import { validateAssessmentItem } from "./validation.js";

describe("pattern-mask", () => {
  it("compiles anchored full-string patterns", () => {
    const pattern = compileQtiPatternMask("([0-9.]{0,6})");
    expect(pattern?.test("12.34")).toBe(true);
    expect(pattern?.test("12.3456")).toBe(false);
    expect(pattern?.test("abc")).toBe(false);
  });

  it("normalizes redundant anchors and empty masks", () => {
    const pattern = compileQtiPatternMask("^([0-9]{0,3})$");
    expect(pattern?.test("123")).toBe(true);
    expect(pattern?.test("1234")).toBe(false);
    expect(compileQtiPatternMask("")).toBeUndefined();
    expect(isValidQtiPatternMask(" ")).toBe(false);
  });

  it("rejects invalid regular expressions", () => {
    expect(isValidQtiPatternMask("(")).toBe(false);
    expect(compileQtiPatternMask("(")).toBeUndefined();
  });

  it("diagnoses invalid pattern-mask attributes during item validation", () => {
    const parsed = parseQtiXml(`<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="invalid-pattern-mask" title="invalid-pattern-mask" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
  <qti-item-body>
    <qti-extended-text-interaction response-identifier="RESPONSE" pattern-mask="*"/>
  </qti-item-body>
</qti-assessment-item>`);
    expect(parsed.ok).toBe(false);
    expect(parsed.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "interaction.patternMask.invalid",
          severity: "error",
        }),
      ]),
    );

    const validated = validateAssessmentItem(parsed.document!);
    expect(validated.ok).toBe(false);
    expect(validated.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "interaction.patternMask.invalid",
          severity: "error",
        }),
      ]),
    );
  });
});
