import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createItemSession,
  isQtiAttemptStateV1,
  parseQtiXml,
  prepareQtiPresentation,
  validateAssessmentItem,
} from "./index.js";
import type { QtiDocument } from "./types.js";

import { SHUFFLE_INTERACTION_TYPES as types } from "./presentation-definition.js";
function xml(type = "order"): string {
  return readFileSync(new URL(`../../fixtures/xml/shuffle/${type}.xml`, import.meta.url), "utf8");
}
function document(source = xml()): QtiDocument {
  const parsed = parseQtiXml(source);
  if (!parsed.document) throw new Error("Expected fixture to parse");
  return parsed.document;
}
function presentation(doc: QtiDocument, seed: string | number = 31) {
  const session = createItemSession(doc, undefined, { presentationSeed: seed });
  const result = session.presentation();
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return { session, ...result };
}

describe("attempt presentation", () => {
  it.each(types)("shuffles %s without changing authored choices, responses or scoring", (type) => {
    const doc = document(xml(type));
    expect(validateAssessmentItem(doc).diagnostics).toEqual([]);
    const original = structuredClone(doc);
    const { session, state, interactions } = presentation(doc);
    expect(doc).toEqual(original);
    expect(session.serialize().responses).toEqual({});
    expect(session.serialize().builtInVariables?.numAttempts).toBe(0);
    expect(session.serialize().status).toBe("initialized");
    expect(Object.keys(state.orders).length).toBeGreaterThan(0);
    for (const [index, interaction] of interactions.entries()) {
      const authored = doc.item.interactions[index];
      expect(interaction.choices.map((choice) => choice.identifier).toSorted()).toEqual(
        authored?.choices.map((choice) => choice.identifier).toSorted(),
      );
      if (type !== "gapMatch")
        expect(interaction.choices.findIndex((choice) => choice.identifier === "B")).toBe(
          authored?.choices.findIndex((choice) => choice.identifier === "B") ?? -1,
        );
    }
    const baseline = createItemSession(doc);
    for (const declaration of doc.item.responseDeclarations) {
      session.respond(declaration.identifier, declaration.correctResponse);
      baseline.respond(declaration.identifier, declaration.correctResponse);
    }
    expect(session.score().outcomes).toEqual(baseline.score().outcomes);
    expect(session.score().state.presentation).toEqual(state);
  });

  it("is reproducible, varies across seeds, and keeps fixed choices at their positions", () => {
    const doc = document();
    const first = presentation(doc, 31);
    expect(presentation(doc, 31).state).toEqual(first.state);
    const orders = Array.from({ length: 30 }, (_, seed) =>
      presentation(doc, seed).interactions[0]?.choices.map((choice) => choice.identifier),
    );
    expect(new Set(orders.map((order) => JSON.stringify(order))).size).toBeGreaterThan(1);
    for (const order of orders) expect(order?.[1]).toBe("B");
  });

  it.each(["false", "0"])("preserves source order for shuffle=%s", (value) => {
    const doc = document(xml().replace('shuffle="true"', `shuffle="${value}"`));
    const result = createItemSession(doc).presentation();
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.interactions[0]?.choices).toEqual(doc.item.interactions[0]?.choices);
  });
  it("accepts numeric XML booleans and leaves all-fixed sets unchanged", () => {
    const doc = document(
      xml().replace('shuffle="true"', 'shuffle="1"').replaceAll('fixed="true"', 'fixed="1"'),
    );
    expect(presentation(doc).interactions[0]?.choices[1]?.identifier).toBe("B");
    const allFixed = document(
      xml()
        .replaceAll(' fixed="true"', "")
        .replaceAll("<qti-simple-choice ", '<qti-simple-choice fixed="true" '),
    );
    expect(presentation(allFixed).interactions[0]?.choices).toEqual(
      allFixed.item.interactions[0]?.choices,
    );
  });
  it("does not invent presentation randomness for headless scoring", () => {
    const session = createItemSession(document());
    expect(session.presentation()).toMatchObject({
      ok: false,
      diagnostics: [{ code: "presentation.order.invalid" }],
    });
    expect(session.serialize().presentation).toBeUndefined();
    expect(session.score().diagnostics).toEqual([]);
  });
  it("restores unanswered and answered presentations without the original seed", () => {
    const doc = document();
    const { session, state } = presentation(doc);
    expect(createItemSession(doc, session.serialize()).presentation()).toMatchObject({
      ok: true,
      state,
    });
    session.respond("RESPONSE", ["D", "A", "B", "C"]);
    session.setStatus("suspended");
    const saved = session.serialize();
    const resumed = createItemSession(doc, saved, { presentationSeed: "ignored-on-restore" });
    expect(resumed.presentation()).toMatchObject({ ok: true, state });
    expect(resumed.serialize().responses).toEqual({ RESPONSE: ["D", "A", "B", "C"] });
    // State ownership is independent of the caller's objects, including order arrays.
    const key = Object.keys(state.orders)[0];
    if (!key || !saved.presentation) throw new Error("Expected saved order");
    Object.defineProperty(saved.presentation.orders, key, { value: ["forged"] });
    expect(resumed.serialize().presentation).toEqual(state);
  });
  it.each([
    undefined,
    { schema: "qti3.presentation.v0", orders: {} },
    { schema: "qti3.presentation.v1", orders: {} },
    {
      schema: "qti3.presentation.v1",
      orders: { "0:order:RESPONSE:choices": ["A", "A", "C", "D"] },
    },
    {
      schema: "qti3.presentation.v1",
      orders: { "0:order:RESPONSE:choices": ["B", "A", "C", "D"] },
    },
    {
      schema: "qti3.presentation.v1",
      orders: { "0:order:RESPONSE:choices": ["A", "B", "X", "D"] },
    },
    { schema: "qti3.presentation.v1", orders: { "0:order:RESPONSE:choices": ["A", "B", "C"] } },
  ])("rejects missing, malformed or incompatible restored orders: %j", (state) => {
    expect(prepareQtiPresentation(document().item, {}, { kind: "restore", state }).ok).toBe(false);
  });
  it("rejects unknown groups and malformed public attempt state", () => {
    const { session, state } = presentation(document());
    expect(
      prepareQtiPresentation(
        document().item,
        {},
        {
          kind: "restore",
          state: { ...state, orders: { ...state.orders, unknown: [], toString: [] } },
        },
      ).ok,
    ).toBe(false);
    expect(
      isQtiAttemptStateV1({
        ...session.serialize(),
        presentation: { schema: "qti3.presentation.v1", orders: { bad: [1] } },
      }),
    ).toBe(false);
  });
  it("keeps match sets separate and gap targets at their authored positions", () => {
    const match = presentation(document(xml("match"))).interactions[0];
    expect(
      match?.choices
        .filter((choice) => choice.role === "matchSource")
        .map((choice) => choice.identifier)
        .toSorted(),
    ).toEqual(["A", "B", "C", "D"]);
    expect(
      match?.choices
        .filter((choice) => choice.role === "matchTarget")
        .map((choice) => choice.identifier)
        .toSorted(),
    ).toEqual(["G1", "G2", "G3", "G4"]);
    const gap = presentation(document(xml("gapMatch"))).interactions[0];
    expect(
      gap?.choices.filter((choice) => choice.role === "gap").map((choice) => choice.identifier),
    ).toEqual(["G1", "G2"]);
  });
  it("filters template-hidden choices before fixing positions and saving orders", () => {
    const source = xml().replace(
      '<qti-simple-choice identifier="A">',
      '<qti-simple-choice identifier="A" template-identifier="VISIBLE">',
    );
    const item = document(source).item;
    const result = prepareQtiPresentation(item, { VISIBLE: "C" }, { kind: "new", seed: 31 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.interactions[0]?.choices.map((choice) => choice.identifier)).not.toContain("A");
    expect(result.interactions[0]?.choices[0]?.identifier).toBe("B");
    expect(
      prepareQtiPresentation(item, { VISIBLE: "C" }, { kind: "restore", state: result.state }).ok,
    ).toBe(true);
    expect(
      prepareQtiPresentation(item, { VISIBLE: "A" }, { kind: "restore", state: result.state }).ok,
    ).toBe(false);
  });
  it("reads effective order defaults without answering and preserves explicit null", () => {
    const doc = document(
      xml().replace(
        "<qti-correct-response>",
        "<qti-default-value><qti-value>D</qti-value><qti-value>C</qti-value><qti-value>B</qti-value><qti-value>A</qti-value></qti-default-value><qti-correct-response>",
      ),
    );
    const { session } = presentation(doc);
    expect(session.presentationResponse("RESPONSE")).toEqual(["D", "C", "B", "A"]);
    expect(session.serialize().responses).toEqual({});
    session.respond("RESPONSE", null);
    expect(session.presentationResponse("RESPONSE")).toBeNull();
  });
  it("does not consume the template/response processing random stream", () => {
    const doc = document(
      xml().replace(
        '<qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>',
        '<qti-response-processing><qti-set-outcome-value identifier="SCORE"><qti-random-integer min="0" max="100000"/></qti-set-outcome-value></qti-response-processing>',
      ),
    );
    const a = createItemSession(doc, undefined, { randomSeed: 123, presentationSeed: 1 });
    const b = createItemSession(doc, undefined, { randomSeed: 123, presentationSeed: 999 });
    const scored = a.score();
    expect(scored.diagnostics).toEqual([]);
    expect(scored.outcomes.SCORE).toBeGreaterThan(0);
    expect(scored.outcomes).toEqual(b.score().outcomes);
    expect(a.score().outcomes).toEqual(b.score().outcomes);
  });
  it.each([
    ['shuffle="true"', 'shuffle="banana"'],
    ['fixed="true"', 'fixed="banana"'],
    ['fixed="true"', 'qti-fixed="true"'],
  ])("reports invalid presentation attributes (%s → %s)", (before, after) => {
    const doc = document(xml().replace(before, after));
    expect(validateAssessmentItem(doc).ok).toBe(false);
    expect(createItemSession(doc, undefined, { presentationSeed: 1 }).presentation().ok).toBe(
      false,
    );
  });
  it("diagnoses fixed on gap choices instead of inventing extension semantics", () => {
    const doc = document(xml("gapMatch").replace("<qti-gap-text ", '<qti-gap-text fixed="true" '));
    expect(validateAssessmentItem(doc).diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "interaction.presentation.unsupportedAttribute" }),
      ]),
    );
  });
});

it("reports an invalid seed once for an item with multiple shuffle groups", () => {
  const result = prepareQtiPresentation(
    document(xml("match")).item,
    {},
    { kind: "new", seed: Infinity },
  );
  expect(result).toEqual({
    ok: false,
    diagnostics: [
      {
        code: "presentation.order.invalid",
        severity: "error",
        message: "presentationSeed must be finite.",
      },
    ],
  });
});
