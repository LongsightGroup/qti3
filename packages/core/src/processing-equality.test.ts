import { describe, expect, it } from "vitest";
import { createItemSession, parseQtiXml, serializeResponseProcessing } from "./index.js";

function item(attributes: string, left = "100", right = "110"): string {
  return `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="equality" title="Equality" time-dependent="false">
    <qti-outcome-declaration identifier="RESULT" cardinality="single" base-type="boolean"/>
    <qti-template-declaration identifier="T" cardinality="single" base-type="float"><qti-default-value><qti-value>10</qti-value></qti-default-value></qti-template-declaration>
    <qti-item-body><p>Numeric equality.</p></qti-item-body>
    <qti-response-processing><qti-set-outcome-value identifier="RESULT">
      <qti-equal ${attributes}>
        ${left === "NULL" ? "<qti-null/>" : `<qti-base-value base-type="float">${left}</qti-base-value>`}
        <qti-base-value base-type="float">${right}</qti-base-value>
      </qti-equal>
    </qti-set-outcome-value></qti-response-processing>
  </qti-assessment-item>`;
}

describe("numeric equality", () => {
  it.each([
    ["", "100", "100", true],
    ["", "100", "110", false],
    ['tolerance-mode="absolute" tolerance="0.1"', "3.14", "3.15", true],
    ['tolerance-mode="absolute" tolerance="1 10"', "100", "110", true],
    ['tolerance-mode="absolute" tolerance="1 10" include-upper-bound="false"', "100", "110", false],
    ['tolerance-mode="absolute" tolerance="1 10"', "100", "99", true],
    ['tolerance-mode="absolute" tolerance="1 10" include-lower-bound="0"', "100", "99", false],
    ['tolerance-mode="relative" tolerance="10 20"', "200", "240", true],
    [
      'tolerance-mode="relative" tolerance="10 20" include-upper-bound="false"',
      "200",
      "240",
      false,
    ],
    ['tolerance-mode="relative" tolerance="10 20"', "200", "179", false],
    ['tolerance-mode="absolute" tolerance="T"', "100", "110", true],
    ['tolerance-mode="absolute" tolerance="0"', "100", "100", true],
    ['tolerance-mode="absolute" tolerance="1"', "NULL", "100", null],
  ])("evaluates and round-trips %s (%s, %s)", (attributes, left, right, expected) => {
    const xml = item(attributes, left, right);
    const parsed = parseQtiXml(xml);
    expect(parsed.ok).toBe(true);
    if (!parsed.document?.item.responseProcessing) throw new Error("Expected processing");
    expect(createItemSession(parsed.document).score().outcomes.RESULT).toBe(expected);
    const serialized = serializeResponseProcessing(parsed.document.item.responseProcessing);
    expect(serialized.ok).toBe(true);
    const reparsed = parseQtiXml(
      xml.replace(
        /<qti-response-processing>[\s\S]*<\/qti-response-processing>/,
        serialized.xml ?? "",
      ),
    );
    expect(reparsed.ok).toBe(true);
    if (!reparsed.document) throw new Error("Expected round trip");
    expect(createItemSession(reparsed.document).score().outcomes.RESULT).toBe(expected);
    expect(reparsed.document.item.responseProcessing?.rules).toMatchObject(
      parsed.document.item.responseProcessing.rules.map((rule) => ({
        type: rule.type,
        ...(rule.type === "setOutcomeValue"
          ? {
              expression: {
                type: "equal",
                attributes: rule.expression.type === "equal" ? rule.expression.attributes : {},
              },
            }
          : {}),
      })),
    );
  });

  it.each([
    'tolerance-mode="approximate"',
    'tolerance-mode="absolute"',
    'tolerance-mode="relative" tolerance="-1"',
    'tolerance-mode="absolute" tolerance="1 2 3"',
    'tolerance-mode="absolute" tolerance="MISSING"',
    'include-lower-bound="yes"',
    'include-upper-bound="yes"',
  ])("diagnoses invalid equality attributes %s", (attributes) => {
    const parsed = parseQtiXml(item(attributes));
    expect(parsed.ok).toBe(false);
    expect(parsed.diagnostics).toContainEqual(
      expect.objectContaining({ code: "processing.equal.tolerance" }),
    );
  });
});
