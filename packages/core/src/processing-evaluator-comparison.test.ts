import { describe, expect, it } from "vitest";
import { createItemSession, parseQtiXml } from "./index.js";

function equalRoundedItem(roundingMode: string, figures: string, left: number, right: number) {
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="equal-rounded" title="equal-rounded" time-dependent="false">
      <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
        <qti-default-value><qti-value>0</qti-value></qti-default-value>
      </qti-outcome-declaration>
      <qti-item-body><p>Equal rounded evaluator test.</p></qti-item-body>
      <qti-response-processing>
        <qti-response-condition>
          <qti-response-if>
            <qti-equal-rounded rounding-mode="${roundingMode}" figures="${figures}">
              <qti-base-value base-type="float">${left}</qti-base-value>
              <qti-base-value base-type="float">${right}</qti-base-value>
            </qti-equal-rounded>
            <qti-set-outcome-value identifier="SCORE">
              <qti-base-value base-type="float">1</qti-base-value>
            </qti-set-outcome-value>
          </qti-response-if>
        </qti-response-condition>
      </qti-response-processing>
    </qti-assessment-item>
  `;
}

describe("equal-rounded evaluation", () => {
  it("keeps invalid significant figures from awarding credit", () => {
    const result = parseQtiXml(equalRoundedItem("significantFigures", "0", 1.2, 9.8));

    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.filter((diagnostic) => diagnostic.code === "processing.roundingFigures"),
    ).toHaveLength(1);
    expect(
      result.diagnostics.some((diagnostic) => diagnostic.code === "processing.roundingMode"),
    ).toBe(false);
    if (!result.document)
      throw new Error("Expected the invalid document for defensive evaluation.");

    expect(createItemSession(result.document).score().outcomes.SCORE).toBe(0);
  });

  it("compares valid decimal-place rounding", () => {
    const result = parseQtiXml(equalRoundedItem("decimalPlaces", "2", 1.233, 1.234));

    expect(result.ok).toBe(true);
    if (!result.document) throw new Error("Expected a valid document.");
    expect(createItemSession(result.document).score().outcomes.SCORE).toBe(1);
  });

  it("compares valid significant-figure rounding", () => {
    const result = parseQtiXml(equalRoundedItem("significantFigures", "2", 12.3, 12.4));

    expect(result.ok).toBe(true);
    if (!result.document) throw new Error("Expected a valid document.");
    expect(createItemSession(result.document).score().outcomes.SCORE).toBe(1);
  });
});
