import { describe, expect, it } from "vitest";
import { createItemSession, parseQtiXml, validateAssessmentItem } from "./index.js";

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

  it("rejects empty numeric attributes without losing diagnostics on omitted entries", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="empty-declaration-numbers" title="empty-declaration-numbers" time-dependent="false">
        <qti-response-declaration identifier="MAP" cardinality="single" base-type="identifier">
          <qti-mapping default-value="">
            <qti-map-entry mapped-value=""/>
          </qti-mapping>
        </qti-response-declaration>
        <qti-response-declaration identifier="AREA" cardinality="single" base-type="point">
          <qti-area-mapping default-value="">
            <qti-area-map-entry mapped-value=""/>
          </qti-area-mapping>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="LOOKUP" cardinality="single" base-type="identifier">
          <qti-match-table default-value="fallback">
            <qti-match-table-entry source-value=""/>
          </qti-match-table>
        </qti-outcome-declaration>
        <qti-item-body/>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    for (const code of [
      "mapping.defaultValue",
      "mapEntry.mapKey.required",
      "mapEntry.mappedValue",
      "areaMapping.defaultValue",
      "areaMapEntry.shape.required",
      "areaMapEntry.coords.required",
      "areaMapEntry.mappedValue",
      "lookupTable.entry.sourceValue",
      "lookupTable.entry.targetValue",
      "lookupTable.match.sourceValue",
    ]) {
      expect(
        result.diagnostics.filter((diagnostic) => diagnostic.code === code),
        `${code} should be reported once`,
      ).toHaveLength(1);
    }

    const [mapping, areaMapping] = result.document?.item.responseDeclarations ?? [];
    expect(mapping?.mapping).toMatchObject({ defaultValue: 0, entries: [] });
    expect(areaMapping?.areaMapping).toMatchObject({ defaultValue: 0, entries: [] });
    expect(result.document?.item.outcomeDeclarations[0]?.lookupTable?.entries).toEqual([]);
  });

  it("retains independent validation for caller-constructed declaration entries", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="validation-seam" title="validation-seam" time-dependent="false">
        <qti-response-declaration identifier="MAP" cardinality="single" base-type="identifier">
          <qti-mapping><qti-map-entry map-key="A" mapped-value="1"/></qti-mapping>
        </qti-response-declaration>
        <qti-item-body/>
      </qti-assessment-item>
    `);
    const document = result.document;
    const entry = document?.item.responseDeclarations[0]?.mapping?.entries[0];
    if (!document || !entry) throw new Error("Expected a parsed mapping entry.");

    entry.attributes["mapped-value"] = "";

    expect(validateAssessmentItem(document).diagnostics).toContainEqual(
      expect.objectContaining({ code: "mapEntry.mappedValue" }),
    );
  });
});

describe("declaration value parsing", () => {
  it.each([
    {
      name: "a mapped response correct value",
      declaration: `
        <qti-response-declaration identifier="RESPONSE" cardinality="record">
          <qti-correct-response>
            <qti-value field-identifier="answer" base-type="integer">7</qti-value>
            <qti-value base-type="string">discarded</qti-value>
          </qti-correct-response>
          <qti-mapping default-value="0">
            <qti-map-entry map-key="answer" mapped-value="1"/>
          </qti-mapping>
        </qti-response-declaration>`,
      path: "/qti-assessment-item/qti-response-declaration[1]/qti-correct-response[1]",
      value: (result: ReturnType<typeof parseQtiXml>) =>
        result.document?.item.responseDeclarations[0]?.correctResponse,
    },
    {
      name: "a response default value",
      declaration: `
        <qti-response-declaration identifier="RESPONSE" cardinality="record">
          <qti-default-value>
            <qti-value field-identifier="answer" base-type="integer">7</qti-value>
            <qti-value base-type="string">discarded</qti-value>
          </qti-default-value>
        </qti-response-declaration>`,
      path: "/qti-assessment-item/qti-response-declaration[1]/qti-default-value[1]",
      value: (result: ReturnType<typeof parseQtiXml>) =>
        result.document?.item.responseDeclarations[0]?.defaultValue,
    },
    {
      name: "an outcome default value",
      declaration: `
        <qti-outcome-declaration identifier="OUTCOME" cardinality="record">
          <qti-default-value>
            <qti-value field-identifier="answer" base-type="integer">7</qti-value>
            <qti-value base-type="string">discarded</qti-value>
          </qti-default-value>
        </qti-outcome-declaration>`,
      path: "/qti-assessment-item/qti-outcome-declaration[1]/qti-default-value[1]",
      value: (result: ReturnType<typeof parseQtiXml>) =>
        result.document?.item.outcomeDeclarations[0]?.defaultValue,
    },
    {
      name: "a template default value",
      declaration: `
        <qti-template-declaration identifier="TEMPLATE" cardinality="record">
          <qti-default-value>
            <qti-value field-identifier="answer" base-type="integer">7</qti-value>
            <qti-value base-type="string">discarded</qti-value>
          </qti-default-value>
        </qti-template-declaration>`,
      path: "/qti-assessment-item/qti-template-declaration[1]/qti-default-value[1]",
      value: (result: ReturnType<typeof parseQtiXml>) =>
        result.document?.item.templateDeclarations[0]?.defaultValue,
    },
  ])("diagnoses mixed field identifiers in $name", ({ declaration, path, value }) => {
    const result = parseQtiXml(declarationItemXml(declaration));
    const diagnostics = result.diagnostics.filter(
      (diagnostic) => diagnostic.code === "declaration.value.fieldIdentifier.mixed",
    );

    expect(result.ok).toBe(false);
    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: "error",
        path,
        source: expect.objectContaining({ path }),
      }),
    ]);
    expect(value(result)).toEqual({ answer: 7 });
  });

  it("preserves scalar, container, and record value behavior", () => {
    const result = parseQtiXml(
      declarationItemXml(`
        <qti-response-declaration identifier="SCALAR" cardinality="single" base-type="identifier">
          <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-response-declaration identifier="CONTAINER" cardinality="multiple" base-type="identifier">
          <qti-correct-response>
            <qti-value>A</qti-value>
            <qti-value>B</qti-value>
          </qti-correct-response>
        </qti-response-declaration>
        <qti-response-declaration identifier="RECORD" cardinality="record">
          <qti-correct-response>
            <qti-value field-identifier="count" base-type="integer">2</qti-value>
            <qti-value field-identifier="label" base-type="string">two</qti-value>
          </qti-correct-response>
        </qti-response-declaration>`),
    );

    expect(result.ok).toBe(true);
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "declaration.value.fieldIdentifier.mixed" }),
    );
    expect(
      result.document?.item.responseDeclarations.map((declaration) => declaration.correctResponse),
    ).toEqual(["A", ["A", "B"], { count: 2, label: "two" }]);
  });
});

function declarationItemXml(declarations: string): string {
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="declaration-values" title="declaration-values" time-dependent="false">
      ${declarations}
      <qti-item-body/>
    </qti-assessment-item>`;
}

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

