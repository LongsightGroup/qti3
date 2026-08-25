import { describe, expect, it } from "vitest";
import { createItemSession, parseQtiXml } from "./index.js";

describe("template processing", () => {
  it("runs deterministic template processing before scoring", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="templated" title="templated" time-dependent="false">
        <qti-template-declaration identifier="A" cardinality="single" base-type="integer"/>
        <qti-template-declaration identifier="B" cardinality="single" base-type="integer"/>
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-template-processing>
          <qti-set-template-value identifier="A">
            <qti-random-integer min="2" max="2"/>
          </qti-set-template-value>
          <qti-set-template-value identifier="B">
            <qti-sum>
              <qti-variable identifier="A"/>
              <qti-base-value base-type="integer">3</qti-base-value>
            </qti-sum>
          </qti-set-template-value>
          <qti-set-correct-response identifier="RESPONSE">
            <qti-variable identifier="B"/>
          </qti-set-correct-response>
        </qti-template-processing>
        <qti-item-body>
          <qti-slider-interaction response-identifier="RESPONSE" lower-bound="0" upper-bound="10"/>
        </qti-item-body>
        <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!, undefined, { randomSeed: "fixed" });
    expect(session.serialize().templateValues).toEqual({ A: 2, B: 5 });
    expect(session.correctResponses()).toEqual({ RESPONSE: 5 });
    session.respond("RESPONSE", 5);
    expect(session.score().outcomes.SCORE).toBe(1);
  });

  it("restores generated template values before deriving correct responses", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="templated-restore" title="templated-restore" time-dependent="false">
        <qti-template-declaration identifier="A" cardinality="single" base-type="integer"/>
        <qti-template-declaration identifier="B" cardinality="single" base-type="integer"/>
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-template-processing>
          <qti-set-template-value identifier="A">
            <qti-random-integer min="1" max="100"/>
          </qti-set-template-value>
          <qti-set-template-value identifier="B">
            <qti-sum>
              <qti-variable identifier="A"/>
              <qti-base-value base-type="integer">3</qti-base-value>
            </qti-sum>
          </qti-set-template-value>
          <qti-set-correct-response identifier="RESPONSE">
            <qti-variable identifier="B"/>
          </qti-set-correct-response>
        </qti-template-processing>
        <qti-item-body>
          <qti-slider-interaction response-identifier="RESPONSE" lower-bound="0" upper-bound="200"/>
        </qti-item-body>
        <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const original = createItemSession(result.document!, undefined, { randomSeed: "first" });
    const generated = original.serialize().templateValues?.B;
    expect(typeof generated).toBe("number");

    original.respond("RESPONSE", generated ?? null);
    const saved = original.serialize();
    const restored = createItemSession(result.document!, saved, { randomSeed: "different" });

    expect(restored.serialize().templateValues).toEqual(saved.templateValues);
    expect(restored.serialize().responses.RESPONSE).toBe(generated);
    expect(restored.correctResponses()).toEqual({ RESPONSE: generated });
    expect(restored.score().outcomes.SCORE).toBe(1);
  });

  it("evaluates template conditions and templated default values", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="template-condition" title="template-condition" time-dependent="false">
        <qti-template-declaration identifier="A" cardinality="single" base-type="integer"/>
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-template-processing>
          <qti-template-condition>
            <qti-template-if>
              <qti-base-value base-type="boolean">false</qti-base-value>
              <qti-set-template-value identifier="A">
                <qti-base-value base-type="integer">1</qti-base-value>
              </qti-set-template-value>
            </qti-template-if>
            <qti-template-else-if>
              <qti-base-value base-type="boolean">true</qti-base-value>
              <qti-set-template-value identifier="A">
                <qti-base-value base-type="integer">7</qti-base-value>
              </qti-set-template-value>
            </qti-template-else-if>
            <qti-template-else>
              <qti-set-template-value identifier="A">
                <qti-base-value base-type="integer">9</qti-base-value>
              </qti-set-template-value>
            </qti-template-else>
          </qti-template-condition>
          <qti-set-default-value identifier="RESPONSE">
            <qti-variable identifier="A"/>
          </qti-set-default-value>
          <qti-set-default-value identifier="SCORE">
            <qti-base-value base-type="float">2.5</qti-base-value>
          </qti-set-default-value>
          <qti-set-correct-response identifier="RESPONSE">
            <qti-variable identifier="A"/>
          </qti-set-correct-response>
        </qti-template-processing>
        <qti-item-body>
          <qti-slider-interaction response-identifier="RESPONSE" lower-bound="0" upper-bound="10"/>
        </qti-item-body>
        <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!);
    expect(session.serialize().templateValues).toEqual({ A: 7 });
    expect(session.serialize().responses.RESPONSE).toBeUndefined();
    expect(session.serialize().outcomes.SCORE).toBe(2.5);
    session.setStatus("interacting");
    expect(session.score().outcomes.SCORE).toBe(1);
    session.respond("RESPONSE", 0);
    expect(session.score().outcomes.SCORE).toBe(0);
  });

  it("honors exit-template rules during template processing", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="exit-template" title="exit-template" time-dependent="false">
        <qti-template-declaration identifier="A" cardinality="single" base-type="integer">
          <qti-default-value><qti-value>0</qti-value></qti-default-value>
        </qti-template-declaration>
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
        <qti-item-body>
          <qti-slider-interaction response-identifier="RESPONSE" lower-bound="0" upper-bound="10"/>
        </qti-item-body>
        <qti-template-processing>
          <qti-set-template-value identifier="A">
            <qti-base-value base-type="integer">1</qti-base-value>
          </qti-set-template-value>
          <qti-exit-template/>
          <qti-set-template-value identifier="A">
            <qti-base-value base-type="integer">2</qti-base-value>
          </qti-set-template-value>
        </qti-template-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!);
    expect(session.serialize().templateValues).toEqual({ A: 1 });
  });

  it("restarts template processing until template constraints are satisfied", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="template-constraint" title="template-constraint" time-dependent="false">
        <qti-template-declaration identifier="A" cardinality="single" base-type="integer">
          <qti-default-value><qti-value>0</qti-value></qti-default-value>
        </qti-template-declaration>
        <qti-template-declaration identifier="B" cardinality="single" base-type="integer">
          <qti-default-value><qti-value>0</qti-value></qti-default-value>
        </qti-template-declaration>
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
        <qti-item-body>
          <qti-slider-interaction response-identifier="RESPONSE" lower-bound="0" upper-bound="10"/>
        </qti-item-body>
        <qti-template-processing>
          <qti-set-template-value identifier="A">
            <qti-random-integer min="1" max="3"/>
          </qti-set-template-value>
          <qti-set-template-value identifier="B">
            <qti-random-integer min="1" max="3"/>
          </qti-set-template-value>
          <qti-template-constraint>
            <qti-not>
              <qti-equal>
                <qti-variable identifier="A"/>
                <qti-variable identifier="B"/>
              </qti-equal>
            </qti-not>
          </qti-template-constraint>
        </qti-template-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!, undefined, { randomSeed: "constraint" });
    const values = session.serialize().templateValues!;
    expect(values.A).not.toBe(values.B);
  });

  it("does not retain generated correct responses from rejected template constraint passes", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="template-constraint-correct-reset" title="template-constraint-correct-reset" time-dependent="false">
        <qti-template-declaration identifier="A" cardinality="single" base-type="integer"/>
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-template-processing>
          <qti-set-template-value identifier="A">
            <qti-custom-operator definition="next-template-value"/>
          </qti-set-template-value>
          <qti-template-condition>
            <qti-template-if>
              <qti-equal>
                <qti-variable identifier="A"/>
                <qti-base-value base-type="integer">1</qti-base-value>
              </qti-equal>
              <qti-set-correct-response identifier="RESPONSE">
                <qti-variable identifier="A"/>
              </qti-set-correct-response>
            </qti-template-if>
          </qti-template-condition>
          <qti-template-constraint>
            <qti-equal>
              <qti-variable identifier="A"/>
              <qti-base-value base-type="integer">2</qti-base-value>
            </qti-equal>
          </qti-template-constraint>
        </qti-template-processing>
        <qti-item-body>
          <qti-slider-interaction response-identifier="RESPONSE" lower-bound="0" upper-bound="10"/>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    let nextValue = 0;
    const session = createItemSession(result.document!, undefined, {
      customOperators: {
        "next-template-value": () => {
          nextValue += 1;
          return nextValue;
        },
      },
    });

    expect(session.serialize().templateValues).toEqual({ A: 2 });
    expect(session.correctResponses()).toEqual({ RESPONSE: null });
  });

  it("does not retain generated defaults from rejected template constraint passes", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="template-constraint-default-reset" title="template-constraint-default-reset" time-dependent="false">
        <qti-template-declaration identifier="A" cardinality="single" base-type="integer"/>
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-outcome-declaration identifier="TRACE" cardinality="single" base-type="identifier"/>
        <qti-template-processing>
          <qti-set-template-value identifier="A">
            <qti-custom-operator definition="next-template-value"/>
          </qti-set-template-value>
          <qti-template-condition>
            <qti-template-if>
              <qti-equal>
                <qti-variable identifier="A"/>
                <qti-base-value base-type="integer">1</qti-base-value>
              </qti-equal>
              <qti-set-default-value identifier="RESPONSE">
                <qti-variable identifier="A"/>
              </qti-set-default-value>
              <qti-set-default-value identifier="TRACE">
                <qti-base-value base-type="identifier">rejected</qti-base-value>
              </qti-set-default-value>
            </qti-template-if>
          </qti-template-condition>
          <qti-template-constraint>
            <qti-equal>
              <qti-variable identifier="A"/>
              <qti-base-value base-type="integer">2</qti-base-value>
            </qti-equal>
          </qti-template-constraint>
        </qti-template-processing>
        <qti-item-body>
          <qti-slider-interaction response-identifier="RESPONSE" lower-bound="0" upper-bound="10"/>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    let nextValue = 0;
    const session = createItemSession(result.document!, undefined, {
      customOperators: {
        "next-template-value": () => {
          nextValue += 1;
          return nextValue;
        },
      },
    });

    expect(session.serialize().templateValues).toEqual({ A: 2 });
    expect(session.serialize().responses).toEqual({});
    expect(session.serialize().outcomes).toMatchObject({
      SCORE: null,
      TRACE: null,
      completionStatus: "not_attempted",
    });
  });

  it("validates random integer processing attributes", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-random-integer" title="bad-random-integer" time-dependent="false">
        <qti-template-declaration identifier="A" cardinality="single" base-type="integer"/>
        <qti-template-declaration identifier="B" cardinality="single" base-type="integer"/>
        <qti-template-declaration identifier="C" cardinality="single" base-type="integer"/>
        <qti-template-declaration identifier="D" cardinality="single" base-type="integer"/>
        <qti-item-body/>
        <qti-template-processing>
          <qti-set-template-value identifier="A">
            <qti-random-integer/>
          </qti-set-template-value>
          <qti-set-template-value identifier="B">
            <qti-random-integer min="ten" max="20"/>
          </qti-set-template-value>
          <qti-set-template-value identifier="C">
            <qti-random-integer min="10" max="1"/>
          </qti-set-template-value>
          <qti-set-template-value identifier="D">
            <qti-random-integer min="1" max="10" step="0"/>
          </qti-set-template-value>
        </qti-template-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "processing.randomInteger.attribute" }),
        expect.objectContaining({ code: "processing.randomInteger.integer" }),
        expect.objectContaining({ code: "processing.randomInteger.bounds" }),
        expect.objectContaining({ code: "processing.randomInteger.step" }),
      ]),
    );
  });
});
