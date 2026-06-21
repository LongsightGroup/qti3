import { describe, expect, it } from "vitest";
import {
  createItemSession,
  isQtiPortableCustomStateValue,
  isQtiValue,
  parseQtiXml,
  readQtiJsonValue,
  scoreQtiItemServerSide,
} from "./index.js";
import { noScoreProcessingItemXml } from "./trusted-item.fixtures.js";

describe("server-side QTI scoring", () => {
  it("scores correct and wrong responses from authoritative XML", () => {
    const correct = scoreQtiItemServerSide({
      itemXml: scoredChoiceXml(),
      trustedResponses: { RESPONSE: "A" },
    });
    expect(correct.ok).toBe(true);
    expect(correct.score).toBe(1);
    expect(correct.outcomes.SCORE).toBe(1);

    const wrong = scoreQtiItemServerSide({
      itemXml: scoredChoiceXml(),
      trustedResponses: { RESPONSE: "B" },
    });
    expect(wrong.ok).toBe(true);
    expect(wrong.score).toBe(0);
    expect(wrong.outcomes.SCORE).toBe(0);
  });

  it("ignores forged outcome variables supplied with responses", () => {
    const scored = scoreQtiItemServerSide({
      itemXml: scoredChoiceXml(),
      trustedResponses: {
        RESPONSE: "B",
        SCORE: 1,
        MAXSCORE: 1,
      },
    });

    expect(scored.ok).toBe(true);
    expect(scored.score).toBe(0);
    expect(scored.state?.responses).not.toHaveProperty("SCORE");
    expect(scored.diagnostics).toContainEqual(
      expect.objectContaining({ code: "serverScoring.response.ignored", severity: "warning" }),
    );
  });

  it("allows configured undeclared host-owned responses", () => {
    const scored = scoreQtiItemServerSide({
      itemXml: durationScoredXml(),
      trustedResponses: { duration: 12.5 },
      allowedUndeclaredResponseIdentifiers: ["duration"],
    });

    expect(scored.ok).toBe(true);
    expect(scored.state?.responses).not.toHaveProperty("duration");
    expect(scored.score).toBe(1);

    const parsed = parseQtiXml(durationScoredXml());
    expect(parsed.document).toBeDefined();
    expect(() => createItemSession(parsed.document!, scored.state ?? undefined)).not.toThrow();
  });

  it("does not resolve undeclared response keys in a normal item session", () => {
    const parsed = parseQtiXml(durationScoredXml());
    expect(parsed.document).toBeDefined();

    const session = createItemSession(parsed.document!);
    session.respond("duration", 12.5);

    expect(session.score().outcomes.SCORE).toBe(0);
  });

  it("rejects undeclared host-owned responses without an allow-list", () => {
    const scored = scoreQtiItemServerSide({
      itemXml: durationScoredXml(),
      trustedResponses: { duration: 12.5 },
    });

    expect(scored.ok).toBe(false);
    expect(scored.diagnostics).toContainEqual(
      expect.objectContaining({ code: "processing.variable.reference", severity: "error" }),
    );
  });

  it("fails invalid QTI response values", () => {
    const scored = scoreQtiItemServerSide({
      itemXml: scoredChoiceXml(),
      trustedResponses: { RESPONSE: { nested: Number.NaN } },
    });

    expect(scored.ok).toBe(false);
    expect(scored.diagnostics).toContainEqual(
      expect.objectContaining({ code: "serverScoring.response.value", severity: "error" }),
    );
  });

  it("fails parse errors, validation errors, and missing required numeric SCORE", () => {
    const malformed = scoreQtiItemServerSide({
      itemXml: `
        <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="incomplete" title="incomplete" time-dependent="false">
          <qti-item-body>
      `,
      trustedResponses: { RESPONSE: "A" },
    });
    expect(malformed.ok).toBe(false);
    expect(malformed.diagnostics).toContainEqual(
      expect.objectContaining({ code: "xml.parse", severity: "error" }),
    );

    const validation = scoreQtiItemServerSide({
      itemXml: unsupportedProcessingXml(),
      trustedResponses: { RESPONSE: "A" },
    });
    expect(validation.ok).toBe(false);
    expect(validation.diagnostics).toContainEqual(
      expect.objectContaining({ code: "processing.unsupported", severity: "error" }),
    );

    const missingScore = scoreQtiItemServerSide({
      itemXml: noScoreProcessingItemXml(),
      trustedResponses: { RESPONSE: "A" },
    });
    expect(missingScore.ok).toBe(false);
    expect(missingScore.diagnostics).toContainEqual(
      expect.objectContaining({ code: "serverScoring.score.missing", severity: "error" }),
    );
  });

  it("validates public QTI value helpers", () => {
    expect(readQtiJsonValue({ a: ["A", 1, true], b: null })).toEqual({
      a: ["A", 1, true],
      b: null,
    });
    expect(isQtiValue(["A", false])).toBe(true);
    expect(readQtiJsonValue([["nested"]])).toBeUndefined();
    expect(readQtiJsonValue({ bad: undefined })).toBeUndefined();
    expect(readQtiJsonValue(Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(readQtiJsonValue(new Date())).toBeUndefined();
    expect(isQtiPortableCustomStateValue({ nested: ["state", 1, null] })).toBe(true);
    expect(isQtiPortableCustomStateValue({ bad: Number.NaN })).toBe(false);
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

function durationScoredXml(): string {
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="duration-score" title="duration-score" time-dependent="false">
      <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
        <qti-default-value><qti-value>0</qti-value></qti-default-value>
      </qti-outcome-declaration>
      <qti-item-body><p>Duration-scored.</p></qti-item-body>
      <qti-response-processing>
        <qti-response-condition>
          <qti-response-if>
            <qti-gte>
              <qti-variable identifier="duration"/>
              <qti-base-value base-type="float">10</qti-base-value>
            </qti-gte>
            <qti-set-outcome-value identifier="SCORE">
              <qti-base-value base-type="float">1</qti-base-value>
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
  `;
}

function unsupportedProcessingXml(): string {
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="unsupported-processing" title="unsupported-processing" time-dependent="false">
      <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
      <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
      <qti-item-body><p>Unsupported processing expression.</p></qti-item-body>
      <qti-response-processing>
        <qti-set-outcome-value identifier="SCORE">
          <qti-unsupported-expression/>
        </qti-set-outcome-value>
      </qti-response-processing>
    </qti-assessment-item>
  `;
}
