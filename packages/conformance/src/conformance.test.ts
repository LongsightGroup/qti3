import {
  basicItemPlayerFixtures,
  basicItemPlayerToleranceFixtures,
  interactionFixtures,
} from "@longsightgroup/qti3-fixtures";
import { describe, expect, it } from "vitest";
import { basicItemPlayerProfile, runBasicItemPlayerReadiness, runFixture } from "./index.js";

describe("@longsightgroup/qti3-conformance", () => {
  for (const fixture of interactionFixtures) {
    it(`passes ${fixture.interactionType}`, () => {
      const result = runFixture(fixture);
      expect(result.diagnostics).toEqual([]);
      expect(result.ok).toBe(true);
    });
  }

  it("checks expected responses, outcomes, and serialized state from fixture attempts", () => {
    const result = runFixture({
      id: "conformance-state",
      category: "interaction",
      interactionType: "choice",
      qtiName: "qti-choice-interaction",
      title: "Conformance state",
      xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="conformance-state" title="conformance-state">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
      <qti-simple-choice identifier="B">B</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`,
      expectedParseDiagnostics: [],
      expectedValidationDiagnostics: [],
      attempts: [
        {
          name: "correct",
          responses: { RESPONSE: "A" },
          expectedResponses: { RESPONSE: "A" },
          expectedOutcomes: { SCORE: 1 },
          expectedState: {
            schema: "qti3.attempt-state.v1",
            itemIdentifier: "conformance-state",
            status: "interacting",
            responses: { RESPONSE: "A" },
            outcomes: { SCORE: 1 },
          },
        },
      ],
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("accepts expected validation diagnostics in negative fixtures", () => {
    const result = runFixture({
      id: "conformance-diagnostic",
      category: "interaction",
      interactionType: "slider",
      qtiName: "qti-slider-interaction",
      title: "Conformance diagnostic",
      xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="conformance-diagnostic" title="conformance-diagnostic">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <qti-slider-interaction response-identifier="RESPONSE">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
    </qti-slider-interaction>
  </qti-item-body>
</qti-assessment-item>`,
      expectedParseDiagnostics: [],
      expectedValidationDiagnostics: [
        {
          code: "interaction.child.unsupported",
          severity: "error",
          path: "/qti-assessment-item/qti-item-body[1]/qti-slider-interaction[1]/qti-simple-choice[1]",
        },
        {
          code: "interaction.slider.lowerBound",
          severity: "error",
        },
        {
          code: "interaction.slider.upperBound",
          severity: "error",
        },
      ],
      attempts: [],
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("accepts expected parse-time processing diagnostics in negative fixtures", () => {
    const result = runFixture({
      id: "conformance-unsupported-processing",
      category: "processing",
      title: "Conformance unsupported processing",
      xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="conformance-unsupported-processing" title="conformance-unsupported-processing">
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body><p>Unsupported processing expression.</p></qti-item-body>
  <qti-response-processing>
    <qti-set-outcome-value identifier="SCORE">
      <qti-unsupported-expression/>
    </qti-set-outcome-value>
  </qti-response-processing>
</qti-assessment-item>`,
      expectedParseDiagnostics: [
        {
          code: "processing.unsupported",
          severity: "error",
          path: "/qti-assessment-item/qti-response-processing[1]/qti-set-outcome-value[1]/qti-unsupported-expression[1]",
        },
      ],
      expectedValidationDiagnostics: [
        {
          code: "processing.baseValue.baseType.required",
          severity: "error",
        },
      ],
      attempts: [],
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("defines the narrow Basic item-player readiness profile", () => {
    expect(basicItemPlayerProfile.features.map((feature) => feature.featureId)).toEqual([
      "Q-2",
      "Q-5",
      "Q-13",
      "Q-20",
      "I-0",
      "I-1",
      "I-2",
      "I-7",
      "I-8",
      "I-9b",
      "I-17",
      "I-18",
      "I-19",
      "A-1",
      "P-4",
    ]);
    expect(
      basicItemPlayerProfile.features.some((feature) =>
        /test|section|delivery/i.test(`${feature.featureId} ${feature.label}`),
      ),
    ).toBe(false);
  });

  it("labels Basic item-player readiness as internal evidence, not formal certification", () => {
    const report = runBasicItemPlayerReadiness({
      packageEvidence: [{ source: "unit", ok: true, itemCount: 1 }],
    });

    expect(report.certificationContext).toMatchObject({
      officialCertification: false,
      profileLevel: "Basic",
      certificationCapability: "internal item-player readiness",
      evidenceCapability: "IMPORT - Item Only Packages",
      outOfScopeFeaturePrefixes: ["T-", "S-"],
    });
    expect(report.validatorEvidence).toEqual([]);
  });

  it("passes Basic item-player readiness when fixture and package evidence exists", () => {
    const report = runBasicItemPlayerReadiness({
      packageEvidence: [{ source: "unit", ok: true, itemCount: 1 }],
    });

    expect(report.ok).toBe(true);
    expect(report.failed).toBe(0);
    expect(report.toleranceChecked).toBe(basicItemPlayerToleranceFixtures.length);
    expect(report.toleranceFailed).toBe(0);
    expect(report.features.every((feature) => feature.status === "supported")).toBe(true);
  });

  it("passes Basic item-player tolerance fixtures for extra unsupported content", () => {
    for (const fixture of basicItemPlayerToleranceFixtures) {
      const result = runFixture(fixture);
      expect(result.diagnostics, fixture.id).toEqual([]);
      expect(result.ok, fixture.id).toBe(true);
    }
  });

  it("fails Basic item-player readiness when required fixture evidence is missing", () => {
    const profile = {
      ...basicItemPlayerProfile,
      features: [
        {
          ...basicItemPlayerProfile.features[0]!,
          fixtureIds: ["missing-basic-fixture"],
        },
      ],
    };
    const report = runBasicItemPlayerReadiness({
      profile,
      fixtures: basicItemPlayerFixtures,
      packageEvidence: [{ source: "unit", ok: true, itemCount: 1 }],
    });

    expect(report.ok).toBe(false);
    expect(report.failed).toBe(1);
    expect(report.features[0]).toMatchObject({
      featureId: "Q-2",
      status: "evidence-missing",
      diagnostics: [expect.objectContaining({ code: "basic.fixture.notFound" })],
    });
  });

  it("fails Basic choice readiness when max-choices evidence is missing", () => {
    const choice = interactionFixtures.find((fixture) => fixture.id === "choice-reference");
    if (!choice) throw new Error("Missing choice fixture.");
    const report = runBasicItemPlayerReadiness({
      profile: {
        ...basicItemPlayerProfile,
        features: [basicItemPlayerProfile.features[0]!],
      },
      fixtures: [
        {
          ...choice,
          xml: choice.xml.replace(' max-choices="1"', ""),
        },
      ],
      packageEvidence: [{ source: "unit", ok: true, itemCount: 1 }],
    });

    expect(report.ok).toBe(false);
    expect(report.features[0]).toMatchObject({
      featureId: "Q-2",
      status: "evidence-missing",
      diagnostics: [expect.objectContaining({ code: "basic.choice.maxChoices.missing" })],
    });
  });

  it("fails Basic item-player readiness when item-only package evidence is missing", () => {
    const report = runBasicItemPlayerReadiness();
    const packageRow = report.features.find((feature) => feature.featureId === "P-4");

    expect(report.ok).toBe(false);
    expect(packageRow).toMatchObject({
      status: "evidence-missing",
      diagnostics: [expect.objectContaining({ code: "basic.packageEvidence.missing" })],
    });
  });

  it("fails Basic item-player readiness when tolerance evidence is missing", () => {
    const report = runBasicItemPlayerReadiness({
      packageEvidence: [{ source: "unit", ok: true, itemCount: 1 }],
      toleranceFixtures: [],
    });

    expect(report.ok).toBe(false);
    expect(report.toleranceFailed).toBe(1);
    expect(report.tolerance[0]).toMatchObject({
      fixtureId: "basic-item-player-tolerance",
      ok: false,
      diagnostics: [expect.objectContaining({ code: "basic.tolerance.evidenceMissing" })],
    });
  });
});
