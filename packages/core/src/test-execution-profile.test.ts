import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parseQtiTest, parseQtiTestExecution } from "./test-parser.js";
import { startQtiTest, submitQtiTestAnswer } from "./test-session.js";
import { validateQtiTest } from "./test-validation.js";

// QTI 3.0.1 ASI §§4.2,4.4,5.6,5.159,7.48,7.50: test structure, modes and reference semantics.
// https://www.imsglobal.org/sites/default/files/spec/qti/v3/info/imsqti_asi_v3p0p1_infomodel_v1p0.html
// These exact source fixtures also run through the pinned official schema gate.
const fixture = (name: string) =>
  readFileSync(
    new URL(`../../../tests/fixtures/test-profile/${name}.xml`, import.meta.url),
    "utf8",
  );

it.each([
  ["nonlinear", "test.mode"],
  ["simultaneous", "test.mode"],
  ["multiple-parts", "test.mode"],
  ["nested-section", "test.xml.unsupported"],
  ["section-reference", "test.xml.unsupported"],
  ["invisible-section", "test.xml.unsupported"],
  ["split-section", "test.xml.unsupported"],
  ["weight", "test.xml.unsupported"],
  ["mapping", "test.xml.unsupported"],
  ["template-default", "test.xml.unsupported"],
  ["selection", "test.xml.unsupported"],
  ["ordering", "test.xml.unsupported"],
])(
  "[ASI-TEST-PROFILE-REJECTION] refuses %s consistently at both execution entry points",
  (name, code) => {
    for (const parse of [parseQtiTest, parseQtiTestExecution]) {
      const result = parse(fixture(name));
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error(`Accepted unsupported ${name}`);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({ code, severity: "error" }),
      );
    }
  },
);

it("[ASI-TEST-PROFILE-POSITIVE] preserves the supported fixed route and trusted submissions", () => {
  const xml = fixture("fixed");
  expect(parseQtiTestExecution(xml)).toEqual({ ok: true, value: { kind: "fixed" } });
  const parsed = parseQtiTest(xml);
  if (!parsed.ok) throw new Error("Expected executable test");
  expect(validateQtiTest(parsed.value).ok).toBe(true);
  expect(parsed.value.sections[0]).toMatchObject({
    identifier: "S",
    title: "Section",
    items: [
      { identifier: "I", href: "items/one.xml", categories: ["group"] },
      { identifier: "J", href: "items/two.xml", categories: ["other"] },
    ],
  });
  const first = submitQtiTestAnswer(parsed.value, startQtiTest(parsed.value), {
    itemRef: "I",
    score: 1,
  });
  expect(first).toMatchObject({
    ok: true,
    value: { status: "active", currentItemRef: "J", outcomes: {} },
  });
  if (!first.ok) throw new Error("Expected first submission");
  expect(submitQtiTestAnswer(parsed.value, first.value, { itemRef: "J", score: 0 })).toMatchObject({
    ok: true,
    value: {
      status: "completed",
      outcomes: {},
      submissions: [
        { itemRef: "I", score: 1 },
        { itemRef: "J", score: 0 },
      ],
    },
  });
});

// §2.9 and §4.5: defaulted test outcomes still exist without any outcome rules.
it("[ASI-TEST-DEFAULT-OUTCOME] retains outcome defaults without inventing aggregation", () => {
  const classified = parseQtiTestExecution(fixture("default-outcome"));
  expect(classified.ok).toBe(true);
  if (!classified.ok || classified.value.kind !== "sequenced")
    throw new Error("Expected outcome runtime");
  const test = classified.value.test;
  expect(validateQtiTest(test).ok).toBe(true);
  const started = startQtiTest(test);
  expect(started.outcomes).toEqual({ TOTAL: 7 });
  const submitted = submitQtiTestAnswer(test, started, { itemRef: "I", score: 3.5 });
  expect(submitted).toMatchObject({
    ok: true,
    value: { outcomes: { TOTAL: 7 }, currentItemRef: "J" },
  });
});

