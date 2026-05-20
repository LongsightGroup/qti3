import { interactionFixtures } from "@longsightgroup/qti3-fixtures";
import { describe, expect, it } from "vitest";
import { runFixture } from "./index.js";

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
});
