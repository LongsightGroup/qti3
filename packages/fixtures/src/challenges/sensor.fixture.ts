import type { QtiFixture } from "../index.js";

/** Challenge 02 — Calibrate a temperature sensor: synthetic MIT-licensed integration fixture. */
export const sensorFixture: QtiFixture = {
  id: "challenge-sensor",
  title: "Challenge 02 — Calibrate a temperature sensor",
  category: "processing",
  xml: `<?xml version="1.0" encoding="UTF-8"?>
<!-- Synthetic MIT-licensed question; expected results are independently authored. -->
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="challenge-sensor" title="Challenge 02 — Calibrate a temperature sensor" adaptive="false" time-dependent="false" xml:lang="en">
<qti-response-declaration identifier="TEMPERATURE" cardinality="single" base-type="float"></qti-response-declaration><qti-response-declaration identifier="UNIT" cardinality="single" base-type="identifier"><qti-correct-response><qti-value>CELSIUS</qti-value></qti-correct-response></qti-response-declaration><qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"></qti-outcome-declaration>

<qti-item-body><p>A sensor should read 100 degrees Celsius. Accept readings above 99.5 and up to 101, including 101.</p><p>Sensor reading: <qti-text-entry-interaction response-identifier="TEMPERATURE" expected-length="8"/></p><p>Unit: <qti-inline-choice-interaction response-identifier="UNIT"><qti-inline-choice identifier="CELSIUS">Celsius</qti-inline-choice><qti-inline-choice identifier="FAHRENHEIT">Fahrenheit</qti-inline-choice></qti-inline-choice-interaction></p></qti-item-body>
<qti-response-processing><qti-response-condition><qti-response-if><qti-equal tolerance-mode="absolute" tolerance="0.5 1" include-lower-bound="false" include-upper-bound="true"><qti-base-value base-type="float">100</qti-base-value><qti-variable identifier="TEMPERATURE"/></qti-equal><qti-set-outcome-value identifier="SCORE"><qti-sum><qti-variable identifier="SCORE"/><qti-base-value base-type="float">2</qti-base-value></qti-sum></qti-set-outcome-value></qti-response-if></qti-response-condition><qti-response-condition><qti-response-if><qti-match><qti-variable identifier="UNIT"/><qti-correct identifier="UNIT"/></qti-match><qti-set-outcome-value identifier="SCORE"><qti-sum><qti-variable identifier="SCORE"/><qti-base-value base-type="float">1</qti-base-value></qti-sum></qti-set-outcome-value></qti-response-if></qti-response-condition></qti-response-processing>
</qti-assessment-item>`,
  expectedParseDiagnostics: [],
  expectedValidationDiagnostics: [],
  attempts: [
    {
      name: "target",
      responses: {
        TEMPERATURE: 100,
        UNIT: "CELSIUS",
      },
      expectedOutcomes: {
        SCORE: 3,
      },
    },
    {
      name: "lower excluded",
      responses: {
        TEMPERATURE: 99.5,
        UNIT: "CELSIUS",
      },
      expectedOutcomes: {
        SCORE: 1,
      },
    },
    {
      name: "inside lower",
      responses: {
        TEMPERATURE: 99.5001,
        UNIT: "CELSIUS",
      },
      expectedOutcomes: {
        SCORE: 3,
      },
    },
    {
      name: "upper included",
      responses: {
        TEMPERATURE: 101,
        UNIT: "CELSIUS",
      },
      expectedOutcomes: {
        SCORE: 3,
      },
    },
    {
      name: "above upper",
      responses: {
        TEMPERATURE: 101.0001,
        UNIT: "CELSIUS",
      },
      expectedOutcomes: {
        SCORE: 1,
      },
    },
    {
      name: "wrong unit",
      responses: {
        TEMPERATURE: 100,
        UNIT: "FAHRENHEIT",
      },
      expectedOutcomes: {
        SCORE: 2,
      },
    },
    {
      name: "unanswered",
      responses: {},
      expectedOutcomes: {
        SCORE: 0,
      },
    },
  ],
};
