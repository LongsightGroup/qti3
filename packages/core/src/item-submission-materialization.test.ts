import { describe, expect, it } from "vitest";
import { materializeQtiItemSubmission } from "./index.js";

describe("QTI item submission materialization", () => {
  it("scores non-adaptive submitted response variables", () => {
    const result = materializeQtiItemSubmission({
      itemXml: scoredChoiceXml(),
      trustedResponses: { RESPONSE: "A" },
    });

    expect(result.ok).toBe(true);
    expect(result.scoringDisposition).toBe("scored");
    expect(result.score).toBe(1);
    expect(result.state?.responses.RESPONSE).toBe("A");
    expect(result.responseVariables).toContainEqual(
      expect.objectContaining({ identifier: "RESPONSE", value: "A" }),
    );
    expect(result.outcomeVariables).toContainEqual(
      expect.objectContaining({ identifier: "SCORE", value: 1 }),
    );
  });

  it("materializes adaptive submissions through the adaptive turn path", () => {
    const result = materializeQtiItemSubmission({
      itemXml: adaptiveChoiceXml(),
      trustedResponses: { RESPONSE: "A" },
    });

    expect(result.ok).toBe(true);
    expect(result.scoringDisposition).toBe("scored");
    expect(result.score).toBe(1);
    expect(result.candidateSafeXml).toBeDefined();
    expect(result.candidateSafeXml).not.toContain("qti-response-processing");
    expect(result.state?.status).toBe("interacting");
    expect(result.outcomeVariables).toContainEqual(
      expect.objectContaining({ identifier: "SCORE", value: 1 }),
    );
  });

  it("returns validation diagnostics for invalid and undeclared response variables", () => {
    const invalidShape = materializeQtiItemSubmission({
      itemXml: scoredChoiceXml(),
      trustedResponses: { RESPONSE: ["A"] },
    });
    expect(invalidShape.ok).toBe(false);
    expect(invalidShape.scoringDisposition).toBe("invalid");
    expect(invalidShape.diagnostics).toContainEqual(
      expect.objectContaining({ code: "response.cardinality", severity: "error" }),
    );

    const undeclared = materializeQtiItemSubmission({
      itemXml: scoredChoiceXml(),
      trustedResponses: { SCORE: 1 },
      allowIncompleteResponses: true,
    });
    expect(undeclared.ok).toBe(false);
    expect(undeclared.diagnostics).toContainEqual(
      expect.objectContaining({ code: "response.undeclared", severity: "error" }),
    );
  });

  it("classifies manually scored items without requiring a numeric SCORE", () => {
    const result = materializeQtiItemSubmission({
      itemXml: essayXml(),
      trustedResponses: { RESPONSE: "Long answer." },
    });

    expect(result.ok).toBe(true);
    expect(result.score).toBeNull();
    expect(result.scoringDisposition).toBe("manual-scoring-required");
    expect(result.responseVariables).toContainEqual(
      expect.objectContaining({ identifier: "RESPONSE", value: "Long answer." }),
    );
  });

  it("classifies unscored reference interactions without requiring a numeric SCORE", () => {
    const result = materializeQtiItemSubmission({
      itemXml: mediaReferenceXml(),
      trustedResponses: { RESPONSE: 2 },
    });

    expect(result.ok).toBe(true);
    expect(result.score).toBeNull();
    expect(result.scoringDisposition).toBe("unscored-reference");
    expect(result.responseVariables).toContainEqual(
      expect.objectContaining({ identifier: "RESPONSE", value: 2 }),
    );
  });

  it("rejects invalid prior attempt state for non-adaptive submissions", () => {
    const result = materializeQtiItemSubmission({
      itemXml: scoredChoiceXml(),
      existingState: { not: "attempt-state" },
      trustedResponses: { RESPONSE: "A" },
    });

    expect(result.ok).toBe(false);
    expect(result.scoringDisposition).toBe("invalid");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "itemSubmission.state.value", severity: "error" }),
    );
  });

  it("rejects invalid adaptive response shapes before adaptive turn processing", () => {
    const result = materializeQtiItemSubmission({
      itemXml: adaptiveChoiceXml(),
      trustedResponses: { RESPONSE: ["A"] },
    });

    expect(result.ok).toBe(false);
    expect(result.scoringDisposition).toBe("invalid");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "response.cardinality", severity: "error" }),
    );
    expect(
      result.diagnostics.some((diagnostic) => diagnostic.code.startsWith("adaptiveTurn")),
    ).toBe(false);
  });

  it("classifies response-processing items without numeric SCORE as manual scoring", () => {
    const result = materializeQtiItemSubmission({
      itemXml: unscoredResponseProcessingXml(),
      trustedResponses: { RESPONSE: "A" },
    });

    expect(result.ok).toBe(true);
    expect(result.score).toBeNull();
    expect(result.scoringDisposition).toBe("manual-scoring-required");
  });
});

function scoredChoiceXml(): string {
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

function adaptiveChoiceXml(): string {
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="adaptive-choice" title="adaptive-choice" adaptive="true" time-dependent="false">
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

function essayXml(): string {
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="essay" title="essay" time-dependent="false">
      <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
      <qti-item-body>
        <qti-extended-text-interaction response-identifier="RESPONSE"/>
      </qti-item-body>
    </qti-assessment-item>
  `;
}

function mediaReferenceXml(): string {
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="media-reference" title="media-reference" time-dependent="false">
      <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
      <qti-item-body>
        <qti-media-interaction response-identifier="RESPONSE">
          <object data="clip.mp3" type="audio/mpeg">Audio clip</object>
        </qti-media-interaction>
      </qti-item-body>
    </qti-assessment-item>
  `;
}

function unscoredResponseProcessingXml(): string {
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="unscored-rp" title="unscored-rp" time-dependent="false">
      <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
        <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
      </qti-response-declaration>
      <qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier"/>
      <qti-item-body>
        <qti-choice-interaction response-identifier="RESPONSE">
          <qti-simple-choice identifier="A">A</qti-simple-choice>
          <qti-simple-choice identifier="B">B</qti-simple-choice>
        </qti-choice-interaction>
      </qti-item-body>
      <qti-response-processing>
        <qti-set-outcome-value identifier="FEEDBACK">
          <qti-base-value base-type="identifier">seen</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-processing>
    </qti-assessment-item>
  `;
}
