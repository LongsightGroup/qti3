import { describe, expect, it } from "vitest";
import {
  createItemSession,
  deprecatedInteractionSupport,
  interactionSupport,
  parseQtiXml,
  validateAssessmentItem,
  visibleModalFeedback,
} from "./index.js";

describe("@qti3/core", () => {
  it("tracks every target QTI 3 interaction type", () => {
    expect(interactionSupport.map((item) => item.qtiName)).toMatchInlineSnapshot(`
      [
        "qti-associate-interaction",
        "qti-choice-interaction",
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

  it("tracks deprecated interactions outside the runtime target set", () => {
    expect(deprecatedInteractionSupport).toMatchObject([
      {
        qtiName: "qti-custom-interaction",
        support: "deprecated",
      },
    ]);

    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="deprecated-custom">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
        <qti-item-body>
          <qti-custom-interaction response-identifier="RESPONSE"/>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "interaction.deprecated", severity: "warning" }),
    );
  });

  it("diagnoses unknown QTI interaction elements", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="unsupported-interaction">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
        <qti-item-body>
          <qti-unsupported-interaction response-identifier="RESPONSE"/>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.interactions[0]).toMatchObject({
      type: "custom",
      qtiName: "qti-unsupported-interaction",
      responseIdentifier: "RESPONSE",
    });
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "interaction.unsupported",
        severity: "warning",
        path: "/qti-assessment-item/qti-item-body[1]/qti-unsupported-interaction[1]",
      }),
    );
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
          <qti-prompt>Who was the first president?</qti-prompt>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">Washington</qti-simple-choice>
            <qti-simple-choice identifier="B">Adams</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.prompt).toBe("Who was the first president?");
    expect(result.document?.item.interactions[0]?.type).toBe("choice");
    expect(result.document?.item.interactions[0]?.prompt).toBeUndefined();

    const session = createItemSession(result.document!);
    expect(session.serialize().status).toBe("initialized");
    session.respond("RESPONSE", "A");
    expect(session.serialize().status).toBe("interacting");
    expect(session.score().outcomes.SCORE).toBe(1);
    expect(session.serialize().schema).toBe("qti3.attempt-state.v1");
    session.setStatus("suspended");
    expect(session.serialize().status).toBe("suspended");

    const restored = createItemSession(result.document!, session.serialize());
    expect(restored.serialize().status).toBe("suspended");
  });

  it("validates response declaration references and response shape", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="invalid">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <qti-order-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
          </qti-order-interaction>
          <qti-choice-interaction response-identifier="MISSING">
            <qti-simple-choice identifier="B">B</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "interaction.responseIdentifier.reference" }),
        expect.objectContaining({ code: "interaction.cardinality" }),
      ]),
    );
  });

  it("attaches source locations and paths to parsed model nodes and validation diagnostics", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="located">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="MISSING">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
            <qti-simple-choice identifier="A">Duplicate</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.document?.item.source).toMatchObject({
      line: 2,
      column: 7,
      path: "/qti-assessment-item",
    });
    expect(result.document?.item.interactions[0]?.source).toMatchObject({
      line: 5,
      column: 11,
      path: "/qti-assessment-item/qti-item-body[1]/qti-choice-interaction[1]",
    });
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "interaction.responseIdentifier.reference",
          path: "/qti-assessment-item/qti-item-body[1]/qti-choice-interaction[1]",
          source: expect.objectContaining({ line: 5, column: 11 }),
        }),
        expect.objectContaining({
          code: "choice.identifier.duplicate",
          path: "/qti-assessment-item/qti-item-body[1]/qti-choice-interaction[1]/qti-simple-choice[2]",
          source: expect.objectContaining({ line: 7, column: 13 }),
        }),
      ]),
    );
  });

  it("validates direct child contracts for supported interactions", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-child">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-slider-interaction response-identifier="RESPONSE" lower-bound="0" upper-bound="10">
            <qti-simple-choice identifier="A">Not allowed here</qti-simple-choice>
          </qti-slider-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "interaction.child.unsupported",
        message: "qti-slider-interaction does not allow qti-simple-choice as a direct child.",
        path: "/qti-assessment-item/qti-item-body[1]/qti-slider-interaction[1]/qti-simple-choice[1]",
        source: expect.objectContaining({ line: 6, column: 13 }),
      }),
    );
  });

  it("does not mask missing or unsupported declaration attributes with parser defaults", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0">
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

  it("does not mask missing choice identifiers with parser defaults", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="missing-choice-id">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice>A</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.document?.item.interactions[0]?.choices[0]).toMatchObject({
      identifier: "",
      text: "A",
    });
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "identifier.required",
        message: "qti-simple-choice requires a non-empty identifier.",
        path: "/qti-assessment-item/qti-item-body[1]/qti-choice-interaction[1]/qti-simple-choice[1]",
      }),
    );
  });

  it("exposes validation independent of XML parsing", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="choice">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(validateAssessmentItem(result.document!).ok).toBe(true);
  });

  it("validates declaration default and correct response values against base types", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-declaration-values">
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
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-correct-response-refs">
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

  it("uses mapping default-value for unmapped responses", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="mapped-default">
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

  it("sums built-in map-response template scores across response declarations", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="mapped-template-sum">
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

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!);
    session.respond("RESPONSE1", "A");
    session.respond("RESPONSE2", "B");
    expect(session.score().outcomes.SCORE).toBe(3);
    expect(session.score().outcomes.SCORE).toBe(3);
  });

  it("sums built-in match-correct template scores across response declarations", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="match-template-sum">
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

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!);
    session.respond("RESPONSE1", "A");
    session.respond("RESPONSE2", "B");
    expect(session.score().outcomes.SCORE).toBe(2);
    session.respond("RESPONSE2", "Z");
    expect(session.score().outcomes.SCORE).toBe(1);
  });

  it("applies mapping lower and upper bounds to mapped scores", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="mapped-bounds">
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
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-mapping">
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
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-mapping-refs">
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

  it("validates processing rule targets and variable references", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-processing-refs">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-template-declaration identifier="TEMPLATE" cardinality="single" base-type="integer"/>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
        <qti-template-processing>
          <qti-set-template-value identifier="MISSING_TEMPLATE">
            <qti-variable identifier="MISSING_VARIABLE"/>
          </qti-set-template-value>
          <qti-set-correct-response identifier="MISSING_RESPONSE">
            <qti-base-value base-type="identifier">A</qti-base-value>
          </qti-set-correct-response>
        </qti-template-processing>
        <qti-response-processing>
          <qti-response-condition>
            <qti-response-if>
              <qti-is-null>
                <qti-variable identifier="MISSING_VARIABLE"/>
              </qti-is-null>
              <qti-set-outcome-value identifier="MISSING_OUTCOME">
                <qti-map-response identifier="MISSING_RESPONSE"/>
              </qti-set-outcome-value>
            </qti-response-if>
          </qti-response-condition>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "processing.templateTarget.reference" }),
        expect.objectContaining({ code: "processing.correctResponse.reference" }),
        expect.objectContaining({ code: "processing.outcomeTarget.reference" }),
        expect.objectContaining({ code: "processing.variable.reference" }),
        expect.objectContaining({ code: "processing.response.reference" }),
      ]),
    );
  });

  it("validates qti-match variable and correct identifiers", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-match-correct">
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

  it("does not mask missing processing identifiers with parser defaults", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="missing-processing-ids">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-template-declaration identifier="TEMPLATE" cardinality="single" base-type="integer"/>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
        <qti-template-processing>
          <qti-set-template-value>
            <qti-base-value base-type="integer">1</qti-base-value>
          </qti-set-template-value>
          <qti-set-correct-response>
            <qti-base-value base-type="identifier">A</qti-base-value>
          </qti-set-correct-response>
        </qti-template-processing>
        <qti-response-processing>
          <qti-response-condition>
            <qti-response-if>
              <qti-match>
                <qti-variable/>
                <qti-correct/>
              </qti-match>
              <qti-set-outcome-value>
                <qti-map-response/>
              </qti-set-outcome-value>
            </qti-response-if>
            <qti-response-else-if>
              <qti-variable/>
            </qti-response-else-if>
          </qti-response-condition>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    const templateRule = result.document?.item.templateProcessing?.rules[0];
    expect(templateRule?.type).toBe("setTemplateValue");
    expect(templateRule?.type === "setTemplateValue" ? templateRule.identifier : undefined).toBe(
      "",
    );
    const responseRule = result.document?.item.responseProcessing?.conditions[0]?.thenRules[0];
    expect(responseRule?.type).toBe("setOutcomeValue");
    expect(responseRule?.type === "setOutcomeValue" ? responseRule.identifier : undefined).toBe("");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "processing.templateTarget" }),
        expect.objectContaining({ code: "processing.correctResponse" }),
        expect.objectContaining({ code: "processing.outcomeTarget" }),
        expect.objectContaining({ code: "processing.variable" }),
        expect.objectContaining({ code: "processing.response" }),
        expect.objectContaining({ code: "processing.correct" }),
      ]),
    );
  });

  it("parses, validates, and resolves modal feedback", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="feedback">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
          <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
            <qti-simple-choice identifier="B">B</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
        <qti-response-processing>
          <qti-response-condition>
            <qti-response-if>
              <qti-match>
                <qti-variable identifier="RESPONSE"/>
                <qti-correct identifier="RESPONSE"/>
              </qti-match>
              <qti-set-outcome-value identifier="SCORE">
                <qti-base-value base-type="float">1</qti-base-value>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="FEEDBACK">
                <qti-base-value base-type="identifier">correct</qti-base-value>
              </qti-set-outcome-value>
            </qti-response-if>
            <qti-response-else>
              <qti-set-outcome-value identifier="SCORE">
                <qti-base-value base-type="float">0</qti-base-value>
              </qti-set-outcome-value>
              <qti-set-outcome-value identifier="FEEDBACK">
                <qti-base-value base-type="identifier">incorrect</qti-base-value>
              </qti-set-outcome-value>
            </qti-response-else>
          </qti-response-condition>
        </qti-response-processing>
        <qti-modal-feedback outcome-identifier="FEEDBACK" identifier="correct" show-hide="show">
          Correct feedback.
        </qti-modal-feedback>
        <qti-modal-feedback outcome-identifier="FEEDBACK" identifier="incorrect" show-hide="show">
          Incorrect feedback.
        </qti-modal-feedback>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.modalFeedback).toHaveLength(2);

    const session = createItemSession(result.document!);
    session.respond("RESPONSE", "A");
    const scored = session.score();
    expect(scored.outcomes.FEEDBACK).toBe("correct");
    expect(visibleModalFeedback(result.document!.item, scored.outcomes)).toMatchObject([
      { identifier: "correct", text: "Correct feedback." },
    ]);
  });

  it("evaluates response else-if branches before the final else", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="else-if">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
          <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
            <qti-simple-choice identifier="B">B</qti-simple-choice>
            <qti-simple-choice identifier="C">C</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
        <qti-response-processing>
          <qti-response-condition>
            <qti-response-if>
              <qti-match>
                <qti-variable identifier="RESPONSE"/>
                <qti-correct identifier="RESPONSE"/>
              </qti-match>
              <qti-set-outcome-value identifier="SCORE">
                <qti-base-value base-type="float">1</qti-base-value>
              </qti-set-outcome-value>
            </qti-response-if>
            <qti-response-else-if>
              <qti-equal>
                <qti-variable identifier="RESPONSE"/>
                <qti-base-value base-type="identifier">B</qti-base-value>
              </qti-equal>
              <qti-set-outcome-value identifier="SCORE">
                <qti-base-value base-type="float">0.5</qti-base-value>
              </qti-set-outcome-value>
            </qti-response-else-if>
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
    expect(result.document?.item.responseProcessing?.conditions[0]?.elseIfs).toHaveLength(1);

    const partial = createItemSession(result.document!);
    partial.respond("RESPONSE", "B");
    expect(partial.score().outcomes.SCORE).toBe(0.5);

    const incorrect = createItemSession(result.document!);
    incorrect.respond("RESPONSE", "C");
    expect(incorrect.score().outcomes.SCORE).toBe(0);
  });

  it("resolves outcome variables during cumulative response processing", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="cumulative">
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
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
          <qti-default-value><qti-value>0</qti-value></qti-default-value>
        </qti-outcome-declaration>
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
        <qti-response-processing>
          <qti-response-condition>
            <qti-response-if>
              <qti-not><qti-is-null><qti-variable identifier="RESPONSE1"/></qti-is-null></qti-not>
              <qti-set-outcome-value identifier="SCORE">
                <qti-sum>
                  <qti-variable identifier="SCORE"/>
                  <qti-map-response identifier="RESPONSE1"/>
                </qti-sum>
              </qti-set-outcome-value>
            </qti-response-if>
          </qti-response-condition>
          <qti-response-condition>
            <qti-response-if>
              <qti-not><qti-is-null><qti-variable identifier="RESPONSE2"/></qti-is-null></qti-not>
              <qti-set-outcome-value identifier="SCORE">
                <qti-sum>
                  <qti-variable identifier="SCORE"/>
                  <qti-map-response identifier="RESPONSE2"/>
                </qti-sum>
              </qti-set-outcome-value>
            </qti-response-if>
          </qti-response-condition>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!);
    session.respond("RESPONSE1", "A");
    session.respond("RESPONSE2", "B");
    expect(session.score().outcomes.SCORE).toBe(3);
    expect(session.score().outcomes.SCORE).toBe(3);
  });

  it("validates modal feedback outcome references", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="feedback-invalid">
        <qti-item-body>
          <p>No interaction.</p>
        </qti-item-body>
        <qti-modal-feedback outcome-identifier="MISSING" identifier="shown">Shown</qti-modal-feedback>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "feedback.outcomeIdentifier.reference" }),
    );
  });

  it("scores map-response-point with circular area mapping", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="point">
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
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="explicit-declaration-expressions">
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
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-area-mapping">
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
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="match">
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

  it("preserves object asset metadata on media-backed interactions", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="media">
        <qti-item-body>
          <qti-media-interaction autostart="false">
            <object data="clips/washington.mp3" type="audio/mpeg" width="320" height="32">
              Washington audio
            </object>
          </qti-media-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.interactions[0]?.object).toMatchObject({
      data: "clips/washington.mp3",
      type: "audio/mpeg",
      width: "320",
      height: "32",
      text: "Washington audio",
    });
  });

  it("preserves hotspot geometry on choice metadata", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="hotspot">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <qti-hotspot-interaction response-identifier="RESPONSE">
            <object data="image.png" type="image/png"/>
            <qti-hotspot-choice identifier="A" shape="rect" coords="10,20,60,80"/>
          </qti-hotspot-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.interactions[0]?.choices[0]).toMatchObject({
      identifier: "A",
      role: "hotspot",
      attributes: { shape: "rect", coords: "10,20,60,80" },
    });
  });

  it("validates hotspot geometry attributes", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-hotspot-geometry">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <qti-hotspot-interaction response-identifier="RESPONSE">
            <object data="image.png" type="image/png"/>
            <qti-hotspot-choice identifier="A" coords="0,0,nope,50"/>
            <qti-hotspot-choice identifier="B" shape="triangle"/>
            <qti-hotspot-choice identifier="D" shape="circle" coords="0,0"/>
            <qti-associable-hotspot identifier="C" shape="rect" coords="0,0,50,50"/>
          </qti-hotspot-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "choice.shape.required" }),
        expect.objectContaining({ code: "choice.shape" }),
        expect.objectContaining({ code: "choice.coords.required" }),
        expect.objectContaining({ code: "choice.coords" }),
        expect.objectContaining({ code: "choice.coords.shape" }),
        expect.objectContaining({ code: "choice.matchMax.required" }),
      ]),
    );
  });

  it("preserves portable custom interaction launch metadata", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="pci">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
        <qti-item-body>
          <qti-portable-custom-interaction
            response-identifier="RESPONSE"
            custom-interaction-type-identifier="urn:qti3:fixture:portable-custom"
            module="fixture-portable-custom"
          />
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.interactions[0]?.attributes).toMatchObject({
      "custom-interaction-type-identifier": "urn:qti3:fixture:portable-custom",
      module: "fixture-portable-custom",
    });
  });

  it("validates required interaction attributes and object assets", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="required-interaction-attrs">
        <qti-response-declaration identifier="POINT" cardinality="single" base-type="point"/>
        <qti-response-declaration identifier="SLIDER" cardinality="single" base-type="float"/>
        <qti-response-declaration identifier="PCI" cardinality="single" base-type="string"/>
        <qti-item-body>
          <qti-select-point-interaction response-identifier="POINT"/>
          <qti-slider-interaction response-identifier="SLIDER" lower-bound="10" upper-bound="5" step="0"/>
          <qti-portable-custom-interaction response-identifier="PCI"/>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "interaction.object.required" }),
        expect.objectContaining({ code: "interaction.slider.bounds" }),
        expect.objectContaining({ code: "interaction.numericAttribute" }),
        expect.objectContaining({ code: "interaction.portableCustom.typeIdentifier" }),
        expect.objectContaining({ code: "interaction.portableCustom.module" }),
      ]),
    );
  });

  it("validates interaction and choice limit attributes", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="interaction-limits">
        <qti-response-declaration identifier="CHOICE" cardinality="multiple" base-type="identifier"/>
        <qti-response-declaration identifier="ASSOCIATE" cardinality="multiple" base-type="pair"/>
        <qti-response-declaration identifier="GAP" cardinality="multiple" base-type="directedPair"/>
        <qti-item-body>
          <qti-choice-interaction response-identifier="CHOICE" min-choices="3" max-choices="2">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
            <qti-simple-choice identifier="B">B</qti-simple-choice>
          </qti-choice-interaction>
          <qti-associate-interaction response-identifier="ASSOCIATE" min-associations="-1" max-associations="many">
            <qti-simple-match-set>
              <qti-simple-associable-choice identifier="C">C</qti-simple-associable-choice>
              <qti-simple-associable-choice identifier="E" match-min="2" match-max="1">E</qti-simple-associable-choice>
            </qti-simple-match-set>
          </qti-associate-interaction>
          <qti-gap-match-interaction response-identifier="GAP">
            <qti-gap-text identifier="D" match-max="none">D</qti-gap-text>
            <p><qti-gap identifier="G1"/></p>
          </qti-gap-match-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "interaction.minMax" }),
        expect.objectContaining({ code: "interaction.integerAttribute" }),
        expect.objectContaining({ code: "choice.matchMax.required" }),
        expect.objectContaining({ code: "choice.integerAttribute" }),
        expect.objectContaining({ code: "choice.minMax" }),
      ]),
    );
  });

  it("keeps ordered cardinality order-sensitive", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="order">
        <qti-response-declaration identifier="RESPONSE" cardinality="ordered" base-type="identifier">
          <qti-correct-response><qti-value>A</qti-value><qti-value>B</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <qti-order-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
            <qti-simple-choice identifier="B">B</qti-simple-choice>
          </qti-order-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    const session = createItemSession(result.document!);
    session.respond("RESPONSE", ["B", "A"]);
    expect(session.score().outcomes.SCORE).toBe(0);
    session.respond("RESPONSE", ["A", "B"]);
    expect(session.score().outcomes.SCORE).toBe(1);
  });

  it("runs deterministic template processing before scoring", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="templated">
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
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!, undefined, { randomSeed: "fixed" });
    expect(session.serialize().templateValues).toEqual({ A: 2, B: 5 });
    expect(session.correctResponses()).toEqual({ RESPONSE: 5 });
    session.respond("RESPONSE", 5);
    expect(session.score().outcomes.SCORE).toBe(1);
  });

  it("evaluates template conditions and templated default values", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="template-condition">
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
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!);
    expect(session.serialize().templateValues).toEqual({ A: 7 });
    expect(session.serialize().responses.RESPONSE).toBe(7);
    expect(session.serialize().outcomes.SCORE).toBe(2.5);
    expect(session.score().outcomes.SCORE).toBe(1);
    session.respond("RESPONSE", 0);
    expect(session.score().outcomes.SCORE).toBe(0);
  });

  it("honors exit-template rules during template processing", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="exit-template">
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
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="template-constraint">
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

  it("validates random integer processing attributes", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-random-integer">
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

  it("validates base value processing content", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-base-values">
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

  it("evaluates boolean response processing expressions", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="boolean-processing">
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

  it("honors response-processing fragments and exit-response rules", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="exit-response">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
          <qti-default-value><qti-value>0</qti-value></qti-default-value>
        </qti-outcome-declaration>
        <qti-outcome-declaration identifier="TRACE" cardinality="single" base-type="integer">
          <qti-default-value><qti-value>0</qti-value></qti-default-value>
        </qti-outcome-declaration>
        <qti-item-body>
          <qti-text-entry-interaction response-identifier="RESPONSE"/>
        </qti-item-body>
        <qti-response-processing>
          <qti-response-processing-fragment>
            <qti-response-condition>
              <qti-response-if>
                <qti-base-value base-type="boolean">true</qti-base-value>
                <qti-response-processing-fragment>
                  <qti-set-outcome-value identifier="SCORE">
                    <qti-base-value base-type="float">1</qti-base-value>
                  </qti-set-outcome-value>
                  <qti-exit-response/>
                  <qti-set-outcome-value identifier="TRACE">
                    <qti-base-value base-type="integer">99</qti-base-value>
                  </qti-set-outcome-value>
                </qti-response-processing-fragment>
              </qti-response-if>
            </qti-response-condition>
          </qti-response-processing-fragment>
          <qti-response-condition>
            <qti-response-if>
              <qti-base-value base-type="boolean">true</qti-base-value>
              <qti-set-outcome-value identifier="SCORE">
                <qti-base-value base-type="float">2</qti-base-value>
              </qti-set-outcome-value>
            </qti-response-if>
          </qti-response-condition>
        </qti-response-processing>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const session = createItemSession(result.document!);
    const score = session.score();
    expect(score.outcomes.SCORE).toBe(1);
    expect(score.outcomes.TRACE).toBe("0");
  });

  it("looks up outcome values from match and interpolation tables", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="lookup-outcome">
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

  it("evaluates numeric division and comparison processing expressions", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="numeric-processing">
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

  it("evaluates integer and rounding processing expressions", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="rounding-processing">
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
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="container-processing">
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
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="numeric-helper-processing">
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
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="collection-helper-processing">
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
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="advanced-math-processing">
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

  it("evaluates inside point-shape processing expressions", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="inside-processing">
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
});
