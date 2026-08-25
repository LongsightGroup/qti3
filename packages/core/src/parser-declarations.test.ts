import { describe, expect, it } from "vitest";
import { createItemSession, parseQtiXml } from "./index.js";

const MALFORMED_DECLARATION_NUMBERS = `
  <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="malformed-declaration-numbers" title="malformed-declaration-numbers" time-dependent="false">
    <qti-response-declaration identifier="MAP" cardinality="single" base-type="identifier">
      <qti-mapping default-value="not-a-number">
        <qti-map-entry map-key="MISSING"/>
        <qti-map-entry map-key="B" mapped-value="Infinity"/>
        <qti-map-entry map-key="A" mapped-value="2"/>
      </qti-mapping>
    </qti-response-declaration>
    <qti-response-declaration identifier="DEFAULTED" cardinality="single" base-type="identifier">
      <qti-mapping><qti-map-entry map-key="A" mapped-value="1"/></qti-mapping>
    </qti-response-declaration>
    <qti-response-declaration identifier="AREA" cardinality="single" base-type="point">
      <qti-area-mapping default-value="Infinity">
        <qti-area-map-entry shape="circle" coords="10,10,5"/>
        <qti-area-map-entry shape="circle" coords="20,20,5" mapped-value="bad"/>
        <qti-area-map-entry shape="circle" coords="30,30,5" mapped-value="3"/>
      </qti-area-mapping>
    </qti-response-declaration>
    <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
      <qti-default-value><qti-value>0</qti-value></qti-default-value>
    </qti-outcome-declaration>
    <qti-outcome-declaration identifier="LOOKUP" cardinality="single" base-type="identifier">
      <qti-match-table default-value="fallback">
        <qti-match-table-entry source-value="bad" target-value="bad"/>
        <qti-match-table-entry target-value="missing"/>
        <qti-match-table-entry source-value="1" target-value="one"/>
      </qti-match-table>
    </qti-outcome-declaration>
    <qti-item-body>
      <qti-choice-interaction response-identifier="MAP" max-choices="1">
        <qti-simple-choice identifier="A">A</qti-simple-choice>
        <qti-simple-choice identifier="B">B</qti-simple-choice>
        <qti-simple-choice identifier="C">C</qti-simple-choice>
      </qti-choice-interaction>
    </qti-item-body>
    <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/map_response.xml"/>
  </qti-assessment-item>
`;

describe("declaration numeric parsing", () => {
  it("keeps invalid declaration numbers out of the returned runtime model", () => {
    const result = parseQtiXml(MALFORMED_DECLARATION_NUMBERS);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "mapping.defaultValue" }),
        expect.objectContaining({ code: "mapEntry.mappedValue.required" }),
        expect.objectContaining({ code: "mapEntry.mappedValue" }),
        expect.objectContaining({ code: "areaMapping.defaultValue" }),
        expect.objectContaining({ code: "areaMapEntry.mappedValue.required" }),
        expect.objectContaining({ code: "areaMapEntry.mappedValue" }),
        expect.objectContaining({ code: "lookupTable.entry.sourceValue" }),
      ]),
    );
    expect(
      result.diagnostics.filter((diagnostic) => diagnostic.code === "mapping.defaultValue"),
    ).toHaveLength(1);
    if (!result.document) throw new Error("Expected the invalid document for defensive use.");

    expectFiniteNumbers(result.document);
    const [mapping, defaulted, areaMapping] = result.document.item.responseDeclarations;
    expect(mapping?.mapping).toMatchObject({
      defaultValue: 0,
      entries: [{ mapKey: "A", mappedValue: 2 }],
    });
    expect(defaulted?.mapping?.defaultValue).toBe(0);
    expect(areaMapping?.areaMapping).toMatchObject({
      defaultValue: 0,
      entries: [{ mappedValue: 3 }],
    });
    expect(result.document.item.outcomeDeclarations[1]?.lookupTable?.entries).toMatchObject([
      { sourceValue: 1, targetValue: "one" },
    ]);

    const session = createItemSession(result.document);
    session.respond("MAP", "C");
    const score = session.score();
    expect(score.outcomes.SCORE).toBe(0);
    expectFiniteNumbers(score.state);
  });
});

function expectFiniteNumbers(value: unknown, path = "document"): void {
  if (typeof value === "number") {
    expect(Number.isFinite(value), `${path} must be finite`).toBe(true);
    return;
  }
  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) expectFiniteNumbers(entry, `${path}[${index}]`);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) expectFiniteNumbers(entry, `${path}.${key}`);
}
