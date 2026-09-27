import { validQtiDocument as validDocument } from "../../../tests/fixtures/valid-qti-document.js";
import { describe, expect, it } from "vitest";
import { createItemSession, isQtiAttemptStateV1, parseQtiXml, type QtiDocument } from "./index.js";

const numericOutcome =
  '<qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>';
const base = (type: string, value: string) =>
  `<qti-base-value base-type="${type}">${value}</qti-base-value>`;
const product = `<qti-product>${base("integer", "2147483647").repeat(34)}</qti-product>`;

function item(
  declarations: string,
  rules: string,
  template = false,
  body = "<p>Synthetic processing boundary fixture.</p>",
): string {
  return `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="boundaries" title="Processing boundaries" adaptive="false" time-dependent="false">
    ${declarations}
    ${template ? `<qti-template-processing>${rules}</qti-template-processing>` : ""}
    <qti-item-body>${body}</qti-item-body>
    ${template ? "" : `<qti-response-processing>${rules}</qti-response-processing>`}
  </qti-assessment-item>`;
}

function setScore(expression: string): string {
  return `<qti-set-outcome-value identifier="SCORE">${expression}</qti-set-outcome-value>`;
}

function expectRestorable(
  document: QtiDocument,
  session: ReturnType<typeof createItemSession>,
): void {
  const state = session.serialize();
  expect(isQtiAttemptStateV1(state)).toBe(true);
  const saved: unknown = JSON.parse(JSON.stringify(state));
  if (!isQtiAttemptStateV1(saved)) throw new Error("Invalid JSON state");
  expect(createItemSession(document, saved).serialize()).toEqual(state);
}

// QTI 3.0.1 §2.11 numerical operators; this engine's finite-number JSON value
// contract cannot represent overflow. It must diagnose that limit and remain restorable.
describe("numeric processing boundaries", () => {
  it.each([
    ["sum", `<qti-sum>${base("float", "1e308").repeat(2)}</qti-sum>`],
    [
      "subtract",
      `<qti-subtract>${base("float", "1e308")}${base("float", "-1e308")}</qti-subtract>`,
    ],
    ["product", `<qti-integer-to-float>${product}</qti-integer-to-float>`],
    [
      "roundTo",
      `<qti-round-to rounding-mode="significantFigures" figures="1">${base("float", "1.79e308")}</qti-round-to>`,
    ],
  ])("diagnoses %s overflow and preserves NULL through JSON restore", (_name, expression) => {
    const document = validDocument(item(numericOutcome, setScore(expression)));
    const session = createItemSession(document);
    const score = session.score();
    expect(score.outcomes.SCORE).toBeNull();
    expect(score.diagnostics).toContainEqual(
      expect.objectContaining({ code: "processing.numeric.nonFinite", severity: "error" }),
    );
    expectRestorable(document, session);
  });

  it("propagates overflowing operands through GCD without entering an unbounded loop", () => {
    // Fail before exercising GCD if the upstream overflow guard regresses.
    const guard = createItemSession(
      validDocument(
        item(numericOutcome, setScore(`<qti-integer-to-float>${product}</qti-integer-to-float>`)),
      ),
    ).score();
    expect(guard.outcomes.SCORE).toBeNull();
    const document = validDocument(
      item(
        numericOutcome.replace('base-type="float"', 'base-type="integer"'),
        setScore(`<qti-gcd>${product}${base("integer", "2")}</qti-gcd>`),
      ),
    );
    const session = createItemSession(document);
    expect(session.score().outcomes.SCORE).toBeNull();
    expectRestorable(document, session);
  });

  it("keeps large finite LCM results finite by dividing before multiplying", () => {
    const power = `<qti-product>${base("integer", "1073741824").repeat(20)}</qti-product>`;
    const expression = `<qti-lcm>${power}${power}</qti-lcm>`;
    const document = validDocument(
      item(
        numericOutcome.replace('base-type="float"', 'base-type="integer"'),
        setScore(expression),
      ),
    );
    const score = createItemSession(document).score();
    expect(score.outcomes.SCORE).toBe(2 ** 600);
    expect(score.diagnostics).toEqual([]);
    // Both operands are exact finite doubles, but their LCM exceeds the finite range.
    const scale = base("integer", "1073741824").repeat(33); // 2^990
    const left = `<qti-product>${scale}${base("integer", "1024")}</qti-product>`;
    const right = `<qti-product>${scale}${base("integer", "2147483647")}</qti-product>`;
    const overflowing = validDocument(
      item(
        numericOutcome.replace('base-type="float"', 'base-type="integer"'),
        setScore(`<qti-lcm>${left}${right}${base("integer", "2")}</qti-lcm>`),
      ),
    );
    const session = createItemSession(overflowing);
    const failed = session.score();
    expect(failed.outcomes.SCORE).toBeNull();
    expect(failed.diagnostics).toContainEqual(
      expect.objectContaining({ code: "processing.numeric.nonFinite" }),
    );
    expectRestorable(overflowing, session);
  });

  it("diagnoses template overflow and restores the generated NULL value", () => {
    const document = validDocument(
      item(
        '<qti-template-declaration identifier="T" cardinality="single" base-type="integer"/>',
        `<qti-set-template-value identifier="T">${product}</qti-set-template-value>`,
        true,
      ),
    );
    const session = createItemSession(document);
    expect(session.serialize().templateValues?.T).toBeNull();
    expect(session.score().diagnostics).toContainEqual(
      expect.objectContaining({ code: "processing.numeric.nonFinite" }),
    );
    expectRestorable(document, session);
  });
});

