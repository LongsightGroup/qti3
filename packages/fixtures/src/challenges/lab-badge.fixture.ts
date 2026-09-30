import type { QtiFixture } from "../index.js";

/** Challenge 08 — Check a lab result badge: synthetic MIT-licensed integration fixture. */
export const labBadgeFixture: QtiFixture = {
  id: "challenge-lab-badge",
  title: "Challenge 08 — Check a lab result badge",
  category: "processing",
  xml: `<?xml version="1.0" encoding="UTF-8"?>
<!-- Synthetic MIT-licensed question; expected results are independently authored. -->
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="challenge-lab-badge" title="Challenge 08 — Check a lab result badge" adaptive="false" time-dependent="false" xml:lang="en">
<qti-response-declaration identifier="RESULT" cardinality="single" base-type="float"></qti-response-declaration><qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"></qti-outcome-declaration><qti-outcome-declaration identifier="BADGE" cardinality="single" base-type="identifier"><qti-interpolation-table default-value="RETRY"><qti-interpolation-table-entry source-value="80" target-value="GOLD" include-boundary="false"/><qti-interpolation-table-entry source-value="50" target-value="SILVER"/></qti-interpolation-table></qti-outcome-declaration>

<qti-item-body><p>A lab awards gold for a result above 80, silver for 50 through 80, and asks you to retry below 50. Enter a result to check its badge.</p><p>Lab result (0–100): <qti-text-entry-interaction response-identifier="RESULT" expected-length="8"/></p></qti-item-body>
<qti-response-processing><qti-response-condition><qti-response-if><qti-not><qti-is-null><qti-variable identifier="RESULT"/></qti-is-null></qti-not><qti-set-outcome-value identifier="SCORE"><qti-variable identifier="RESULT"/></qti-set-outcome-value></qti-response-if></qti-response-condition><qti-lookup-outcome-value identifier="BADGE"><qti-variable identifier="RESULT"/></qti-lookup-outcome-value></qti-response-processing>
<qti-modal-feedback outcome-identifier="BADGE" identifier="GOLD" show-hide="show"><qti-content-body><p>Gold badge earned.</p></qti-content-body></qti-modal-feedback><qti-modal-feedback outcome-identifier="BADGE" identifier="SILVER" show-hide="show"><qti-content-body><p>Silver badge earned.</p></qti-content-body></qti-modal-feedback><qti-modal-feedback outcome-identifier="BADGE" identifier="RETRY" show-hide="show"><qti-content-body><p>Try the lab again.</p></qti-content-body></qti-modal-feedback></qti-assessment-item>`,
  expectedParseDiagnostics: [],
  expectedValidationDiagnostics: [],
  attempts: [
    {
      name: "above gold",
      responses: {
        RESULT: 80.001,
      },
      expectedOutcomes: {
        SCORE: 80.001,
        BADGE: "GOLD",
      },
    },
    {
      name: "exact gold boundary",
      responses: {
        RESULT: 80,
      },
      expectedOutcomes: {
        SCORE: 80,
        BADGE: "SILVER",
      },
    },
    {
      name: "silver boundary",
      responses: {
        RESULT: 50,
      },
      expectedOutcomes: {
        SCORE: 50,
        BADGE: "SILVER",
      },
    },
    {
      name: "below silver",
      responses: {
        RESULT: 49.99,
      },
      expectedOutcomes: {
        SCORE: 49.99,
        BADGE: "RETRY",
      },
    },
    {
      name: "zero",
      responses: {
        RESULT: 0,
      },
      expectedOutcomes: {
        SCORE: 0,
        BADGE: "RETRY",
      },
    },
    {
      name: "unanswered",
      responses: {},
      expectedOutcomes: {
        SCORE: 0,
        BADGE: "RETRY",
      },
    },
  ],
};
