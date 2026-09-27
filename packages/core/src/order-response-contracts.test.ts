import { expect, it } from "vitest";
import {
  createItemSession,
  parseQtiXml,
  validateAssessmentItem,
  validateQtiResponseVariables,
} from "./index.js";

// QTI 3 §§5.97.2,5.61: full ordering requires every available choice; subset ordering cannot repeat choices.
function documentFor(type: "order" | "graphic-order", limits = "", hidden = false) {
  const choices = ["A", "B", "C"]
    .map((id, index) => {
      const visibility =
        hidden && id === "C" ? ' template-identifier="HIDDEN" show-hide="hide"' : "";
      return type === "order"
        ? `<qti-simple-choice identifier="${id}"${visibility}>${id}</qti-simple-choice>`
        : `<qti-hotspot-choice identifier="${id}" shape="rect" coords="${index * 30},0,${index * 30 + 20},20"${visibility}>${id}</qti-hotspot-choice>`;
    })
    .join("");
  const xml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="ordering" title="Ordering" time-dependent="false">
    <qti-response-declaration identifier="RESPONSE" cardinality="ordered" base-type="identifier"><qti-correct-response><qti-value>A</qti-value><qti-value>B</qti-value><qti-value>C</qti-value></qti-correct-response></qti-response-declaration>
    <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
    ${hidden ? '<qti-template-declaration identifier="HIDDEN" cardinality="single" base-type="identifier"><qti-default-value><qti-value>C</qti-value></qti-default-value></qti-template-declaration>' : ""}
    <qti-item-body><qti-${type}-interaction response-identifier="RESPONSE" ${limits}>${type === "graphic-order" ? '<img src="synthetic.svg" alt="Three regions" width="100" height="30"/>' : ""}${choices}</qti-${type}-interaction></qti-item-body>
    <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct.xml"/>
  </qti-assessment-item>`;
  const parsed = parseQtiXml(xml);
  expect(parsed.diagnostics).toEqual([]);
  if (!parsed.document) throw new Error("Expected item");
  expect(validateAssessmentItem(parsed.document).diagnostics).toEqual([]);
  return parsed.document;
}

it.each(["order", "graphic-order"] as const)(
  "[ASI-ORDER-FULL] validates full %s permutations and grades",
  (type) => {
    const document = documentFor(type, 'max-choices="1"'); // Ignored without min-choices.
    for (const response of [null, [], ["A"], ["A", "A", "A"], ["A", "B", "X"]]) {
      expect(
        validateQtiResponseVariables({ item: document.item, responses: { RESPONSE: response } }).ok,
      ).toBe(false);
    }
    for (const [response, expected] of [
      [["A", "B", "C"], 1],
      [["C", "A", "B"], 0],
    ] as const) {
      expect(
        validateQtiResponseVariables({
          item: document.item,
          responses: { RESPONSE: [...response] },
        }).diagnostics,
      ).toEqual([]);
      const session = createItemSession(document);
      session.respond("RESPONSE", [...response]);
      expect(session.score().outcomes.SCORE).toBe(expected);
    }
    expect(
      validateQtiResponseVariables({
        item: document.item,
        responses: { RESPONSE: ["A"] },
        allowIncompleteResponses: true,
      }).ok,
    ).toBe(true);
    const state = createItemSession(document).serialize();
    state.responses.RESPONSE = ["A", "A"];
    expect(() => createItemSession(document, state)).toThrow(/authored interaction domain/);
  },
);

it.each(["order", "graphic-order"] as const)(
  "[ASI-ORDER-SUBSET] validates %s subsets without duplicates",
  (type) => {
    const document = documentFor(type, 'min-choices="1" max-choices="2"');
    for (const response of [["A"], ["C", "B"]]) {
      expect(
        validateQtiResponseVariables({ item: document.item, responses: { RESPONSE: response } }).ok,
      ).toBe(true);
    }
    for (const response of [[], ["A", "B", "C"], ["A", "A"]]) {
      expect(
        validateQtiResponseVariables({ item: document.item, responses: { RESPONSE: response } }).ok,
      ).toBe(false);
    }
  },
);

it("requires only the visible choices in a generated order clone", () => {
  const document = documentFor("order", "", true);
  const session = createItemSession(document);
  const templateValues = session.serialize().templateValues;
  expect(
    validateQtiResponseVariables({
      item: document.item,
      templateValues,
      responses: { RESPONSE: ["B", "A"] },
    }).ok,
  ).toBe(true);
  expect(
    validateQtiResponseVariables({
      item: document.item,
      templateValues,
      responses: { RESPONSE: ["B", "A", "C"] },
    }).ok,
  ).toBe(false);
});

it("[ASI-ORDER-RESTORE] restores only the saved clone's visible order domain and rejects omitted clone context", () => {
  const document = documentFor("order", "", true);
  const state = createItemSession(document).serialize();
  expect(
    validateQtiResponseVariables({ item: document.item, responses: { RESPONSE: ["A", "B", "C"] } }),
  ).toMatchObject({ ok: false, diagnostics: [{ code: "response.templateValues.required" }] });
  state.responses.RESPONSE = ["C"];
  expect(() => createItemSession(document, state)).toThrow(/interaction domain/);
  state.responses.RESPONSE = ["B", "A"];
  expect(createItemSession(document, state).serialize().responses.RESPONSE).toEqual(["B", "A"]);
  state.responses.RESPONSE = ["B"];
  expect(createItemSession(document, state).serialize().responses.RESPONSE).toEqual(["B"]);
});