// QTI 3.0.1 §2.11.1.5–6: each mapping expression requires its own mapping.
// An answer key is not a substitute. Both mapping forms may coexist on a declaration.
describe("mapping contracts", () => {
  const mapping =
    '<qti-mapping default-value="0"><qti-map-entry map-key="10 10" mapped-value="3"/></qti-mapping>';
  const area =
    '<qti-area-mapping default-value="0"><qti-area-map-entry shape="rect" coords="0,0,20,20" mapped-value="7"/></qti-area-mapping>';
  const declaration = (maps: string) =>
    `<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="point"><qti-correct-response><qti-value>10 10</qti-value></qti-correct-response>${maps}</qti-response-declaration>`;

  it.each([
    ["qti-map-response", ""],
    ["qti-map-response", area],
    ["qti-map-response-point", ""],
    ["qti-map-response-point", mapping],
  ])("rejects %s when its mapping is missing", (operator, maps) => {
    const parsed = parseQtiXml(
      item(declaration(maps) + numericOutcome, setScore(`<${operator} identifier="RESPONSE"/>`)),
    );
    expect(parsed.ok).toBe(false);
    expect(parsed.diagnostics).toContainEqual(
      expect.objectContaining({ code: "processing.mapping.required", severity: "error" }),
    );
  });

  it.each([
    ["qti-map-response", "map_response", 3],
    ["qti-map-response-point", "map_response_point", 7],
  ])(
    "%s and its standard template select the requested mapping",
    (operator, template, expected) => {
      const xml = item(
        declaration(mapping + area) + numericOutcome,
        setScore(`<${operator} identifier="RESPONSE"/>`),
        false,
        '<qti-select-point-interaction response-identifier="RESPONSE" max-choices="1"><object data="image.png" type="image/png" width="100" height="100"/></qti-select-point-interaction>',
      );
      const templated = xml.replace(
        /<qti-response-processing>[\s\S]*<\/qti-response-processing>/,
        `<qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/${template}.xml"/>`,
      );
      for (const source of [xml, templated]) {
        const document = validDocument(source);
        const session = createItemSession(document);
        expect(session.score().outcomes.SCORE).toBe(0);
        session.respond("RESPONSE", "10 10");
        expect(session.score().outcomes.SCORE).toBe(expected);
        session.respond("RESPONSE", "50 50");
        expect(session.score().outcomes.SCORE).toBe(0);
      }
    },
  );

  it.each([false, true])("diagnoses mapping overflow (standard template: %s)", (template) => {
    const declarations =
      '<qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="identifier"><qti-mapping default-value="0"><qti-map-entry map-key="A" mapped-value="1e308"/><qti-map-entry map-key="B" mapped-value="1e308"/></qti-mapping></qti-response-declaration>' +
      numericOutcome;
    let xml = item(
      declarations,
      setScore('<qti-map-response identifier="RESPONSE"/>'),
      false,
      '<qti-choice-interaction response-identifier="RESPONSE" max-choices="2"><qti-simple-choice identifier="A">A</qti-simple-choice><qti-simple-choice identifier="B">B</qti-simple-choice></qti-choice-interaction>',
    );
    if (template)
      xml = xml.replace(
        /<qti-response-processing>[\s\S]*<\/qti-response-processing>/,
        '<qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/map_response.xml"/>',
      );
    const document = validDocument(xml);
    const session = createItemSession(document);
    session.respond("RESPONSE", ["A", "B"]);
    const score = session.score();
    expect(score.outcomes.SCORE).toBeNull();
    expect(score.diagnostics).toContainEqual(
      expect.objectContaining({ code: "processing.numeric.nonFinite" }),
    );
    expectRestorable(document, session);
  });
});

// QTI 3.0.1 §5.87–90: lookup rules set the declared outcome, whose base type
// governs both matching entry targets and the no-match default.
describe("lookup value contracts", () => {
  function lookup(type: string, target: string, fallback: string, table: string): string {
    return item(
      `<qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="${type}"><qti-${table}-table default-value="${fallback}"><qti-${table}-table-entry source-value="1" target-value="${target}"/></qti-${table}-table></qti-outcome-declaration>`,
      '<qti-lookup-outcome-value identifier="SCORE"><qti-base-value base-type="integer">1</qti-base-value></qti-lookup-outcome-value>',
    );
  }

  it.each(["match", "interpolation"])("rejects ill-typed %s targets and defaults", (table) => {
    const parsed = parseQtiXml(lookup("float", "identifier", "wrong", table));
    expect(parsed.ok).toBe(false);
    expect(parsed.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "declaration.lookupTargetValue.baseType",
          severity: "error",
        }),
        expect.objectContaining({
          code: "declaration.lookupDefaultValue.baseType",
          severity: "error",
        }),
      ]),
    );
  });

  it.each([
    ["integer", "0", "-2", 0, -2],
    ["boolean", "0", "1", false, true],
    ["string", "  spaced  ", " fallback ", "  spaced  ", " fallback "],
  ])("preserves valid %s targets and defaults", (type, target, fallback, match, missing) => {
    const xml = lookup(type, target, fallback, "interpolation");
    for (const [input, expected] of [
      ["1", match],
      ["0", missing],
    ]) {
      const document = validDocument(
        xml.replace('base-type="integer">1<', `base-type="integer">${input}<`),
      );
      const session = createItemSession(document);
      expect(session.score().outcomes.SCORE).toBe(expected);
      expectRestorable(document, session);
    }
  });
});
