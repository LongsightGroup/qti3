import { describe, expect, it } from "vitest";
import { parseQtiXml } from "./parser.js";
import { validateAssessmentItem } from "./validation.js";

describe("assessment item validation", () => {
  it("validates authored child order through parsing and standalone validation", () => {
    const parsed =
      parseQtiXml(`<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="order" title="Order" time-dependent="false">
  <qti-item-body><p>Answer.</p></qti-item-body>
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
</qti-assessment-item>`);
    const expected = {
      code: "assessmentItem.child.order",
      severity: "error",
      path: "/qti-assessment-item/qti-response-declaration[1]",
      source: expect.objectContaining({ line: 3, column: 3 }),
    };
    expect(parsed.ok).toBe(false);
    expect(parsed.diagnostics).toContainEqual(expect.objectContaining(expected));
    if (!parsed.document) throw new Error("Expected parsed item with structural diagnostics");

    const restored = structuredClone(parsed.document);
    restored.diagnostics = [];
    const validated = validateAssessmentItem(restored);
    expect(validated.ok).toBe(false);
    expect(validated.diagnostics).toContainEqual(expect.objectContaining(expected));
  });

  it("accepts the QTI 3.0.1 child sequence and repeated declarations", () => {
    const parsed =
      parseQtiXml(`<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="sequence" title="Sequence" time-dependent="false">
  <qti-context-declaration identifier="QTI_CONTEXT" cardinality="record"/>
  <qti-response-declaration identifier="R1" cardinality="single" base-type="string"/>
  <qti-response-declaration identifier="R2" cardinality="single" base-type="string"/>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier"/>
  <qti-template-declaration identifier="T" cardinality="single" base-type="integer"/>
  <qti-template-processing><qti-set-template-value identifier="T"><qti-base-value base-type="integer">1</qti-base-value></qti-set-template-value></qti-template-processing>
  <qti-assessment-stimulus-ref identifier="STIMULUS" href="stimulus.xml"/>
  <qti-companion-materials-info/>
  <qti-stylesheet href="item.css" type="text/css"/>
  <qti-item-body><p>Sequence.</p></qti-item-body>
  <qti-catalog-info><qti-catalog id="glossary"><qti-card support="glossary-on-screen"><qti-html-content><p>A definition.</p></qti-html-content></qti-card></qti-catalog></qti-catalog-info>
  <qti-response-processing><qti-set-outcome-value identifier="SCORE"><qti-base-value base-type="float">1</qti-base-value></qti-set-outcome-value></qti-response-processing>
  <qti-modal-feedback identifier="correct" outcome-identifier="FEEDBACK" show-hide="show"><p>Correct.</p></qti-modal-feedback>
</qti-assessment-item>`);
    expect(parsed.ok).toBe(true);
    if (!parsed.document) throw new Error("Expected parsed item");
    expect(validateAssessmentItem(parsed.document).ok).toBe(true);
  });

  it.each(["qti-time-limits", "qti-unknown", "div"])(
    "rejects %s as an assessment-item direct child",
    (qtiName) => {
      const parsed =
        parseQtiXml(`<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="child" title="Child" time-dependent="false">
  <${qtiName}/>
  <qti-item-body/>
</qti-assessment-item>`);
      expect(parsed.ok).toBe(false);
      expect(parsed.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "assessmentItem.child.unsupported",
          severity: "error",
          path: `/qti-assessment-item/${qtiName}[1]`,
          source: expect.objectContaining({ line: 2, column: 3 }),
        }),
      );
    },
  );

  it("validates response declaration references and response shape", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="invalid" title="invalid" time-dependent="false">
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
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="located" title="located" time-dependent="false">
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
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-child" title="bad-child" time-dependent="false">
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

  it("requires the QTI ASI namespace and item body for assessment items", () => {
    const wrongNamespace = parseQtiXml(`
      <qti-assessment-item xmlns="https://example.invalid/not-qti" identifier="wrong-namespace" title="wrong-namespace" time-dependent="false">
        <qti-item-body/>
      </qti-assessment-item>
    `);

    expect(wrongNamespace.ok).toBe(false);
    expect(wrongNamespace.document).toBeUndefined();
    expect(wrongNamespace.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "qti.root",
        message: expect.stringContaining("Expected qti-assessment-item in namespace"),
      }),
    );

    const missingBody = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="missing-body" title="missing-body" time-dependent="false"/>
    `);

    expect(missingBody.ok).toBe(false);
    expect(missingBody.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "itemBody.required",
        message: "qti-assessment-item requires a qti-item-body.",
      }),
    );
  });

  it("rejects QTI-shaped descendants from a foreign namespace", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" xmlns:foreign="https://example.invalid/not-qti" identifier="foreign-descendant" title="foreign-descendant" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <foreign:qti-choice-interaction response-identifier="RESPONSE">
            <foreign:qti-simple-choice identifier="A">A</foreign:qti-simple-choice>
          </foreign:qti-choice-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.document).toBeUndefined();
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "qti.namespace",
          severity: "error",
          path: "/qti-assessment-item/qti-item-body[1]/qti-choice-interaction[1]",
        }),
      ]),
    );
  });

  it("does not treat foreign-namespace media elements as QTI interaction assets", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" xmlns:foreign="https://example.invalid/not-qti" identifier="foreign-media" title="foreign-media" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
        <qti-item-body>
          <qti-media-interaction response-identifier="RESPONSE">
            <foreign:video src="foreign.mp4"/>
          </qti-media-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.document?.item.interactions[0]?.object).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "interaction.object.required",
        severity: "error",
      }),
    );
  });

  it("requires schema-required assessment item root attributes", () => {
    const missingAttributes = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="missing-root-attrs">
        <qti-item-body/>
      </qti-assessment-item>
    `);

    expect(missingAttributes.ok).toBe(false);
    expect(missingAttributes.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "assessmentItem.title.required" }),
        expect.objectContaining({ code: "assessmentItem.timeDependent.required" }),
      ]),
    );

    const invalidTimeDependent = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-time" title="bad-time" time-dependent="maybe">
        <qti-item-body/>
      </qti-assessment-item>
    `);

    expect(invalidTimeDependent.ok).toBe(false);
    expect(invalidTimeDependent.diagnostics).toContainEqual(
      expect.objectContaining({ code: "assessmentItem.timeDependent.boolean" }),
    );
  });

  it("does not mask missing choice identifiers with parser defaults", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="missing-choice-id" title="missing-choice-id" time-dependent="false">
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
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="choice" title="choice" time-dependent="false">
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
});
