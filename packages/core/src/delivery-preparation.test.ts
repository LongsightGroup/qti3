import { describe, expect, expectTypeOf, it } from "vitest";
import { prepareQtiDeliveryXml } from "./index.js";
import type { QtiDeliveryPreparationOptions, QtiValue } from "./index.js";

describe("QTI delivery preparation", () => {
  it("prepares static candidate-safe XML through the high-level API", () => {
    const result = prepareQtiDeliveryXml(scoredChoiceXml(), { mode: "static" });

    expect(result.ok).toBe(true);
    expect(result.mode).toBe("static");
    expect(result.candidateSafeXml).toBeDefined();
    expect(result.candidateSafeXml).not.toContain("qti-correct-response");
    expect(result.candidateSafeXml).not.toContain("qti-response-processing");
    expect(result.candidateSafeXml).not.toContain("qti-feedback-inline");
    expect(result.candidateSafeXml).not.toContain("qti-feedback-block");
    expect(result.candidateSafeXml).not.toContain("qti-modal-feedback");
    expect(result.analysis.deliverySafe).toBe(true);
    expect(result.analysis.secureDeliverySupported).toBe(true);
  });

  it("prepares server-materialized adaptive XML without static adaptive blockers", () => {
    const result = prepareQtiDeliveryXml(scoredChoiceXml({ adaptive: true }), {
      mode: "server-materialized-adaptive",
      outcomes: { FEEDBACK: "yes" },
    });

    expect(result.ok).toBe(true);
    expect(result.mode).toBe("server-materialized-adaptive");
    expect(result.candidateSafeXml).toBeDefined();
    expect(result.candidateSafeXml).not.toContain("qti-correct-response");
    expect(result.candidateSafeXml).not.toContain("qti-response-processing");
    expect(result.candidateSafeXml).toContain("Inline feedback.");
    expect(result.candidateSafeXml).toContain("Block feedback.");
    expect(result.candidateSafeXml).toContain("Modal feedback.");
    expect(result.analysis.deliverySafe).toBe(true);
    expect(result.analysis.secureDeliverySupported).toBe(true);
  });

  it("fails closed for unsupported preparation mode constructs", () => {
    const staticAdaptive = prepareQtiDeliveryXml(scoredChoiceXml({ adaptive: true }), {
      mode: "static",
    });
    expect(staticAdaptive.ok).toBe(false);
    expect(staticAdaptive.candidateSafeXml).toBeUndefined();
    expect(staticAdaptive.diagnostics).toContainEqual(
      expect.objectContaining({ code: "delivery.unsupportedAdaptiveResponseProcessing" }),
    );

    const adaptiveTemplate = prepareQtiDeliveryXml(templateProcessingXml(), {
      mode: "server-materialized-adaptive",
      outcomes: {},
    });
    expect(adaptiveTemplate.ok).toBe(false);
    expect(adaptiveTemplate.candidateSafeXml).toBeUndefined();
    expect(adaptiveTemplate.diagnostics).toContainEqual(
      expect.objectContaining({ code: "adaptiveTurn.materialization.unsupported" }),
    );
  });

  it("requires outcomes for server-materialized-adaptive mode at the type level", () => {
    type AdaptiveBranch = Extract<
      QtiDeliveryPreparationOptions,
      { mode: "server-materialized-adaptive" }
    >;
    expectTypeOf<AdaptiveBranch>().toEqualTypeOf<{
      mode: "server-materialized-adaptive";
      outcomes: Record<string, QtiValue>;
    }>();
    expectTypeOf({ mode: "static" } satisfies QtiDeliveryPreparationOptions).toEqualTypeOf<{
      mode: "static";
    }>();
  });
});

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
      <qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier"/>
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

function templateProcessingXml(): string {
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="template" title="template" time-dependent="false">
      <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
      <qti-item-body><p>Template.</p></qti-item-body>
      <qti-template-processing>
        <qti-set-correct-response identifier="RESPONSE">
          <qti-base-value base-type="identifier">A</qti-base-value>
        </qti-set-correct-response>
      </qti-template-processing>
    </qti-assessment-item>
  `;
}
