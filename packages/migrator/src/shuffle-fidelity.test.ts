import { createItemSession, parseQtiXml } from "@longsightgroup/qti3-core";
import { expect, it } from "vitest";
import { migrateQtiItemToQti3 } from "./index.js";

function response(responseIdentifier: string, shuffle: string, tag = "response_lid") {
  const labels = ["A", "B", "C"]
    .map(
      (id) =>
        `<response_label ident="${id}" ${id === "C" ? 'rshuffle="No"' : ""}><material><mattext>${id}</mattext></material></response_label>`,
    )
    .join("");
  return `<${tag} ident="${responseIdentifier}"><render_choice ${shuffle ? `shuffle="${shuffle}"` : ""}>${labels}</render_choice></${tag}>`;
}
function legacy(body: string, key = '<varequal respident="R">A</varequal>') {
  return `<item ident="shuffle" title="Shuffle"><presentation>${body}</presentation>${key ? `<resprocessing><respcondition><conditionvar>${key}</conditionvar><setvar action="Set" varname="SCORE">1</setvar></respcondition></resprocessing>` : ""}</item>`;
}
const matchKey = '<varequal respident="R">A</varequal><varequal respident="S">B</varequal>';

it.each(["response_lid", "response_grp"])("preserves shuffle and pinned choices for %s", (tag) => {
  const result = migrateQtiItemToQti3({
    xml: legacy(
      response("R", "Yes", tag),
      `<varequal respident="R">${tag === "response_grp" ? "A B" : "A"}</varequal>`,
    ),
  });
  expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(result.authoringItem).toMatchObject({
    shuffle: true,
    choices: [
      { identifier: "A", fixed: false },
      { identifier: "B", fixed: false },
      { identifier: "C", fixed: true },
    ],
  });
  expect(result.xml).toContain('shuffle="true"');
  expect(result.xml).toContain('fixed="true"');
  if (!result.xml) throw new Error("Expected migrated XML");
  const parsed = parseQtiXml(result.xml);
  if (!parsed.document) throw new Error("Expected parsed migration");
  const orders = new Set<string>();
  for (let seed = 0; seed < 12; seed++) {
    const session = createItemSession(parsed.document, undefined, { presentationSeed: seed });
    const presentation = session.presentation();
    if (!presentation.ok) throw new Error("Expected presentation");
    const choices = presentation.interactions[0]?.choices ?? [];
    expect(choices[2]?.identifier).toBe("C");
    orders.add(choices.map((choice) => choice.identifier).join(","));
    expect(createItemSession(parsed.document, session.serialize()).presentation()).toEqual(
      presentation,
    );
  }
  expect(orders.size).toBeGreaterThan(1);
});

it.each(["No", ""])("keeps unshuffled QTI 1.2 defaults (%s)", (shuffle) => {
  expect(migrateQtiItemToQti3({ xml: legacy(response("R", shuffle)) }).authoringItem).toMatchObject(
    { shuffle: false },
  );
});

it("does not infer an answer key from a pinned distractor", () => {
  const result = migrateQtiItemToQti3({ xml: legacy(response("R", "Yes"), "") });
  expect(result.xml).toBeUndefined();
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({ code: "qti12_choice_correct_response_missing", severity: "error" }),
  );
});

it("preserves Canvas target shuffle while fixing source positions", () => {
  const result = migrateQtiItemToQti3({
    xml: legacy(response("R", "Yes") + response("S", "Yes"), matchKey),
  });
  expect(result.authoringItem).toMatchObject({
    interactionType: "match",
    shuffle: true,
    sources: [{ fixed: true }, { fixed: true }],
    targets: [{ fixed: false }, { fixed: false }, { fixed: true }],
  });
  expect(result.xml).toContain('shuffle="true"');
  if (!result.xml) throw new Error("Expected migrated XML");
  const parsed = parseQtiXml(result.xml);
  if (!parsed.document) throw new Error("Expected parsed migration");
  const orders = new Set<string>();
  for (let seed = 0; seed < 12; seed++) {
    const session = createItemSession(parsed.document, undefined, { presentationSeed: seed });
    const presentation = session.presentation();
    if (!presentation.ok) throw new Error("Expected presentation");
    const identifiers =
      presentation.interactions[0]?.choices.map((choice) => choice.identifier) ?? [];
    expect(identifiers.slice(0, 2)).toEqual(["R", "S"]);
    expect(identifiers[4]).toBe("C");
    orders.add(identifiers.join(","));
    expect(createItemSession(parsed.document, session.serialize()).presentation()).toEqual(
      presentation,
    );
  }
  expect(orders.size).toBeGreaterThan(1);
});

it.each(["shuffle", "fixed"])("rejects incompatible Canvas %s settings", (kind) => {
  const second =
    kind === "shuffle"
      ? response("S", "No")
      : response("S", "Yes").replace('rshuffle="No"', 'rshuffle="Yes"');
  const result = migrateQtiItemToQti3({ xml: legacy(response("R", "Yes") + second, matchKey) });
  expect(result.xml).toBeUndefined();
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({ code: "qti12_canvas_match_shuffle_conflict", severity: "error" }),
  );
});

it.each(["true", "1", "false", "0", ""])(
  "diagnoses unsupported graphic gap shuffle=%s",
  (shuffle) => {
    const result = migrateQtiItemToQti3({
      xml: `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="graphic" title="Graphic" adaptive="false" timeDependent="false"><responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair"><correctResponse><value>A G</value></correctResponse></responseDeclaration><itemBody><graphicGapMatchInteraction responseIdentifier="RESPONSE" ${shuffle ? `shuffle="${shuffle}"` : ""}><object data="diagram.png" type="image/png" width="100" height="100"/><gapText identifier="A" matchMax="1">Alpha</gapText><associableHotspot identifier="G" shape="rect" coords="0,0,50,50" matchMax="1"/></graphicGapMatchInteraction></itemBody></assessmentItem>`,
    });
    if (!shuffle) {
      expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
      expect(result.xml).toBeDefined();
      return;
    }
    expect(result.xml).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "qti2_graphic_gap_shuffle_unsupported", severity: "error" }),
    );
  },
);
