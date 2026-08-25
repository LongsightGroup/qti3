import { describe, expect, it } from "vitest";
import { createItemSession, parseQtiXml } from "./index.js";

describe("processing mapping", () => {
  it("scores an inline response condition with map-response", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="mapped" title="mapped" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
          <qti-mapping default-value="0">
            <qti-map-entry map-key="A" mapped-value="2"/>
          </qti-mapping>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
        <qti-response-processing>
          <qti-response-condition>
            <qti-response-if>
              <qti-is-null>
                <qti-variable identifier="RESPONSE"/>
              </qti-is-null>
              <qti-set-outcome-value identifier="SCORE">
                <qti-base-value base-type="float">0</qti-base-value>
              </qti-set-outcome-value>
            </qti-response-if>
            <qti-response-else>
              <qti-set-outcome-value identifier="SCORE">
                <qti-map-response identifier="RESPONSE"/>
              </qti-set-outcome-value>
            </qti-response-else>
          </qti-response-condition>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!);
    session.respond("RESPONSE", "A");
    expect(session.score().outcomes.SCORE).toBe(2);
  });

  it("uses mapping default-value for unmapped responses", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="mapped-default" title="mapped-default" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
          <qti-mapping default-value="-1">
            <qti-map-entry map-key="A" mapped-value="2"/>
          </qti-mapping>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
            <qti-simple-choice identifier="B">B</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
        <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/map_response"/>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!);
    session.respond("RESPONSE", "B");
    expect(session.score().outcomes.SCORE).toBe(-1);
  });

  it("rejects built-in map-response templates across multiple response declarations", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="mapped-template-sum" title="mapped-template-sum" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE1" cardinality="single" base-type="identifier">
          <qti-mapping default-value="0">
            <qti-map-entry map-key="A" mapped-value="1"/>
          </qti-mapping>
        </qti-response-declaration>
        <qti-response-declaration identifier="RESPONSE2" cardinality="single" base-type="identifier">
          <qti-mapping default-value="0">
            <qti-map-entry map-key="B" mapped-value="2"/>
          </qti-mapping>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE1">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
            <qti-simple-choice identifier="Z">Z</qti-simple-choice>
          </qti-choice-interaction>
          <qti-choice-interaction response-identifier="RESPONSE2">
            <qti-simple-choice identifier="B">B</qti-simple-choice>
            <qti-simple-choice identifier="Z">Z</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
        <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/map_response"/>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "processing.template.responseIdentifier" }),
        expect.objectContaining({ code: "processing.template.singleInteraction" }),
      ]),
    );
  });

  it("maps scalar numeric responses in map-response templates", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="mapped-integer" title="mapped-integer" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer">
          <qti-mapping default-value="0">
            <qti-map-entry map-key="5" mapped-value="2"/>
          </qti-mapping>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-slider-interaction response-identifier="RESPONSE" lower-bound="0" upper-bound="10"/>
        </qti-item-body>
        <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/map_response"/>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!);
    session.respond("RESPONSE", 5);
    expect(session.score().outcomes.SCORE).toBe(2);
  });

  it("rejects built-in match-correct templates across multiple response declarations", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="match-template-sum" title="match-template-sum" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE1" cardinality="single" base-type="identifier">
          <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-response-declaration identifier="RESPONSE2" cardinality="single" base-type="identifier">
          <qti-correct-response><qti-value>B</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE1">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
            <qti-simple-choice identifier="Z">Z</qti-simple-choice>
          </qti-choice-interaction>
          <qti-choice-interaction response-identifier="RESPONSE2">
            <qti-simple-choice identifier="B">B</qti-simple-choice>
            <qti-simple-choice identifier="Z">Z</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
        <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "processing.template.responseIdentifier" }),
        expect.objectContaining({ code: "processing.template.singleInteraction" }),
      ]),
    );
  });

  it("applies mapping lower and upper bounds to mapped scores", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="mapped-bounds" title="mapped-bounds" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="identifier">
          <qti-mapping default-value="-2" lower-bound="0" upper-bound="3">
            <qti-map-entry map-key="A" mapped-value="2"/>
            <qti-map-entry map-key="B" mapped-value="2"/>
          </qti-mapping>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE" max-choices="3">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
            <qti-simple-choice identifier="B">B</qti-simple-choice>
            <qti-simple-choice identifier="C">C</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
        <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/map_response"/>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!);
    session.respond("RESPONSE", ["A", "B"]);
    expect(session.score().outcomes.SCORE).toBe(3);
    session.respond("RESPONSE", ["C"]);
    expect(session.score().outcomes.SCORE).toBe(0);
  });

  it("validates mapping entry attributes", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-mapping" title="bad-mapping" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
          <qti-mapping default-value="none" lower-bound="high" upper-bound="low">
            <qti-map-entry mapped-value="1"/>
            <qti-map-entry map-key="A"/>
            <qti-map-entry map-key="B" mapped-value="many"/>
          </qti-mapping>
        </qti-response-declaration>
        <qti-response-declaration identifier="BOUNDED" cardinality="single" base-type="identifier">
          <qti-mapping default-value="0" lower-bound="5" upper-bound="1">
            <qti-map-entry map-key="A" mapped-value="1"/>
          </qti-mapping>
        </qti-response-declaration>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
            <qti-simple-choice identifier="B">B</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "mapping.defaultValue" }),
        expect.objectContaining({ code: "mapping.lowerBound" }),
        expect.objectContaining({ code: "mapping.upperBound" }),
        expect.objectContaining({ code: "mapping.bounds" }),
        expect.objectContaining({ code: "mapEntry.mapKey.required" }),
        expect.objectContaining({ code: "mapEntry.mappedValue.required" }),
        expect.objectContaining({ code: "mapEntry.mappedValue" }),
      ]),
    );
  });

  it("validates mapping keys against interaction choices", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-mapping-refs" title="bad-mapping-refs" time-dependent="false">
        <qti-response-declaration identifier="CHOICE" cardinality="single" base-type="identifier">
          <qti-mapping default-value="0">
            <qti-map-entry map-key="MISSING" mapped-value="1"/>
          </qti-mapping>
        </qti-response-declaration>
        <qti-response-declaration identifier="MATCH" cardinality="multiple" base-type="directedPair">
          <qti-mapping default-value="0">
            <qti-map-entry map-key="A MISSING" mapped-value="1"/>
          </qti-mapping>
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
          code: "mapping.mapKey.reference",
          path: "/qti-assessment-item/qti-response-declaration[1]/qti-mapping[1]/qti-map-entry[1]",
        }),
        expect.objectContaining({
          code: "mapping.mapKey.reference",
          path: "/qti-assessment-item/qti-response-declaration[2]/qti-mapping[1]/qti-map-entry[1]",
        }),
      ]),
    );
  });

  it("validates qti-match variable and correct identifiers", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-match-correct" title="bad-match-correct" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
        <qti-response-processing>
          <qti-response-condition>
            <qti-response-if>
              <qti-match>
                <qti-variable identifier="MISSING_RESPONSE"/>
                <qti-correct identifier="MISSING_CORRECT"/>
              </qti-match>
              <qti-set-outcome-value identifier="SCORE">
                <qti-base-value base-type="float">1</qti-base-value>
              </qti-set-outcome-value>
            </qti-response-if>
          </qti-response-condition>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.document?.item.responseProcessing?.conditions[0]?.ifExpression).toMatchObject({
      type: "matchCorrect",
      identifier: "MISSING_RESPONSE",
      correctIdentifier: "MISSING_CORRECT",
    });
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "processing.response.reference" }),
        expect.objectContaining({ code: "processing.correct.reference" }),
      ]),
    );
  });

  it("evaluates generic qti-match expressions", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="generic-match-processing" title="generic-match-processing" time-dependent="false">
        <qti-response-declaration identifier="ORDERED_RESPONSE" cardinality="ordered" base-type="identifier"/>
        <qti-outcome-declaration identifier="BASE_MATCH" cardinality="single" base-type="boolean"/>
        <qti-outcome-declaration identifier="ORDERED_MATCH" cardinality="single" base-type="boolean"/>
        <qti-item-body/>
        <qti-response-processing>
          <qti-response-condition>
            <qti-response-if>
              <qti-base-value base-type="boolean">true</qti-base-value>
              <qti-set-outcome-value identifier="BASE_MATCH">
                <qti-match>
                  <qti-base-value base-type="identifier">A</qti-base-value>
                  <qti-base-value base-type="identifier">A</qti-base-value>
                </qti-match>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="ORDERED_MATCH">
                <qti-match>
                  <qti-variable identifier="ORDERED_RESPONSE"/>
                  <qti-ordered>
                    <qti-base-value base-type="identifier">A</qti-base-value>
                    <qti-base-value base-type="identifier">B</qti-base-value>
                  </qti-ordered>
                </qti-match>
              </qti-set-outcome-value>
            </qti-response-if>
          </qti-response-condition>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!);
    session.respond("ORDERED_RESPONSE", ["A", "B"]);
    expect(session.score().outcomes).toMatchObject({
      BASE_MATCH: true,
      ORDERED_MATCH: true,
    });
    session.respond("ORDERED_RESPONSE", ["B", "A"]);
    expect(session.score().outcomes.ORDERED_MATCH).toBe(false);
  });

  it("scores map-response-point with circular area mapping", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="point" title="point" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="point">
          <qti-area-mapping default-value="0">
            <qti-area-map-entry shape="circle" coords="93,111,16" mapped-value="1"/>
          </qti-area-mapping>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-select-point-interaction response-identifier="RESPONSE">
            <object data="image.png" type="image/png" width="160" height="120"/>
          </qti-select-point-interaction>
        </qti-item-body>
        <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/map_response_point.xml"/>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!);
    session.respond("RESPONSE", "93 111");
    expect(session.score().outcomes.SCORE).toBe(1);
  });

  it("evaluates explicit correct, default, and map-response-point expressions", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="explicit-declaration-expressions" title="explicit-declaration-expressions" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
          <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
          <qti-default-value><qti-value>B</qti-value></qti-default-value>
        </qti-response-declaration>
        <qti-response-declaration identifier="POINT" cardinality="single" base-type="point">
          <qti-area-mapping default-value="0">
            <qti-area-map-entry shape="circle" coords="93,111,16" mapped-value="2"/>
          </qti-area-mapping>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="CORRECT_VALUE" cardinality="single" base-type="identifier"/>
        <qti-outcome-declaration identifier="DEFAULT_VALUE" cardinality="single" base-type="identifier"/>
        <qti-outcome-declaration identifier="POINT_SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
            <qti-simple-choice identifier="B">B</qti-simple-choice>
          </qti-choice-interaction>
          <qti-select-point-interaction response-identifier="POINT">
            <object data="image.png" type="image/png" width="160" height="120"/>
          </qti-select-point-interaction>
        </qti-item-body>
        <qti-response-processing>
          <qti-response-condition>
            <qti-response-if>
              <qti-base-value base-type="boolean">true</qti-base-value>
              <qti-set-outcome-value identifier="CORRECT_VALUE">
                <qti-correct identifier="RESPONSE"/>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="DEFAULT_VALUE">
                <qti-default identifier="RESPONSE"/>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="POINT_SCORE">
                <qti-map-response-point identifier="POINT"/>
              </qti-set-outcome-value>
            </qti-response-if>
          </qti-response-condition>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!);
    session.respond("POINT", "93 111");
    const score = session.score();
    expect(score.outcomes.CORRECT_VALUE).toBe("A");
    expect(score.outcomes.DEFAULT_VALUE).toBe("B");
    expect(score.outcomes.POINT_SCORE).toBe(2);
  });

  it("validates area mapping entry attributes", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-area-mapping" title="bad-area-mapping" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="point">
          <qti-area-mapping default-value="none" lower-bound="low" upper-bound="high">
            <qti-area-map-entry coords="93,not-a-number,16"/>
            <qti-area-map-entry shape="ellipse" mapped-value="one"/>
            <qti-area-map-entry shape="rect" coords="1,2,3" mapped-value="1"/>
          </qti-area-mapping>
        </qti-response-declaration>
        <qti-item-body>
          <qti-select-point-interaction response-identifier="RESPONSE">
            <object data="image.png" type="image/png" width="160" height="120"/>
          </qti-select-point-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "areaMapping.defaultValue" }),
        expect.objectContaining({ code: "areaMapping.lowerBound" }),
        expect.objectContaining({ code: "areaMapping.upperBound" }),
        expect.objectContaining({ code: "areaMapEntry.shape.required" }),
        expect.objectContaining({ code: "areaMapEntry.shape" }),
        expect.objectContaining({ code: "areaMapEntry.coords.required" }),
        expect.objectContaining({ code: "areaMapEntry.coords" }),
        expect.objectContaining({ code: "areaMapEntry.coords.shape" }),
        expect.objectContaining({ code: "areaMapEntry.mappedValue.required" }),
        expect.objectContaining({ code: "areaMapEntry.mappedValue" }),
      ]),
    );
  });

  it("classifies match choices into source and target roles", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="match" title="match" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
        <qti-item-body>
          <qti-match-interaction response-identifier="RESPONSE">
            <qti-simple-match-set>
              <qti-simple-associable-choice identifier="A" match-max="1">A</qti-simple-associable-choice>
            </qti-simple-match-set>
            <qti-simple-match-set>
              <qti-simple-associable-choice identifier="G1" match-max="1">Target</qti-simple-associable-choice>
            </qti-simple-match-set>
          </qti-match-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.document?.item.interactions[0]?.choices).toMatchObject([
      { identifier: "A", role: "matchSource" },
      { identifier: "G1", role: "matchTarget" },
    ]);
  });

  it("looks up outcome values from match and interpolation tables", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="lookup-outcome" title="lookup-outcome" time-dependent="false">
        <qti-response-declaration identifier="RAW" cardinality="single" base-type="integer"/>
        <qti-response-declaration identifier="CODE" cardinality="single" base-type="integer"/>
        <qti-outcome-declaration identifier="GRADE" cardinality="single" base-type="identifier">
          <qti-interpolation-table default-value="F">
            <qti-interpolation-table-entry source-value="60" target-value="D"/>
            <qti-interpolation-table-entry source-value="80" target-value="B"/>
            <qti-interpolation-table-entry source-value="100" target-value="A"/>
          </qti-interpolation-table>
        </qti-outcome-declaration>
        <qti-outcome-declaration identifier="LABEL" cardinality="single" base-type="string">
          <qti-match-table default-value="unknown">
            <qti-match-table-entry source-value="1" target-value="first"/>
            <qti-match-table-entry source-value="2" target-value="second"/>
          </qti-match-table>
        </qti-outcome-declaration>
        <qti-item-body>
          <qti-slider-interaction response-identifier="RAW" lower-bound="0" upper-bound="100"/>
          <qti-slider-interaction response-identifier="CODE" lower-bound="1" upper-bound="3"/>
        </qti-item-body>
        <qti-response-processing>
          <qti-response-condition>
            <qti-response-if>
              <qti-base-value base-type="boolean">true</qti-base-value>
              <qti-lookup-outcome-value identifier="GRADE">
                <qti-variable identifier="RAW"/>
              </qti-lookup-outcome-value>
              <qti-lookup-outcome-value identifier="LABEL">
                <qti-variable identifier="CODE"/>
              </qti-lookup-outcome-value>
            </qti-response-if>
          </qti-response-condition>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!);
    session.respond("RAW", 85);
    session.respond("CODE", 2);
    expect(session.score().outcomes).toMatchObject({ GRADE: "A", LABEL: "second" });
    session.respond("RAW", 101);
    session.respond("CODE", 3);
    expect(session.score().outcomes).toMatchObject({ GRADE: "F", LABEL: "unknown" });
  });

  it("evaluates inside point-shape processing expressions", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="inside-processing" title="inside-processing" time-dependent="false">
        <qti-response-declaration identifier="POINTS" cardinality="multiple" base-type="point"/>
        <qti-outcome-declaration identifier="ANY_INSIDE" cardinality="single" base-type="boolean"/>
        <qti-outcome-declaration identifier="NONE_INSIDE" cardinality="single" base-type="boolean"/>
        <qti-outcome-declaration identifier="IN_POLY" cardinality="single" base-type="boolean"/>
        <qti-item-body>
          <qti-select-point-interaction response-identifier="POINTS">
            <object data="image.svg" type="image/svg+xml" width="100" height="100"/>
          </qti-select-point-interaction>
        </qti-item-body>
        <qti-response-processing>
          <qti-response-condition>
            <qti-response-if>
              <qti-base-value base-type="boolean">true</qti-base-value>
              <qti-set-outcome-value identifier="ANY_INSIDE">
                <qti-inside shape="rect" coords="10,10,20,20">
                  <qti-variable identifier="POINTS"/>
                </qti-inside>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="NONE_INSIDE">
                <qti-inside shape="circle" coords="50,50,5">
                  <qti-variable identifier="POINTS"/>
                </qti-inside>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="IN_POLY">
                <qti-inside shape="poly" coords="0,0,40,0,40,40,0,40">
                  <qti-base-value base-type="point">12 12</qti-base-value>
                </qti-inside>
              </qti-set-outcome-value>
            </qti-response-if>
          </qti-response-condition>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!);
    session.respond("POINTS", ["5 5", "15 15"]);
    const score = session.score();
    expect(score.outcomes.ANY_INSIDE).toBe(true);
    expect(score.outcomes.NONE_INSIDE).toBe(false);
    expect(score.outcomes.IN_POLY).toBe(true);
  });

  it("evaluates field values from record variables", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="record-field-processing" title="record-field-processing" time-dependent="false">
        <qti-outcome-declaration identifier="RECORD" cardinality="record">
          <qti-default-value>
            <qti-value field-identifier="raw" base-type="integer">7</qti-value>
            <qti-value field-identifier="label" base-type="string">Washington</qti-value>
          </qti-default-value>
        </qti-outcome-declaration>
        <qti-outcome-declaration identifier="RAW" cardinality="single" base-type="integer"/>
        <qti-outcome-declaration identifier="LABEL" cardinality="single" base-type="string"/>
        <qti-outcome-declaration identifier="MISSING" cardinality="single" base-type="string"/>
        <qti-item-body/>
        <qti-response-processing>
          <qti-response-condition>
            <qti-response-if>
              <qti-base-value base-type="boolean">true</qti-base-value>
              <qti-set-outcome-value identifier="RAW">
                <qti-field-value field-identifier="raw">
                  <qti-variable identifier="RECORD"/>
                </qti-field-value>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="LABEL">
                <qti-field-value field-identifier="label">
                  <qti-variable identifier="RECORD"/>
                </qti-field-value>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="MISSING">
                <qti-field-value field-identifier="unknown">
                  <qti-variable identifier="RECORD"/>
                </qti-field-value>
              </qti-set-outcome-value>
            </qti-response-if>
          </qti-response-condition>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!);
    const score = session.score();
    expect(score.outcomes.RAW).toBe(7);
    expect(score.outcomes.LABEL).toBe("Washington");
    expect(score.outcomes.MISSING).toBeNull();
  });
});
