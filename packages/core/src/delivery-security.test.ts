import { describe, expect, it } from "vitest";
import {
  analyzeQtiDeliverySecurity,
  buildQtiDeliverySafeXml,
  createItemSession,
  parseQtiXml,
  scoreQtiItemServerSide,
} from "./index.js";

describe("QTI delivery security", () => {
  it("detects and strips answer, scoring, and feedback subtrees", () => {
    const result = buildQtiDeliverySafeXml(scoredChoiceXml());

    expect(result.ok).toBe(true);
    expect(result.xml).toBeDefined();
    expect(result.xml).not.toContain("qti-correct-response");
    expect(result.xml).not.toContain("qti-response-processing");
    expect(result.xml).not.toContain("qti-feedback-inline");
    expect(result.xml).not.toContain("qti-feedback-block");
    expect(result.xml).not.toContain("qti-modal-feedback");
    expect(result.xml).toContain("qti-choice-interaction");
    expect(result.xml).toContain("<p>A <strong>B</strong> C</p>");

    const redacted = parseQtiXml(result.xml!);
    expect(redacted.ok).toBe(true);

    const analysis = analyzeQtiDeliverySecurity(result.xml!);
    expect(analysis.deliverySafe).toBe(true);
    expect(analysis.secureDeliverySupported).toBe(true);
    expect(analysis.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "delivery.forbiddenElement", severity: "warning" }),
    );
  });

  it("detects and strips response and area mappings", () => {
    const result = buildQtiDeliverySafeXml(mappedChoiceXml());

    expect(result.ok).toBe(true);
    expect(result.xml).not.toContain("qti-mapping");
    expect(result.xml).not.toContain("qti-map-entry");
    expect(result.xml).not.toContain('map-key="A"');

    const analysis = analyzeQtiDeliverySecurity(mappedChoiceXml());
    expect(analysis.deliverySafe).toBe(false);
    expect(analysis.diagnostics).toContainEqual(
      expect.objectContaining({ code: "delivery.forbiddenElement", severity: "error" }),
    );
    expect(analyzeQtiDeliverySecurity(result.xml!).deliverySafe).toBe(true);
  });

  it("redacts forbidden elements when comments or CDATA contain decoy closing tags", () => {
    const xml = `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="decoy-tags" title="decoy-tags" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
          <!-- decoy </qti-correct-response> -->
          <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <![CDATA[</qti-feedback-inline> not real]]>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">A</qti-simple-choice>
          </qti-choice-interaction>
          <qti-feedback-inline outcome-identifier="FEEDBACK" identifier="yes" show-hide="show">Inline feedback.</qti-feedback-inline>
        </qti-item-body>
        <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
      </qti-assessment-item>
    `;

    const result = buildQtiDeliverySafeXml(xml);
    expect(result.ok).toBe(true);
    expect(result.xml).not.toMatch(/<qti-correct-response\b/);
    expect(result.xml).not.toMatch(/<qti-feedback-inline\b/);
    expect(result.xml).not.toContain("Inline feedback.");
    expect(analyzeQtiDeliverySecurity(result.xml!).deliverySafe).toBe(true);
  });

  it("detects prefixed QTI scoring elements by parsed local name", () => {
    const analysis = analyzeQtiDeliverySecurity(`
      <qti:assessment-item xmlns:qti="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="prefixed" title="prefixed" time-dependent="false">
        <qti:response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
          <qti:correct-response><qti:value>A</qti:value></qti:correct-response>
        </qti:response-declaration>
        <qti:item-body><p>Prefixed.</p></qti:item-body>
        <qti:response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
      </qti:assessment-item>
    `);

    expect(analysis.deliverySafe).toBe(false);
    expect(analysis.secureDeliverySupported).toBe(true);
    expect(analysis.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ localName: "correct-response" }),
        expect.objectContaining({ localName: "response-processing" }),
      ]),
    );
  });

  it("reports secure-delivery v1 blockers", () => {
    const template = analyzeQtiDeliverySecurity(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="template" title="template" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body><p>Template.</p></qti-item-body>
        <qti-template-processing>
          <qti-set-correct-response identifier="RESPONSE">
            <qti-base-value base-type="identifier">A</qti-base-value>
          </qti-set-correct-response>
        </qti-template-processing>
      </qti-assessment-item>
    `);
    expect(template.secureDeliverySupported).toBe(false);
    expect(template.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "unsupported-secure-delivery-element" }),
      ]),
    );

    const adaptive = analyzeQtiDeliverySecurity(scoredChoiceXml({ adaptive: true }));
    expect(adaptive.secureDeliverySupported).toBe(false);
    expect(adaptive.findings).toContainEqual(
      expect.objectContaining({ kind: "unsupported-adaptive-response-processing" }),
    );
  });

  it("returns diagnostics for malformed XML without throwing", () => {
    const incompleteXml = `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="incomplete" title="incomplete" time-dependent="false">
        <qti-item-body>
    `;
    const analysis = analyzeQtiDeliverySecurity(incompleteXml);
    expect(analysis.deliverySafe).toBe(false);
    expect(analysis.secureDeliverySupported).toBe(false);
    expect(analysis.diagnostics).toContainEqual(
      expect.objectContaining({ code: "xml.parse", severity: "error" }),
    );

    const result = buildQtiDeliverySafeXml(incompleteXml);
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "xml.parse", severity: "error" }),
    );
  });
});

describe("QTI delivery trust boundary", () => {
  it("keeps authoritative server scoring after candidate-safe redaction", () => {
    const authoritative = authoritativeChoiceXml();
    const delivery = buildQtiDeliverySafeXml(authoritative);
    expect(delivery.ok).toBe(true);

    const redacted = parseQtiXml(delivery.xml!);
    expect(redacted.ok).toBe(true);
    expect(redacted.document).toBeDefined();
    expect(redacted.document!.item.responseProcessing).toBeUndefined();

    const browserSession = createItemSession(redacted.document!);
    browserSession.respond("RESPONSE", "A");
    expect(browserSession.score().outcomes.SCORE).toBe(0);

    const correct = scoreQtiItemServerSide({
      itemXml: authoritative,
      trustedResponses: { RESPONSE: "A" },
    });
    const wrong = scoreQtiItemServerSide({
      itemXml: authoritative,
      trustedResponses: { RESPONSE: "B" },
    });

    expect(correct.ok).toBe(true);
    expect(correct.score).toBe(1);
    expect(wrong.ok).toBe(true);
    expect(wrong.score).toBe(0);
  });
});

function authoritativeChoiceXml(): string {
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="choice" title="choice" time-dependent="false">
      <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
        <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
      </qti-response-declaration>
      <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
        <qti-default-value><qti-value>0</qti-value></qti-default-value>
      </qti-outcome-declaration>
      <qti-item-body>
        <qti-choice-interaction response-identifier="RESPONSE">
          <qti-simple-choice identifier="A">A</qti-simple-choice>
          <qti-simple-choice identifier="B">B</qti-simple-choice>
        </qti-choice-interaction>
      </qti-item-body>
      <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
    </qti-assessment-item>
  `;
}

function mappedChoiceXml(): string {
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="mapped-choice" title="mapped-choice" time-dependent="false">
      <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
        <qti-mapping default-value="0">
          <qti-map-entry map-key="A" mapped-value="1"/>
          <qti-map-entry map-key="B" mapped-value="0"/>
        </qti-mapping>
      </qti-response-declaration>
      <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
        <qti-default-value><qti-value>0</qti-value></qti-default-value>
      </qti-outcome-declaration>
      <qti-item-body>
        <qti-choice-interaction response-identifier="RESPONSE">
          <qti-simple-choice identifier="A">A</qti-simple-choice>
          <qti-simple-choice identifier="B">B</qti-simple-choice>
        </qti-choice-interaction>
      </qti-item-body>
      <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/map_response"/>
    </qti-assessment-item>
  `;
}

function scoredChoiceXml(options: { adaptive?: boolean } = {}): string {
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="choice" title="choice" adaptive="${String(
      options.adaptive ?? false,
    )}" time-dependent="false">
      <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
        <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
      </qti-response-declaration>
      <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
        <qti-default-value><qti-value>0</qti-value></qti-default-value>
      </qti-outcome-declaration>
      <qti-item-body>
        <p>A <strong>B</strong> C</p>
        <qti-choice-interaction response-identifier="RESPONSE">
          <qti-simple-choice identifier="A">A</qti-simple-choice>
          <qti-simple-choice identifier="B">B</qti-simple-choice>
        </qti-choice-interaction>
        <qti-feedback-inline outcome-identifier="FEEDBACK" identifier="yes" show-hide="show">Inline feedback.</qti-feedback-inline>
        <qti-feedback-block outcome-identifier="FEEDBACK" identifier="yes" show-hide="show">Block feedback.</qti-feedback-block>
      </qti-item-body>
      <qti-modal-feedback outcome-identifier="FEEDBACK" identifier="yes" show-hide="show">Modal feedback.</qti-modal-feedback>
      <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
    </qti-assessment-item>
  `;
}
