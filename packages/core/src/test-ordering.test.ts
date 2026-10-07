import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { assertQtiXmlSchema } from "../../../tests/fixtures/valid-qti-document.js";
import { requireTestResult } from "../../../tests/fixtures/test-result.js";
import { parseQtiFixedTestOrdering, prepareQtiFixedTestOrder } from "./test-ordering.js";

const source = readFileSync(
  new URL(
    "../../../tests/fixtures/test-profile/fixed-ordering-multiple-parts.xml",
    import.meta.url,
  ),
  "utf8",
);
const definition = () => {
  assertQtiXmlSchema(source);
  return requireTestResult(parseQtiFixedTestOrdering(source));
};
const order = (seed: string | number = "attempt-1") =>
  requireTestResult(prepareQtiFixedTestOrder(definition(), { kind: "new", seed }));

it("[ASI-FIXED-ORDER] preserves part/section boundaries, fixed slots and the canonical definition", () => {
  const parsed = definition();
  const before = JSON.stringify(parsed);
  const distinct = new Set<string>();
  for (let seed = 0; seed < 100; seed++) {
    const result = requireTestResult(prepareQtiFixedTestOrder(parsed, { kind: "new", seed }));
    expect(
      result.sections.map(({ partIdentifier, sectionIdentifier }) => [
        partIdentifier,
        sectionIdentifier,
      ]),
    ).toEqual([
      ["P1", "S1"],
      ["P1", "S2"],
      ["P2", "S3"],
    ]);
    expect(result.sections[0]?.itemRefs[1]).toBe("B");
    const first = result.sections[0];
    const third = result.sections[2];
    if (!first || !third) throw new Error("Expected all authored sections.");
    expect(first.itemRefs.toSorted()).toEqual(["A", "B", "C", "D"]);
    expect(result.sections[1]?.itemRefs).toEqual(["E", "F"]);
    expect(third.itemRefs.toSorted()).toEqual(["G", "H", "I"]);
    distinct.add(JSON.stringify(result.sections[0]?.itemRefs));
  }
  expect(distinct.size).toBe(6);
  expect(JSON.stringify(parsed)).toBe(before);
});

it("[ASI-FIXED-ORDER] restores exact saved permutations from JSON without a seed or regeneration", () => {
  const saved = order();
  const encoded: unknown = JSON.parse(JSON.stringify(saved));
  const restored = requireTestResult(
    prepareQtiFixedTestOrder(definition(), { kind: "restore", state: encoded }),
  );
  expect(restored).toEqual(saved);
  expect(restored).not.toBe(encoded);
  expect(restored.sections[0]?.itemRefs).not.toBe(saved.sections[0]?.itemRefs);
  expect(order("attempt-1")).toEqual(saved);
});

it.each([undefined, NaN, Infinity, -Infinity])(
  "refuses missing or nonfinite entropy instead of silently choosing authored order: %s",
  (seed) => {
    expect(prepareQtiFixedTestOrder(definition(), { kind: "new", seed })).toMatchObject({
      ok: false,
      diagnostics: [{ code: "test.ordering.seed" }],
    });
  },
);

it("authored ordering requires no shuffle seed and rejects reordered restored content", () => {
  const xml = source
    .replaceAll('shuffle="true"', 'shuffle="false"')
    .replaceAll('shuffle="1"', 'shuffle="0"');
  assertQtiXmlSchema(xml);
  const parsed = requireTestResult(parseQtiFixedTestOrdering(xml));
  const saved = requireTestResult(
    prepareQtiFixedTestOrder(parsed, { kind: "new", seed: undefined }),
  );
  expect(saved.sections[0]?.itemRefs).toEqual(["A", "B", "C", "D"]);
  const changed = {
    ...saved,
    sections: saved.sections.map((section, index) =>
      index === 0 ? { ...section, itemRefs: ["C", "B", "A", "D"] } : section,
    ),
  };
  expect(prepareQtiFixedTestOrder(parsed, { kind: "restore", state: changed }).ok).toBe(false);
});

