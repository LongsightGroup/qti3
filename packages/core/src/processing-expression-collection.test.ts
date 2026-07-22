import { describe, expect, it } from "vitest";
import { collectQtiResponseProcessingExpressions, parseQtiXml } from "./index.js";

describe("response-processing expression collection", () => {
  it("collects nested duration comparisons from a parsed item", () => {
    const parsed =
      parseQtiXml(`<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item" title="Item" adaptive="false" time-dependent="true">
  <qti-response-processing>
    <qti-set-outcome-value identifier="SCORE">
      <qti-duration-lt>
        <qti-variable identifier="duration"/>
        <qti-base-value base-type="duration">PT60S</qti-base-value>
      </qti-duration-lt>
    </qti-set-outcome-value>
  </qti-response-processing>
  <qti-item-body/>
</qti-assessment-item>`);

    expect(
      collectQtiResponseProcessingExpressions(parsed.document?.item.responseProcessing).map(
        (expression) => expression.type,
      ),
    ).toEqual(["durationCompare", "variable", "baseValue"]);
  });

  it("retains direct expressions for importer diagnostics", () => {
    const parsed =
      parseQtiXml(`<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item" title="Item" adaptive="false" time-dependent="true">
  <qti-response-processing>
    <qti-duration-gte>
      <qti-variable identifier="duration"/>
      <qti-base-value base-type="duration">PT60S</qti-base-value>
    </qti-duration-gte>
  </qti-response-processing>
  <qti-item-body/>
</qti-assessment-item>`);

    expect(
      collectQtiResponseProcessingExpressions(parsed.document?.item.responseProcessing).map(
        (expression) => expression.type,
      ),
    ).toEqual(["durationCompare", "variable", "baseValue"]);
  });
});