describe("declaration parsing and validation", () => {
  it("coerces declaration values using declaration base-types", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="typed-defaults" title="typed-defaults" time-dependent="false">
        <qti-template-declaration identifier="TEMPLATE_COUNT" cardinality="single" base-type="integer">
          <qti-default-value><qti-value>4</qti-value></qti-default-value>
        </qti-template-declaration>
        <qti-response-declaration identifier="COUNT" cardinality="single" base-type="integer">
          <qti-default-value><qti-value>2</qti-value></qti-default-value>
          <qti-correct-response><qti-value>3</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-response-declaration identifier="FLAGS" cardinality="multiple" base-type="boolean">
          <qti-default-value>
            <qti-value>true</qti-value>
            <qti-value>false</qti-value>
          </qti-default-value>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="MAXSCORE" cardinality="single" base-type="float">
          <qti-default-value><qti-value>1</qti-value></qti-default-value>
        </qti-outcome-declaration>
        <qti-outcome-declaration identifier="ATTEMPTS" cardinality="single" base-type="integer">
          <qti-default-value><qti-value>0</qti-value></qti-default-value>
        </qti-outcome-declaration>
        <qti-outcome-declaration identifier="PASSED" cardinality="single" base-type="boolean">
          <qti-default-value><qti-value>false</qti-value></qti-default-value>
        </qti-outcome-declaration>
        <qti-item-body><p>Typed defaults.</p></qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.document).toBeDefined();
    const document = result.document!;
    const countDeclaration = document.item.responseDeclarations.find(
      (declaration) => declaration.identifier === "COUNT",
    );
    expect(countDeclaration?.defaultValue).toBe(2);
    expect(countDeclaration?.correctResponse).toBe(3);

    const session = createItemSession(document);
    const state = session.serialize();
    expect(state.responses.COUNT).toBeUndefined();
    expect(state.responses.FLAGS).toBeUndefined();
    expect(state.outcomes.MAXSCORE).toBe(1);
    expect(state.outcomes.ATTEMPTS).toBe(0);
    expect(state.outcomes.PASSED).toBe(false);

    session.respond("COUNT", 3);
    const startedState = session.serialize();
    expect(startedState.responses.COUNT).toBe(3);
    expect(startedState.responses.FLAGS).toEqual([true, false]);
    expect(state.templateValues?.TEMPLATE_COUNT).toBe(4);
  });

  it("does not mask missing or unsupported declaration attributes with parser defaults", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" time-dependent="false">
        <qti-response-declaration cardinality="many" base-type="nonsense"/>
        <qti-outcome-declaration identifier="SCORE"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.document?.item.identifier).toBe("");
    expect(result.document?.item.responseDeclarations[0]?.identifier).toBe("");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "identifier.required" }),
        expect.objectContaining({ code: "declaration.cardinality" }),
        expect.objectContaining({ code: "declaration.baseType" }),
        expect.objectContaining({ code: "declaration.cardinality.required" }),
        expect.objectContaining({ code: "declaration.baseType.required" }),
      ]),
    );
  });

  it("validates declaration default and correct response values against base types", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-declaration-values" title="bad-declaration-values" time-dependent="false">
        <qti-response-declaration identifier="INT_RESPONSE" cardinality="single" base-type="integer">
          <qti-correct-response>
            <qti-value>abc</qti-value>
          </qti-correct-response>
        </qti-response-declaration>
        <qti-response-declaration identifier="POINT_RESPONSE" cardinality="single" base-type="point">
          <qti-correct-response>
            <qti-value>10</qti-value>
          </qti-correct-response>
        </qti-response-declaration>
        <qti-response-declaration identifier="PAIR_RESPONSE" cardinality="multiple" base-type="directedPair">
          <qti-correct-response>
            <qti-value>A</qti-value>
          </qti-correct-response>
        </qti-response-declaration>
        <qti-response-declaration identifier="SINGLE_RESPONSE" cardinality="single" base-type="identifier">
          <qti-correct-response>
            <qti-value>A</qti-value>
            <qti-value>B</qti-value>
          </qti-correct-response>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="BOOLEAN_OUTCOME" cardinality="single" base-type="boolean">
          <qti-default-value>
            <qti-value>yes</qti-value>
          </qti-default-value>
        </qti-outcome-declaration>
        <qti-template-declaration identifier="FLOAT_TEMPLATE" cardinality="single" base-type="float">
          <qti-default-value>
            <qti-value>not-a-float</qti-value>
          </qti-default-value>
        </qti-template-declaration>
        <qti-item-body>
          <qti-custom-interaction response-identifier="INT_RESPONSE"/>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "declaration.correctResponse.baseType",
          message: expect.stringContaining("INT_RESPONSE"),
        }),
        expect.objectContaining({
          code: "declaration.correctResponse.baseType",
          message: expect.stringContaining("POINT_RESPONSE"),
        }),
        expect.objectContaining({
          code: "declaration.correctResponse.baseType",
          message: expect.stringContaining("PAIR_RESPONSE"),
        }),
        expect.objectContaining({
          code: "declaration.correctResponse.cardinality",
          message: expect.stringContaining("SINGLE_RESPONSE"),
        }),
        expect.objectContaining({
          code: "declaration.defaultValue.baseType",
          message: expect.stringContaining("BOOLEAN_OUTCOME"),
        }),
        expect.objectContaining({
          code: "declaration.defaultValue.baseType",
          message: expect.stringContaining("FLOAT_TEMPLATE"),
        }),
      ]),
    );
  });

  it("validates correct response choice references", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-correct-response-refs" title="bad-correct-response-refs" time-dependent="false">
        <qti-response-declaration identifier="CHOICE" cardinality="single" base-type="identifier">
          <qti-correct-response><qti-value>MISSING</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-response-declaration identifier="MATCH" cardinality="multiple" base-type="directedPair">
          <qti-correct-response><qti-value>A MISSING</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-item-body>
          <qti-choice-interaction response-identifier="CHOICE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
          </qti-choice-interaction>
          <qti-match-interaction response-identifier="MATCH">
            <qti-simple-match-set>
              <qti-simple-associable-choice identifier="A" match-max="1">A</qti-simple-associable-choice>
            </qti-simple-match-set>
            <qti-simple-match-set>
              <qti-simple-associable-choice identifier="B" match-max="1">B</qti-simple-associable-choice>
            </qti-simple-match-set>
          </qti-match-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "response.correctResponse.reference",
          path: "/qti-assessment-item/qti-response-declaration[1]",
        }),
        expect.objectContaining({
          code: "response.correctResponse.reference",
          path: "/qti-assessment-item/qti-response-declaration[2]",
        }),
      ]),
    );
  });
});