it.each([
  ["fixed slot", ["B", "A", "C", "D"]],
  ["duplicate", ["A", "B", "C", "C"]],
  ["foreign item", ["E", "B", "C", "D"]],
  ["missing item", ["A", "B", "C"]],
  ["extra item", ["A", "B", "C", "D", "E"]],
  ["non-string", ["A", "B", null, "D"]],
])("rejects invalid persisted section order: %s", (_label, itemRefs) => {
  const saved = order();
  const changed = {
    ...saved,
    sections: saved.sections.map((section, index) =>
      index === 0 ? { ...section, itemRefs } : section,
    ),
  };
  expect(prepareQtiFixedTestOrder(definition(), { kind: "restore", state: changed })).toMatchObject(
    { ok: false, diagnostics: [{ code: "test.ordering.state" }] },
  );
});

it.each([
  (saved: ReturnType<typeof order>) => ({ ...saved, schema: "unknown" }),
  (saved: ReturnType<typeof order>) => ({ ...saved, testIdentifier: "other" }),
  (saved: ReturnType<typeof order>) => ({ ...saved, extra: true }),
  (saved: ReturnType<typeof order>) => ({ ...saved, sections: saved.sections.toReversed() }),
  (saved: ReturnType<typeof order>) => ({ ...saved, sections: saved.sections.slice(1) }),
  (saved: ReturnType<typeof order>) => ({
    ...saved,
    sections: saved.sections.map((section, index) =>
      index === 1 ? { ...section, itemRefs: ["F", "E"] } : section,
    ),
  }),
  (saved: ReturnType<typeof order>) => ({
    ...saved,
    sections: saved.sections.map((section, index) =>
      index === 0 ? { ...section, partIdentifier: "P2" } : section,
    ),
  }),
])("rejects stale, cross-part and structurally invalid order snapshots", (change) => {
  expect(
    prepareQtiFixedTestOrder(definition(), { kind: "restore", state: change(order()) }).ok,
  ).toBe(false);
});

it.each([
  source.replace('<qti-ordering shuffle="true"/>', '<qti-ordering shuffle="yes"/>'),
  source.replace(
    '<qti-ordering shuffle="true"/>',
    '<qti-ordering shuffle="true"/><qti-ordering shuffle="false"/>',
  ),
  source.replace(
    '<qti-ordering shuffle="true"/>',
    '<qti-ordering shuffle="true" custom="ignored"/>',
  ),
  source.replace(
    '<qti-ordering shuffle="true"/>',
    '<qti-ordering shuffle="true"><qti-custom/></qti-ordering>',
  ),
  source.replace('<qti-ordering shuffle="true"/>', '<qti-selection select="1"/>'),
  source.replace(
    '<qti-ordering shuffle="true"/>',
    '<qti-pre-condition><qti-base-value base-type="boolean">true</qti-base-value></qti-pre-condition>',
  ),
  source.replace(
    '<qti-ordering shuffle="true"/>',
    '<qti-branch-rule target="EXIT_TEST"><qti-base-value base-type="boolean">true</qti-base-value></qti-branch-rule>',
  ),
  source.replace(
    '<qti-ordering shuffle="true"/>',
    '<qti-assessment-section identifier="NESTED" title="Nested" visible="true"/>',
  ),
  source.replace('fixed="true"', 'fixed="yes"'),
  source.replace('identifier="C"', 'identifier="A"'),
  source.replace('href="items/c.xml"', 'href="../outside.xml"'),
  source.replace('visible="true"', 'visible="false"'),
  source.replace('visible="true"', 'visible="true" keep-together="false"'),
  source.replace(
    '<qti-ordering shuffle="true"/>',
    '<qti-ordering xmlns="urn:foreign" shuffle="true"/>',
  ),
])("refuses unsupported or invalid fixed ordering rather than ignoring it", (xml) => {
  expect(parseQtiFixedTestOrdering(xml).ok).toBe(false);
});
