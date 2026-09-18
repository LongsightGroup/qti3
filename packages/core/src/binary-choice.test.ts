import { expect, it } from "vitest";
import { inspectQtiBinaryChoice } from "./binary-choice.js";

const item = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="binary" title="Binary" adaptive="false" time-dependent="false">
<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"><qti-correct-response><qti-value>A</qti-value></qti-correct-response></qti-response-declaration>
<qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
<qti-item-body><qti-choice-interaction response-identifier="RESPONSE" max-choices="1"><qti-simple-choice identifier="A">A</qti-simple-choice><qti-simple-choice identifier="B">B</qti-simple-choice></qti-choice-interaction></qti-item-body>
<qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`;

it("establishes single-choice binary scoring for every available answer", () => {
  expect(inspectQtiBinaryChoice(item)).toEqual({
    ok: true,
    responseIdentifier: "RESPONSE",
    correctChoice: "A",
  });
});

it("rejects unavailable correct answers, unscored, adaptive and multiple-choice questions", () => {
  for (const xml of [
    item.replace("<qti-value>A", "<qti-value>C"),
    item.replace('adaptive="false"', 'adaptive="true"'),
    item.replace('time-dependent="false"', 'time-dependent="true"'),
    item.replace('max-choices="1"', 'max-choices="2"'),
    item.replace(/<qti-response-processing[^>]+\/>/, ""),
  ])
    expect(inspectQtiBinaryChoice(xml).ok).toBe(false);
});

it("rejects partial credit and session-dependent scoring", () => {
  for (const expression of [
    '<qti-base-value base-type="float">0.5</qti-base-value>',
    '<qti-random-float min="0" max="1"/>',
    '<qti-variable identifier="numAttempts"/>',
  ]) {
    const processing = `<qti-response-processing><qti-set-outcome-value identifier="SCORE">${expression}</qti-set-outcome-value></qti-response-processing>`;
    expect(
      inspectQtiBinaryChoice(item.replace(/<qti-response-processing[^>]+\/>/, processing)).ok,
    ).toBe(false);
  }
});
