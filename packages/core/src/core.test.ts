import { describe, expect, it } from "vitest";
import { createItemSession, interactionSupport, parseQtiXml } from "./index.js";

describe("@qti3/core", () => {
  it("tracks every target QTI 3 interaction type", () => {
    expect(interactionSupport.map((item) => item.qtiName)).toMatchInlineSnapshot(`
      [
        "qti-associate-interaction",
        "qti-choice-interaction",
        "qti-custom-interaction",
        "qti-drawing-interaction",
        "qti-end-attempt-interaction",
        "qti-extended-text-interaction",
        "qti-gap-match-interaction",
        "qti-graphic-associate-interaction",
        "qti-graphic-gap-match-interaction",
        "qti-graphic-order-interaction",
        "qti-hotspot-interaction",
        "qti-hottext-interaction",
        "qti-inline-choice-interaction",
        "qti-match-interaction",
        "qti-media-interaction",
        "qti-order-interaction",
        "qti-position-object-interaction",
        "qti-portable-custom-interaction",
        "qti-select-point-interaction",
        "qti-slider-interaction",
        "qti-text-entry-interaction",
        "qti-upload-interaction",
      ]
    `);
  });

  it("parses and scores a choice item", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="choice">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
          <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
          <qti-default-value><qti-value>0</qti-value></qti-default-value>
        </qti-outcome-declaration>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">Washington</qti-simple-choice>
            <qti-simple-choice identifier="B">Adams</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.interactions[0]?.type).toBe("choice");

    const session = createItemSession(result.document!);
    session.respond("RESPONSE", "A");
    expect(session.score().outcomes.SCORE).toBe(1);
    expect(session.serialize().schema).toBe("qti3.attempt-state.v1");
  });

  it("scores an inline response condition with map-response", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="mapped">
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
});
