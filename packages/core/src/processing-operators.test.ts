import { describe, expect, it } from "vitest";
import { createItemSession, parseQtiXml } from "./index.js";

describe("processing operators", () => {
  it("validates base value processing content", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-base-values" title="bad-base-values" time-dependent="false">
        <qti-template-declaration identifier="A" cardinality="single" base-type="integer"/>
        <qti-template-declaration identifier="B" cardinality="single" base-type="float"/>
        <qti-template-declaration identifier="C" cardinality="single" base-type="boolean"/>
        <qti-template-declaration identifier="D" cardinality="single" base-type="string"/>
        <qti-item-body/>
        <qti-template-processing>
          <qti-set-template-value identifier="A">
            <qti-base-value base-type="integer">ten</qti-base-value>
          </qti-set-template-value>
          <qti-set-template-value identifier="B">
            <qti-base-value base-type="float">many</qti-base-value>
          </qti-set-template-value>
          <qti-set-template-value identifier="C">
            <qti-base-value base-type="boolean">yes</qti-base-value>
          </qti-set-template-value>
          <qti-set-template-value identifier="D">
            <qti-base-value>missing</qti-base-value>
          </qti-set-template-value>
        </qti-template-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "processing.baseValue.numeric" }),
        expect.objectContaining({ code: "processing.baseValue.boolean" }),
        expect.objectContaining({ code: "processing.baseValue.baseType.required" }),
      ]),
    );
  });

  it("evaluates qti-null as an explicit null expression", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="null-processing" title="null-processing" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-response-declaration identifier="MISSING" cardinality="single" base-type="identifier"/>
        <qti-outcome-declaration identifier="NULL_VALUE" cardinality="single" base-type="identifier"/>
        <qti-outcome-declaration identifier="MISSING_IS_NULL" cardinality="single" base-type="boolean"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
        <qti-response-processing>
          <qti-set-outcome-value identifier="NULL_VALUE">
            <qti-null/>
          </qti-set-outcome-value>
          <qti-set-outcome-value identifier="MISSING_IS_NULL">
            <qti-is-null>
              <qti-variable identifier="MISSING"/>
            </qti-is-null>
          </qti-set-outcome-value>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!);
    const score = session.score();
    expect(score.outcomes.NULL_VALUE).toBeNull();
    expect(score.outcomes.MISSING_IS_NULL).toBe(true);
  });

  it("preserves QTI null semantics across response processing operators", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="null-operators" title="null-operators" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
        <qti-response-declaration identifier="FLAGS" cardinality="multiple" base-type="identifier"/>
        <qti-outcome-declaration identifier="MATCH_NULL" cardinality="single" base-type="boolean"/>
        <qti-outcome-declaration identifier="EQUAL_NULL" cardinality="single" base-type="boolean"/>
        <qti-outcome-declaration identifier="SUM_NULL" cardinality="single" base-type="float"/>
        <qti-outcome-declaration identifier="PRODUCT_NULL" cardinality="single" base-type="float"/>
        <qti-outcome-declaration identifier="AND_NULL" cardinality="single" base-type="boolean"/>
        <qti-outcome-declaration identifier="OR_NULL" cardinality="single" base-type="boolean"/>
        <qti-outcome-declaration identifier="STRING_NULL" cardinality="single" base-type="boolean"/>
        <qti-outcome-declaration identifier="SUBSTRING_NULL" cardinality="single" base-type="boolean"/>
        <qti-outcome-declaration identifier="MEMBER_NULL" cardinality="single" base-type="boolean"/>
        <qti-outcome-declaration identifier="CONTAINS_NULL" cardinality="single" base-type="boolean"/>
        <qti-item-body>
          <qti-extended-text-interaction response-identifier="RESPONSE"/>
        </qti-item-body>
        <qti-response-processing>
          <qti-set-outcome-value identifier="MATCH_NULL">
            <qti-match>
              <qti-variable identifier="RESPONSE"/>
              <qti-base-value base-type="string">A</qti-base-value>
            </qti-match>
          </qti-set-outcome-value>
          <qti-set-outcome-value identifier="EQUAL_NULL">
            <qti-equal>
              <qti-variable identifier="RESPONSE"/>
              <qti-base-value base-type="string">A</qti-base-value>
            </qti-equal>
          </qti-set-outcome-value>
          <qti-set-outcome-value identifier="SUM_NULL">
            <qti-sum>
              <qti-variable identifier="RESPONSE"/>
              <qti-base-value base-type="float">1</qti-base-value>
            </qti-sum>
          </qti-set-outcome-value>
          <qti-set-outcome-value identifier="PRODUCT_NULL">
            <qti-product>
              <qti-variable identifier="RESPONSE"/>
              <qti-base-value base-type="float">2</qti-base-value>
            </qti-product>
          </qti-set-outcome-value>
          <qti-set-outcome-value identifier="AND_NULL">
            <qti-and>
              <qti-string-match>
                <qti-variable identifier="RESPONSE"/>
                <qti-base-value base-type="string">A</qti-base-value>
              </qti-string-match>
              <qti-base-value base-type="boolean">true</qti-base-value>
            </qti-and>
          </qti-set-outcome-value>
          <qti-set-outcome-value identifier="OR_NULL">
            <qti-or>
              <qti-string-match>
                <qti-variable identifier="RESPONSE"/>
                <qti-base-value base-type="string">A</qti-base-value>
              </qti-string-match>
              <qti-base-value base-type="boolean">false</qti-base-value>
            </qti-or>
          </qti-set-outcome-value>
          <qti-set-outcome-value identifier="STRING_NULL">
            <qti-string-match>
              <qti-variable identifier="RESPONSE"/>
              <qti-base-value base-type="string">A</qti-base-value>
            </qti-string-match>
          </qti-set-outcome-value>
          <qti-set-outcome-value identifier="SUBSTRING_NULL">
            <qti-substring>
              <qti-base-value base-type="string">A</qti-base-value>
              <qti-variable identifier="RESPONSE"/>
            </qti-substring>
          </qti-set-outcome-value>
          <qti-set-outcome-value identifier="MEMBER_NULL">
            <qti-member>
              <qti-base-value base-type="identifier">A</qti-base-value>
              <qti-variable identifier="FLAGS"/>
            </qti-member>
          </qti-set-outcome-value>
          <qti-set-outcome-value identifier="CONTAINS_NULL">
            <qti-contains>
              <qti-variable identifier="FLAGS"/>
              <qti-base-value base-type="identifier">A</qti-base-value>
            </qti-contains>
          </qti-set-outcome-value>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const score = createItemSession(result.document!).score();
    for (const identifier of [
      "MATCH_NULL",
      "EQUAL_NULL",
      "SUM_NULL",
      "PRODUCT_NULL",
      "AND_NULL",
      "OR_NULL",
      "STRING_NULL",
      "SUBSTRING_NULL",
      "MEMBER_NULL",
      "CONTAINS_NULL",
    ] as const) {
      expect(score.outcomes[identifier]).toBeNull();
    }
  });

  it("evaluates boolean response processing expressions", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="boolean-processing" title="boolean-processing" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
        <qti-response-declaration identifier="FLAGS" cardinality="multiple" base-type="identifier">
          <qti-default-value><qti-value>A</qti-value><qti-value>B</qti-value></qti-default-value>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-extended-text-interaction response-identifier="RESPONSE"/>
        </qti-item-body>
        <qti-response-processing>
          <qti-response-condition>
            <qti-response-if>
              <qti-and>
                <qti-string-match case-sensitive="false">
                  <qti-variable identifier="RESPONSE"/>
                  <qti-base-value base-type="string">washington</qti-base-value>
                </qti-string-match>
                <qti-member>
                  <qti-base-value base-type="identifier">A</qti-base-value>
                  <qti-variable identifier="FLAGS"/>
                </qti-member>
                <qti-not>
                  <qti-equal>
                    <qti-base-value base-type="integer">1</qti-base-value>
                    <qti-base-value base-type="integer">2</qti-base-value>
                  </qti-equal>
                </qti-not>
              </qti-and>
              <qti-set-outcome-value identifier="SCORE">
                <qti-base-value base-type="float">3</qti-base-value>
              </qti-set-outcome-value>
            </qti-response-if>
            <qti-response-else>
              <qti-set-outcome-value identifier="SCORE">
                <qti-base-value base-type="float">0</qti-base-value>
              </qti-set-outcome-value>
            </qti-response-else>
          </qti-response-condition>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!);
    session.respond("RESPONSE", "Washington");
    expect(session.score().outcomes.SCORE).toBe(3);
  });

  it("evaluates numeric division and comparison processing expressions", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="numeric-processing" title="numeric-processing" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="float"/>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-slider-interaction response-identifier="RESPONSE" lower-bound="0" upper-bound="10"/>
        </qti-item-body>
        <qti-response-processing>
          <qti-response-condition>
            <qti-response-if>
              <qti-and>
                <qti-gte>
                  <qti-variable identifier="RESPONSE"/>
                  <qti-base-value base-type="float">8</qti-base-value>
                </qti-gte>
                <qti-lt>
                  <qti-variable identifier="RESPONSE"/>
                  <qti-base-value base-type="float">10</qti-base-value>
                </qti-lt>
              </qti-and>
              <qti-set-outcome-value identifier="SCORE">
                <qti-divide>
                  <qti-variable identifier="RESPONSE"/>
                  <qti-base-value base-type="float">2</qti-base-value>
                </qti-divide>
              </qti-set-outcome-value>
            </qti-response-if>
            <qti-response-else>
              <qti-set-outcome-value identifier="SCORE">
                <qti-base-value base-type="float">0</qti-base-value>
              </qti-set-outcome-value>
            </qti-response-else>
          </qti-response-condition>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!);
    session.respond("RESPONSE", 8);
    expect(session.score().outcomes.SCORE).toBe(4);
    session.respond("RESPONSE", 10);
    expect(session.score().outcomes.SCORE).toBe(0);
  });

  it("evaluates duration comparisons and preserves null comparison results", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="duration-processing" title="duration-processing" time-dependent="false">
        <qti-response-declaration identifier="MISSING" cardinality="single" base-type="float"/>
        <qti-outcome-declaration identifier="FAST" cardinality="single" base-type="boolean"/>
        <qti-outcome-declaration identifier="LONG_ENOUGH" cardinality="single" base-type="boolean"/>
        <qti-outcome-declaration identifier="NULL_COMPARE" cardinality="single" base-type="boolean"/>
        <qti-outcome-declaration identifier="DIV_ZERO" cardinality="single" base-type="float"/>
        <qti-item-body/>
        <qti-response-processing>
          <qti-response-condition>
            <qti-response-if>
              <qti-base-value base-type="boolean">true</qti-base-value>
              <qti-set-outcome-value identifier="FAST">
                <qti-duration-lt>
                  <qti-base-value base-type="duration">PT9.5S</qti-base-value>
                  <qti-base-value base-type="duration">PT10S</qti-base-value>
                </qti-duration-lt>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="LONG_ENOUGH">
                <qti-duration-gte>
                  <qti-base-value base-type="duration">PT2M</qti-base-value>
                  <qti-base-value base-type="duration">PT90S</qti-base-value>
                </qti-duration-gte>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="NULL_COMPARE">
                <qti-gte>
                  <qti-variable identifier="MISSING"/>
                  <qti-base-value base-type="float">1</qti-base-value>
                </qti-gte>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="DIV_ZERO">
                <qti-divide>
                  <qti-base-value base-type="float">10</qti-base-value>
                  <qti-base-value base-type="float">0</qti-base-value>
                </qti-divide>
              </qti-set-outcome-value>
            </qti-response-if>
          </qti-response-condition>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const score = createItemSession(result.document!).score();
    expect(score.outcomes.FAST).toBe(true);
    expect(score.outcomes.LONG_ENOUGH).toBe(true);
    expect(score.outcomes.NULL_COMPARE).toBeNull();
    expect(score.outcomes.DIV_ZERO).toBeNull();
  });

  it("evaluates integer and rounding processing expressions", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="rounding-processing" title="rounding-processing" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-text-entry-interaction response-identifier="RESPONSE"/>
        </qti-item-body>
        <qti-response-processing>
          <qti-response-condition>
            <qti-response-if>
              <qti-base-value base-type="boolean">true</qti-base-value>
              <qti-set-outcome-value identifier="SCORE">
                <qti-sum>
                  <qti-integer-divide>
                    <qti-base-value base-type="integer">17</qti-base-value>
                    <qti-base-value base-type="integer">5</qti-base-value>
                  </qti-integer-divide>
                  <qti-integer-modulus>
                    <qti-base-value base-type="integer">17</qti-base-value>
                    <qti-base-value base-type="integer">5</qti-base-value>
                  </qti-integer-modulus>
                  <qti-round>
                    <qti-base-value base-type="float">6.5</qti-base-value>
                  </qti-round>
                  <qti-round>
                    <qti-base-value base-type="float">-6.5</qti-base-value>
                  </qti-round>
                  <qti-truncate>
                    <qti-base-value base-type="float">-6.8</qti-base-value>
                  </qti-truncate>
                  <qti-round-to rounding-mode="decimalPlaces" figures="2">
                    <qti-base-value base-type="float">3.14159</qti-base-value>
                  </qti-round-to>
                  <qti-round-to rounding-mode="significantFigures" figures="2">
                    <qti-base-value base-type="float">1234</qti-base-value>
                  </qti-round-to>
                </qti-sum>
              </qti-set-outcome-value>
            </qti-response-if>
          </qti-response-condition>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!);
    expect(session.score().outcomes.SCORE).toBe(1203.14);
  });

  it("evaluates container, index, substring, and conversion expressions", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="container-processing" title="container-processing" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
        <qti-outcome-declaration identifier="SECOND" cardinality="single" base-type="identifier"/>
        <qti-outcome-declaration identifier="CONTAINS" cardinality="single" base-type="boolean"/>
        <qti-outcome-declaration identifier="SUBSTRING" cardinality="single" base-type="boolean"/>
        <qti-outcome-declaration identifier="FLOAT_VALUE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-text-entry-interaction response-identifier="RESPONSE"/>
        </qti-item-body>
        <qti-response-processing>
          <qti-response-condition>
            <qti-response-if>
              <qti-base-value base-type="boolean">true</qti-base-value>
              <qti-set-outcome-value identifier="SECOND">
                <qti-index n="2">
                  <qti-ordered>
                    <qti-base-value base-type="identifier">A</qti-base-value>
                    <qti-base-value base-type="identifier">B</qti-base-value>
                    <qti-base-value base-type="identifier">C</qti-base-value>
                  </qti-ordered>
                </qti-index>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="CONTAINS">
                <qti-contains>
                  <qti-multiple>
                    <qti-base-value base-type="identifier">A</qti-base-value>
                    <qti-base-value base-type="identifier">B</qti-base-value>
                    <qti-base-value base-type="identifier">C</qti-base-value>
                  </qti-multiple>
                  <qti-multiple>
                    <qti-base-value base-type="identifier">C</qti-base-value>
                    <qti-base-value base-type="identifier">A</qti-base-value>
                  </qti-multiple>
                </qti-contains>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="SUBSTRING">
                <qti-substring case-sensitive="false">
                  <qti-base-value base-type="string">president</qti-base-value>
                  <qti-base-value base-type="string">President Washington</qti-base-value>
                </qti-substring>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="FLOAT_VALUE">
                <qti-integer-to-float>
                  <qti-base-value base-type="integer">7</qti-base-value>
                </qti-integer-to-float>
              </qti-set-outcome-value>
            </qti-response-if>
          </qti-response-condition>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!);
    const score = session.score();
    expect(score.outcomes.SECOND).toBe("B");
    expect(score.outcomes.CONTAINS).toBe(true);
    expect(score.outcomes.SUBSTRING).toBe(true);
    expect(score.outcomes.FLOAT_VALUE).toBe(7);
  });

  it("evaluates min, max, power, and seeded random float expressions", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="numeric-helper-processing" title="numeric-helper-processing" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
        <qti-outcome-declaration identifier="MIN_VALUE" cardinality="single" base-type="float"/>
        <qti-outcome-declaration identifier="MAX_VALUE" cardinality="single" base-type="float"/>
        <qti-outcome-declaration identifier="POWER_VALUE" cardinality="single" base-type="float"/>
        <qti-outcome-declaration identifier="RANDOM_VALUE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-text-entry-interaction response-identifier="RESPONSE"/>
        </qti-item-body>
        <qti-response-processing>
          <qti-response-condition>
            <qti-response-if>
              <qti-base-value base-type="boolean">true</qti-base-value>
              <qti-set-outcome-value identifier="MIN_VALUE">
                <qti-min>
                  <qti-base-value base-type="integer">8</qti-base-value>
                  <qti-multiple>
                    <qti-base-value base-type="integer">3</qti-base-value>
                    <qti-base-value base-type="integer">5</qti-base-value>
                  </qti-multiple>
                </qti-min>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="MAX_VALUE">
                <qti-max>
                  <qti-base-value base-type="float">2.5</qti-base-value>
                  <qti-base-value base-type="float">9.25</qti-base-value>
                </qti-max>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="POWER_VALUE">
                <qti-power>
                  <qti-base-value base-type="integer">2</qti-base-value>
                  <qti-base-value base-type="integer">5</qti-base-value>
                </qti-power>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="RANDOM_VALUE">
                <qti-random-float min="4.5" max="4.5"/>
              </qti-set-outcome-value>
            </qti-response-if>
          </qti-response-condition>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!, undefined, { randomSeed: "fixed" });
    const score = session.score();
    expect(score.outcomes.MIN_VALUE).toBe(3);
    expect(score.outcomes.MAX_VALUE).toBe(9.25);
    expect(score.outcomes.POWER_VALUE).toBe(32);
    expect(score.outcomes.RANDOM_VALUE).toBe(4.5);
  });

  it("evaluates pattern, delete, any-n, and container-size expressions", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="collection-helper-processing" title="collection-helper-processing" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
        <qti-outcome-declaration identifier="PATTERN_OK" cardinality="single" base-type="boolean"/>
        <qti-outcome-declaration identifier="ANY_OK" cardinality="single" base-type="boolean"/>
        <qti-outcome-declaration identifier="SIZE" cardinality="single" base-type="integer"/>
        <qti-outcome-declaration identifier="FIRST_REMAINING" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <qti-text-entry-interaction response-identifier="RESPONSE"/>
        </qti-item-body>
        <qti-response-processing>
          <qti-response-condition>
            <qti-response-if>
              <qti-base-value base-type="boolean">true</qti-base-value>
              <qti-set-outcome-value identifier="PATTERN_OK">
                <qti-pattern-match pattern="^Pres.*ton$">
                  <qti-base-value base-type="string">President Washington</qti-base-value>
                </qti-pattern-match>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="ANY_OK">
                <qti-any-n min="2" max="2">
                  <qti-base-value base-type="boolean">true</qti-base-value>
                  <qti-base-value base-type="boolean">false</qti-base-value>
                  <qti-base-value base-type="boolean">true</qti-base-value>
                </qti-any-n>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="SIZE">
                <qti-container-size>
                  <qti-delete>
                    <qti-base-value base-type="identifier">A</qti-base-value>
                    <qti-multiple>
                      <qti-base-value base-type="identifier">A</qti-base-value>
                      <qti-base-value base-type="identifier">B</qti-base-value>
                      <qti-base-value base-type="identifier">C</qti-base-value>
                    </qti-multiple>
                  </qti-delete>
                </qti-container-size>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="FIRST_REMAINING">
                <qti-index n="1">
                  <qti-delete>
                    <qti-base-value base-type="identifier">A</qti-base-value>
                    <qti-ordered>
                      <qti-base-value base-type="identifier">A</qti-base-value>
                      <qti-base-value base-type="identifier">B</qti-base-value>
                      <qti-base-value base-type="identifier">C</qti-base-value>
                    </qti-ordered>
                  </qti-delete>
                </qti-index>
              </qti-set-outcome-value>
            </qti-response-if>
          </qti-response-condition>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!);
    const score = session.score();
    expect(score.outcomes.PATTERN_OK).toBe(true);
    expect(score.outcomes.ANY_OK).toBe(true);
    expect(score.outcomes.SIZE).toBe(2);
    expect(score.outcomes.FIRST_REMAINING).toBe("B");
  });

  it("evaluates advanced math, repeat, and stats expressions", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="advanced-math-processing" title="advanced-math-processing" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
        <qti-outcome-declaration identifier="ROUNDED" cardinality="single" base-type="boolean"/>
        <qti-outcome-declaration identifier="GCD_VALUE" cardinality="single" base-type="integer"/>
        <qti-outcome-declaration identifier="LCM_VALUE" cardinality="single" base-type="integer"/>
        <qti-outcome-declaration identifier="TRIG_VALUE" cardinality="single" base-type="float"/>
        <qti-outcome-declaration identifier="MEAN_VALUE" cardinality="single" base-type="float"/>
        <qti-outcome-declaration identifier="REPEATED" cardinality="ordered" base-type="identifier"/>
        <qti-outcome-declaration identifier="REPEATED_SIZE" cardinality="single" base-type="integer"/>
        <qti-item-body>
          <qti-text-entry-interaction response-identifier="RESPONSE"/>
        </qti-item-body>
        <qti-response-processing>
          <qti-response-condition>
            <qti-response-if>
              <qti-base-value base-type="boolean">true</qti-base-value>
              <qti-set-outcome-value identifier="ROUNDED">
                <qti-equal-rounded rounding-mode="decimalPlaces" figures="2">
                  <qti-base-value base-type="float">3.141</qti-base-value>
                  <qti-base-value base-type="float">3.142</qti-base-value>
                </qti-equal-rounded>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="GCD_VALUE">
                <qti-gcd>
                  <qti-base-value base-type="integer">24</qti-base-value>
                  <qti-multiple>
                    <qti-base-value base-type="integer">18</qti-base-value>
                    <qti-base-value base-type="integer">30</qti-base-value>
                  </qti-multiple>
                </qti-gcd>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="LCM_VALUE">
                <qti-lcm>
                  <qti-base-value base-type="integer">4</qti-base-value>
                  <qti-base-value base-type="integer">6</qti-base-value>
                </qti-lcm>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="TRIG_VALUE">
                <qti-math-operator name="sin">
                  <qti-math-constant name="pi"/>
                </qti-math-operator>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="MEAN_VALUE">
                <qti-stats-operator name="mean">
                  <qti-multiple>
                    <qti-base-value base-type="integer">2</qti-base-value>
                    <qti-base-value base-type="integer">4</qti-base-value>
                    <qti-base-value base-type="integer">6</qti-base-value>
                  </qti-multiple>
                </qti-stats-operator>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="REPEATED">
                <qti-repeat number-repeats="2">
                  <qti-base-value base-type="identifier">A</qti-base-value>
                  <qti-ordered>
                    <qti-base-value base-type="identifier">B</qti-base-value>
                    <qti-base-value base-type="identifier">C</qti-base-value>
                  </qti-ordered>
                </qti-repeat>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="REPEATED_SIZE">
                <qti-container-size>
                  <qti-variable identifier="REPEATED"/>
                </qti-container-size>
              </qti-set-outcome-value>
            </qti-response-if>
          </qti-response-condition>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!);
    const score = session.score();
    expect(score.outcomes.ROUNDED).toBe(true);
    expect(score.outcomes.GCD_VALUE).toBe(6);
    expect(score.outcomes.LCM_VALUE).toBe(12);
    expect(score.outcomes.TRIG_VALUE).toBeCloseTo(0);
    expect(score.outcomes.MEAN_VALUE).toBe(4);
    expect(score.outcomes.REPEATED).toEqual(["A", "B", "C", "A", "B", "C"]);
    expect(score.outcomes.REPEATED_SIZE).toBe(6);
  });

  it("evaluates custom operators through a host extension hook", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="custom-operator-processing" title="custom-operator-processing" time-dependent="false">
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body/>
        <qti-response-processing>
          <qti-response-condition>
            <qti-response-if>
              <qti-base-value base-type="boolean">true</qti-base-value>
              <qti-set-outcome-value identifier="SCORE">
                <qti-sum>
                  <qti-custom-operator definition="double">
                    <qti-base-value base-type="integer">4</qti-base-value>
                  </qti-custom-operator>
                  <qti-base-value base-type="integer">1</qti-base-value>
                </qti-sum>
              </qti-set-outcome-value>
            </qti-response-if>
          </qti-response-condition>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!, undefined, {
      customOperators: {
        double: ({ definition, values }) => {
          expect(definition).toBe("double");
          return Number(values[0]) * 2;
        },
      },
    });
    expect(session.score().outcomes.SCORE).toBe(9);
  });
});
