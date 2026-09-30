import type { QtiFixture } from "../index.js";

/** Challenge 07 — Two shots at a target: synthetic MIT-licensed integration fixture. */
export const targetFixture: QtiFixture = {
  id: "challenge-target",
  title: "Challenge 07 — Two shots at a target",
  category: "processing",
  xml: `<?xml version="1.0" encoding="UTF-8"?>
<!-- Synthetic MIT-licensed question; expected results are independently authored. -->
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="challenge-target" title="Challenge 07 — Two shots at a target" adaptive="false" time-dependent="false" xml:lang="en">
<qti-response-declaration identifier="SHOTS" cardinality="multiple" base-type="point"><qti-area-mapping default-value="-1"><qti-area-map-entry shape="circle" coords="80,80,30" mapped-value="2"/><qti-area-map-entry shape="rect" coords="20,20,140,140" mapped-value="1"/></qti-area-mapping></qti-response-declaration><qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"></qti-outcome-declaration>

<qti-item-body><qti-select-point-interaction response-identifier="SHOTS" max-choices="2"><qti-prompt>Place up to two shots. The centre circle earns two points; the surrounding square earns one. Each region scores only once. A miss loses one point.</qti-prompt><object data="challenge-target.svg" type="image/svg+xml" width="160" height="160">A 160 by 160 target: square from 20 to 140 on both axes, with a circle centred at 80,80 and radius 30.</object></qti-select-point-interaction></qti-item-body>
<qti-response-processing><qti-set-outcome-value identifier="SCORE"><qti-map-response-point identifier="SHOTS"/></qti-set-outcome-value></qti-response-processing>
</qti-assessment-item>`,
  expectedParseDiagnostics: [],
  expectedValidationDiagnostics: [],
  attempts: [
    {
      name: "centre priority",
      responses: {
        SHOTS: ["80 80"],
      },
      expectedOutcomes: {
        SCORE: 2,
      },
    },
    {
      name: "same region twice",
      responses: {
        SHOTS: ["80 80", "85 80"],
      },
      expectedOutcomes: {
        SCORE: 2,
      },
    },
    {
      name: "two regions",
      responses: {
        SHOTS: ["80 80", "30 30"],
      },
      expectedOutcomes: {
        SCORE: 3,
      },
    },
    {
      name: "miss",
      responses: {
        SHOTS: ["5 5"],
      },
      expectedOutcomes: {
        SCORE: -1,
      },
    },
    {
      name: "hit and miss",
      responses: {
        SHOTS: ["80 80", "5 5"],
      },
      expectedOutcomes: {
        SCORE: 1,
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
