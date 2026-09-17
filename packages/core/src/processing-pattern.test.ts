import { describe, expect, it } from "vitest";
import {
  createItemSession,
  isQtiAttemptStateV1,
  parseQtiXml,
  serializeResponseProcessing,
} from "./index.js";

function xmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;")
    .replaceAll("\r", "&#13;")
    .replaceAll("\n", "&#10;")
    .replaceAll("\t", "&#9;");
}
function item(pattern: string, value: string | null, declarations = ""): string {
  return `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="pattern" title="Pattern" time-dependent="false">
    <qti-outcome-declaration identifier="RESULT" cardinality="single" base-type="boolean"/>
    ${declarations}
    <qti-item-body><p>Evaluate an XML Schema pattern.</p></qti-item-body>
    <qti-response-processing><qti-set-outcome-value identifier="RESULT">
      <qti-pattern-match pattern="${xmlText(pattern)}">${value === null ? "<qti-null/>" : `<qti-base-value base-type="string">${xmlText(value)}</qti-base-value>`}</qti-pattern-match>
    </qti-set-outcome-value></qti-response-processing>
  </qti-assessment-item>`;
}
function score(pattern: string, value: string | null, declarations = "") {
  const parsed = parseQtiXml(item(pattern, value, declarations));
  expect(parsed.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  if (!parsed.document) throw new Error("Expected pattern item.");
  return createItemSession(parsed.document).score();
}
function variable(pattern: string | null): string {
  return `<qti-template-declaration identifier="PATTERN" cardinality="single" base-type="string">${pattern === null ? "" : `<qti-default-value><qti-value>${xmlText(pattern)}</qti-value></qti-default-value>`}</qti-template-declaration>`;
}

const cases: [string, string, boolean][] = [
  [String.raw`\i\c*`, "Alpha", true],
  [String.raw`\i\c*`, "éclair:part-2", true],
  [String.raw`[\i-[:]][\c-[:]]*`, "valid_name-2", true],
  [String.raw`[\i-[:]][\c-[:]]*`, "prefix:name", false],
  [String.raw`\i\c*`, "2Alpha", false],
  [String.raw`\I\C`, "3!", true],
  [String.raw`\I`, "A", false],
  [String.raw`\C`, "-", false],
  [String.raw`\p{L}+`, "Αλφαé漢", true],
  [String.raw`\p{Lu}\p{Ll}+`, "Éclair", true],
  [String.raw`\p{M}`, "\u0301", true],
  [String.raw`\p{N}+`, "٢Ⅲ", true],
  [String.raw`\p{S}+`, "+😀", true],
  [String.raw`\p{IsGreek}+`, "Αλφα", true],
  [String.raw`\p{IsGreekandCoptic}+`, "Αλφα", true],
  [String.raw`\p{IsBasicLatin}+`, "Alpha", true],
  [String.raw`\p{IsBasicLatin}+`, "é", false],
  [String.raw`\P{IsBasicLatin}`, "😀", true],
  [String.raw`\p{IsEmoticons}`, "😀", true],
  [String.raw`\p{IsCombiningMarksforSymbols}`, "\u20d0", true],
  [String.raw`\p{IsSpecials}`, "\ufeff", true],
  [String.raw`\p{IsPrivateUse}`, "\ue000", true],
  [String.raw`\P{L}+`, "123!", true],
  [String.raw`\d+`, "٢٣", true],
  [String.raw`\D`, "٢", false],
  [String.raw`\s+`, " \t\r\n", true],
  [String.raw`\s`, "\u00a0", false],
  [String.raw`\S`, "\u00a0", true],
  [String.raw`\w+`, "漢é+😀", true],
  [String.raw`\w`, "_", false],
  [String.raw`\W`, "_", true],
  [".", "\u2028", true],
  [".", "\n", false],
  [".", "\r", false],
  [".", "😀", true],
  ["[a-z-[aeiou]]+", "rhythm", true],
  ["[a-z-[aeiou]]+", "hello", false],
  ["[a-z-[d-w-[m-o]]]+", "abmnoxyz", true],
  ["[a-z-[d-w-[m-o]]]+", "e", false],
  ["[^a-[b]]", "c", true],
  ["[^a-[b]]", "a", false],
  ["[^a-[b]]", "b", false],
  [String.raw`[\p{L}-[\p{IsBasicLatin}]]+`, "é漢", true],
  [String.raw`[\p{L}-[\p{IsBasicLatin}]]+`, "Alpha", false],
  [String.raw`[\p{L}\d_]+`, "é_٣", true],
  [String.raw`\[\]\{\}\(\)\+\*\?\.\|\-\^\\`, "[]{}()+*?.|-^\\", true],
  ["^Alpha$", "Alpha", false],
  ["^Alpha$", "^Alpha$", true],
  ["Alpha", "xAlphax", false],
  ["Alpha", "Alpha\n", false],
  ["Alpha|Beta", "Beta", true],
  ["(ab|c){2,3}", "abcab", true],
  ["(ab|c){2,3}", "abcabc", false],
  ["a{2,}", "aaaaa", true],
  ["a{2}", "a", false],
  ["[-a]+", "-a", true],
  ["[a-]+", "a-", true],
  ["[a^$]+", "a^$", true],
  ["(a?){1000000}b", "ab", true],
];

describe("XML Schema pattern matching through QTI processing", () => {
  it.each(cases)("matches %s against %s => %s", (pattern, value, expected) => {
    const result = score(pattern, value);
    expect(result.outcomes.RESULT).toBe(expected);
    expect(result.diagnostics).toEqual([]);
  });

  it("propagates NULL operands and NULL pattern variables", () => {
    expect(score(".*", null).outcomes.RESULT).toBeNull();
    expect(score("{PATTERN}", "Alpha", variable(null)).outcomes.RESULT).toBeNull();
  });

  it("resolves brace-enclosed string variables and retains literal identifier patterns", () => {
    expect(score("{PATTERN}", "Alpha", variable(String.raw`\i\c*`)).outcomes.RESULT).toBe(true);
    expect(score("PATTERN", "PATTERN", variable("[0-9]+")).outcomes.RESULT).toBe(true);
    expect(parseQtiXml(item("{MISSING}", "Alpha")).diagnostics).toContainEqual(
      expect.objectContaining({ code: "processing.variable.reference" }),
    );
  });

  it.each([
    "(?=a)a",
    "(?:a)",
    String.raw`(a)\1`,
    String.raw`\bword\b`,
    String.raw`\u0041`,
    String.raw`\x41`,
    String.raw`\$`,
    "a+?",
    "a++",
    "a{3,2}",
    "a{,2}",
    "[z-a]",
    "[a-z-[a]b]",
    "[a-z",
    "[]",
    String.raw`[\d-a]`,
    String.raw`\p{Script=Greek}`,
    String.raw`\p{IsMissing}`,
    String.raw`\p{Cs}`,
  ])("diagnoses non-XML-Schema syntax %s", (pattern) => {
    expect(parseQtiXml(item(pattern, "a")).diagnostics).toContainEqual(
      expect.objectContaining({ code: "processing.pattern.syntax" }),
    );
  });

  it("diagnoses malformed variable patterns at runtime and keeps the result restorable", () => {
    const result = score("{PATTERN}", "a", variable("(?=a)"));
    expect(result.outcomes.RESULT).toBeNull();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "processing.pattern.syntax" }),
    );
    expect(isQtiAttemptStateV1(result.state)).toBe(true);
    const parsed = parseQtiXml(item("{PATTERN}", "a", variable("(?=a)")));
    const document = parsed.document;
    if (!document) throw new Error("Expected item.");
    expect(() => createItemSession(document, result.state)).not.toThrow();
  });

  it("preserves names, subtraction and variable patterns on serialization", () => {
    for (const pattern of [String.raw`[\i-[:]][\c-[:]]*`, "{PATTERN}"]) {
      const source = item(pattern, "Alpha", variable(String.raw`\i\c*`));
      const parsed = parseQtiXml(source);
      if (!parsed.document?.item.responseProcessing) throw new Error("Expected processing.");
      const processing = serializeResponseProcessing(parsed.document.item.responseProcessing);
      expect(processing.ok).toBe(true);
      if (!processing.xml) throw new Error("Expected serialized processing.");
      const roundtrip = parseQtiXml(
        source.replace(
          /<qti-response-processing>[\s\S]*<\/qti-response-processing>/,
          processing.xml,
        ),
      );
      expect(roundtrip.ok).toBe(true);
      if (!roundtrip.document) throw new Error("Expected roundtrip item.");
      expect(createItemSession(roundtrip.document).score().outcomes.RESULT).toBe(true);
    }
  });

  it("bounds expensive expressions with a diagnostic instead of backtracking or a partial answer", () => {
    const result = score("(a+)+b", "a".repeat(1000));
    expect(result.outcomes.RESULT).toBeNull();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "processing.pattern.limit" }),
    );
    expect(
      parseQtiXml(item("(".repeat(65) + "a" + ")".repeat(65), "a")).diagnostics,
    ).toContainEqual(expect.objectContaining({ code: "processing.pattern.limit" }));
    expect(score(".*", "a".repeat(100_001)).diagnostics).toContainEqual(
      expect.objectContaining({ code: "processing.pattern.limit" }),
    );
  });
});
