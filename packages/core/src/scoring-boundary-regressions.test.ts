import { expect, it } from "vitest";
import {
  assertQtiXmlSchema,
  validQtiDocument,
} from "../../../tests/fixtures/valid-qti-document.js";
import { requireTestResult } from "../../../tests/fixtures/test-result.js";
import {
  createItemSession,
  parseQtiTest,
  startQtiTest,
  submitQtiTestAnswer,
  snapshotQtiTestSession,
  restoreQtiTestSession,
} from "./index.js";

const wholeImage = '<qti-area-map-entry shape="default" coords="0,0,100,100" mapped-value="5"/>';
const rectangle = '<qti-area-map-entry shape="rect" coords="0,0,50,50" mapped-value="6"/>';
function areaItem(entries: string, dimensions = 'width="100" height="100"') {
  return `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="area" title="Area" adaptive="false" time-dependent="false"><qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="point"><qti-area-mapping default-value="-1">${entries}</qti-area-mapping></qti-response-declaration><qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/><qti-item-body><qti-select-point-interaction response-identifier="RESPONSE" max-choices="0"><object data="image.png" type="image/png" ${dimensions}/></qti-select-point-interaction></qti-item-body><qti-response-processing><qti-set-outcome-value identifier="SCORE"><qti-map-response-point identifier="RESPONSE"/></qti-set-outcome-value></qti-response-processing></qti-assessment-item>`;
}

// QTI 3.0.1 §8.34: default means the entire image; §2.11.1.6: priority and once per area.
it.each([
  ["counts the default area only once", wholeImage, ["25 25", "75 75"], 5],
  ["gives the first default area priority", wholeImage + rectangle, ["25 25", "75 75"], 5],
  ["gives the first rectangle priority", rectangle + wholeImage, ["25 25", "75 75"], 11],
  ["rejects points outside image bounds", wholeImage, ["101 25"], -1],
  ["uses the default value outside mapped areas", rectangle, ["75 75"], -1],
] as const)("scores image areas: %s", (_name, entries, points, expected) => {
  const session = createItemSession(validQtiDocument(areaItem(entries)));
  expect(session.respond("RESPONSE", [...points])).toEqual([]);
  const score = session.score();
  expect(score.diagnostics).toEqual([]);
  expect(score.outcomes.SCORE).toBe(expected);
});

it("reports missing image bounds only when scoring an answered point response", () => {
  const session = createItemSession(validQtiDocument(areaItem(wholeImage, "")));
  expect(session.score().outcomes.SCORE).toBe(0);
  session.respond("RESPONSE", ["25 25"]);
  const score = session.score();
  expect(score.outcomes.SCORE).toBeNull();
  expect(score.diagnostics).toContainEqual(
    expect.objectContaining({ code: "processing.areaMapping.imageBounds" }),
  );
});

const aggregate = '<qti-sum><qti-test-variables variable-identifier="SCORE"/></qti-sum>';
const overflowing =
  '<qti-sum><qti-base-value base-type="float">1e308</qti-base-value><qti-base-value base-type="float">1e308</qti-base-value></qti-sum>';
function testXml(expression: string, branch = "") {
  return `<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="test" title="Test"><qti-outcome-declaration identifier="TOTAL" cardinality="single" base-type="float"/><qti-test-part identifier="part" navigation-mode="linear" submission-mode="individual"><qti-assessment-section identifier="section" title="Section" visible="true">${branch}<qti-assessment-item-ref identifier="one" href="one.xml"/><qti-assessment-item-ref identifier="two" href="two.xml"/></qti-assessment-section></qti-test-part><qti-outcome-processing><qti-set-outcome-value identifier="TOTAL">${expression}</qti-set-outcome-value></qti-outcome-processing></qti-assessment-test>`;
}
function executable(xml: string) {
  assertQtiXmlSchema(xml);
  return requireTestResult(parseQtiTest(xml));
}
const overflowFailure = {
  ok: false,
  diagnostics: [expect.objectContaining({ code: "test.processing.nonFinite", severity: "error" })],
};

// Finite JSON execution profile: overflow cannot commit a grade, consume a submission or route.
it("rejects test aggregation overflow atomically and preserves retry and snapshot replay", () => {
  const test = executable(testXml(aggregate));
  const initial = requireTestResult(startQtiTest(test));
  expect(initial.outcomes.TOTAL).toBeNull();
  const first = requireTestResult(
    submitQtiTestAnswer(test, initial, { itemRef: "one", score: 1e308 }),
  );
  const saved = snapshotQtiTestSession(first);
  expect(submitQtiTestAnswer(test, first, { itemRef: "two", score: 1e308 })).toMatchObject(
    overflowFailure,
  );
  expect(snapshotQtiTestSession(first)).toEqual(saved);
  expect(first.outcomes.TOTAL).toBe(1e308);
  const completed = requireTestResult(
    submitQtiTestAnswer(test, first, { itemRef: "two", score: -1e308 }),
  );
  expect(completed.status).toBe("completed");
  expect(completed.outcomes.TOTAL).toBe(0);
  expect(requireTestResult(restoreQtiTestSession(test, snapshotQtiTestSession(completed)))).toEqual(
    completed,
  );
  expect(
    restoreQtiTestSession(test, {
      ...saved,
      submissions: [...saved.submissions, { itemRef: "two", score: 1e308 }],
    }),
  ).toMatchObject(overflowFailure);
});

it("reports overflow at test startup and in branch predicates instead of returning a route", () => {
  const constant = executable(testXml(overflowing));
  expect(startQtiTest(constant)).toMatchObject(overflowFailure);
  expect(
    restoreQtiTestSession(constant, { version: 1, testIdentifier: "test", submissions: [] }),
  ).toMatchObject(overflowFailure);
  const branch = `<qti-branch-rule target="EXIT_TEST"><qti-gt>${overflowing}<qti-base-value base-type="float">0</qti-base-value></qti-gt></qti-branch-rule>`;
  const test = executable(testXml(aggregate, branch));
  const first = requireTestResult(
    submitQtiTestAnswer(test, requireTestResult(startQtiTest(test)), { itemRef: "one", score: 1 }),
  );
  expect(submitQtiTestAnswer(test, first, { itemRef: "two", score: 2 })).toMatchObject(
    overflowFailure,
  );
  expect(first).toMatchObject({ status: "active", currentItemRef: "two", outcomes: { TOTAL: 1 } });
});