// Intentionally malformed inputs are separate from the schema-valid unsupported fixtures above.
it.each([
  ["missing test identifier", ' identifier="T"', ""],
  ["missing test title", ' title="Test"', ""],
  ["missing part identifier", ' identifier="P"', ""],
  ["missing navigation mode", ' navigation-mode="linear"', ""],
  ["missing submission mode", ' submission-mode="individual"', ""],
  ["missing section identifier", ' identifier="S"', ""],
  ["missing section title", ' title="Section"', ""],
  ["missing section visibility", ' visible="true"', ""],
  ["invalid visibility", 'visible="true"', 'visible="yes"'],
  ["missing item identifier", ' identifier="I"', ""],
  ["duplicate item identifier", 'identifier="J"', 'identifier="I"'],
  ["invalid item identifier", 'identifier="I"', 'identifier="1bad"'],
  ["missing item href", ' href="items/one.xml"', ""],
  ["unsafe item href", 'href="items/one.xml"', 'href="../one.xml"'],
])("[ASI-TEST-PROFILE-INVALID] rejects %s without a runtime trigger", (_name, old, replacement) => {
  const xml = fixture("fixed").replace(old, replacement);
  for (const parse of [parseQtiTest, parseQtiTestExecution]) expect(parse(xml).ok).toBe(false);
});

it.each([
  ["test", "qti-assessment-test"],
  ["part", "qti-test-part"],
  ["section", "qti-assessment-section"],
  ["reference", "qti-assessment-item-ref"],
])(
  "[ASI-TEST-PROFILE-EXTENSIONS] rejects unimplemented %s extensions without interpreting their names",
  (_name, element) => {
    const base = fixture("fixed");
    for (const attrs of [' unknown="value"', ' xmlns:e="urn:example" e:required="true"']) {
      const result = parseQtiTestExecution(base.replace(`<${element} `, `<${element}${attrs} `));
      expect(result).toMatchObject({
        ok: false,
        diagnostics: expect.arrayContaining([
          expect.objectContaining({ code: "test.xml.unsupported" }),
        ]),
      });
    }
  },
);

it("[ASI-TEST-PROFILE-DIAGNOSTICS] retains root errors when part modes also fail", () => {
  const xml = fixture("nonlinear").replace(
    "<qti-assessment-test ",
    '<qti-assessment-test unsupported="true" ',
  );
  for (const parse of [parseQtiTest, parseQtiTestExecution]) {
    expect(parse(xml)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "test.xml.unsupported" }, { code: "test.mode" }],
    });
  }
});

// Adding outcome semantics must not change whether an unsupported feature is accepted.
it.each([
  "nonlinear",
  "simultaneous",
  "multiple-parts",
  "nested-section",
  "section-reference",
  "invisible-section",
  "split-section",
  "weight",
  "mapping",
  "template-default",
  "selection",
  "ordering",
])(
  "[ASI-TEST-PROFILE-ROUTING] execution acceptance is independent of outcome routing: %s",
  (name) => {
    const xml = fixture(name);
    const declaration =
      '<qti-outcome-declaration identifier="TOTAL" cardinality="single" base-type="float"><qti-default-value><qti-value>7</qti-value></qti-default-value></qti-outcome-declaration>';
    const withOutcome = xml.replace("<qti-test-part ", `${declaration}<qti-test-part `);
    expect(withOutcome).not.toBe(xml);
    for (const parse of [parseQtiTest, parseQtiTestExecution]) {
      const plain = parse(xml);
      const routed = parse(withOutcome);
      expect(plain.ok).toBe(false);
      expect(routed.ok).toBe(false);
      if (plain.ok || routed.ok) throw new Error("Unsupported route accepted");
      expect(routed.diagnostics.map(({ code, severity }) => ({ code, severity }))).toEqual(
        plain.diagnostics.map(({ code, severity }) => ({ code, severity })),
      );
    }
  },
);
