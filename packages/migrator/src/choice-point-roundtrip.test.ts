import { createItemSession } from "@longsightgroup/qti3-core";
import { writeQti3AssessmentItemResult } from "@longsightgroup/qti3-writer";
import { describe, expect, it } from "vitest";
import { validQtiDocument } from "../../../tests/fixtures/valid-qti-document.js";
import { transcodeQti3Item } from "../../transcoder/src/index.js";
import { migrateQtiItemToQti3 } from "./index.js";

const profiles = ["qti21-standard@1", "qti22-standard@1", "brightspace-course-import@1"] as const;
const pointCases = [
  { maximumScore: 0, partialScore: 0 },
  { maximumScore: 3, partialScore: 1.5 },
  { maximumScore: 3.125, partialScore: 1.5625 },
] as const;

function sourceChoice(maximumScore: number, multiple: boolean): string {
  const result = writeQti3AssessmentItemResult({
    interactionType: "choice",
    identifier: "POINTS",
    title: "Portable choice points",
    responseIdentifier: "ANSWER",
    responseCardinality: multiple ? "multiple" : "single",
    choices: [
      { identifier: "A", text: "Alpha" },
      { identifier: "B", text: "Beta" },
      { identifier: "C", text: "Gamma" },
    ],
    correctResponse: multiple ? ["A", "B"] : ["A"],
    maxChoices: multiple ? 3 : 1,
    scoring: multiple ? "map_response" : "match_correct",
    maximumScore,
  });
  if (!result.ok) throw new Error("Expected valid pointed source QTI.");
  validQtiDocument(result.xml);
  return result.xml;
}

// QTI BPIG §3.5: maximum metadata describes a score; it does not scale the score.
// Literal truth tables prove grades independently of conversion in both directions.
describe("explicit choice points through QTI 2 export and reimport", () => {
  for (const { maximumScore, partialScore } of pointCases) {
    for (const multiple of [false, true]) {
      it.each(profiles)(
        `preserves ${multiple ? "mapped" : "matched"} ${maximumScore}-point grades through %s`,
        (profile) => {
          const sourceXml = sourceChoice(maximumScore, multiple);
          const exported = transcodeQti3Item({ kind: "xml", xml: sourceXml }, { profile });
          expect(exported.ok).toBe(true);
          if (!exported.ok) throw new Error("Expected usable QTI 2 choice output.");
          const migrated = migrateQtiItemToQti3(
            { kind: "xml", xml: exported.xml },
            { repairPolicy: "none", unsupportedPolicy: "diagnostic" },
          );
          expect(migrated.diagnostics.filter((entry) => entry.severity === "error")).toEqual([]);
          expect(migrated.authoringItem).toMatchObject({ interactionType: "choice", maximumScore });
          if (!migrated.xml) throw new Error("Expected preserved pointed QTI.");
          const responses = multiple
            ? [
                { response: null, expected: 0 },
                { response: [], expected: 0 },
                { response: ["C"], expected: 0 },
                { response: ["A"], expected: partialScore },
                { response: ["A", "C"], expected: partialScore },
                { response: ["A", "B"], expected: maximumScore },
                { response: ["A", "B", "C"], expected: maximumScore },
              ]
            : [
                { response: null, expected: 0 },
                { response: "C", expected: 0 },
                { response: "A", expected: maximumScore },
              ];
          for (const xml of [sourceXml, migrated.xml]) {
            const document = validQtiDocument(xml);
            for (const { response, expected } of responses) {
              const session = createItemSession(document);
              session.respond("ANSWER", response);
              expect(session.score().outcomes).toMatchObject({
                SCORE: expected,
                MAXSCORE: maximumScore,
              });
            }
          }
        },
      );
    }
  }

  it.each(profiles)(
    "refuses a changed score program with untouched maximum metadata in %s",
    (profile) => {
      const exported = transcodeQti3Item({ kind: "xml", xml: sourceChoice(3, false) }, { profile });
      if (!exported.ok) throw new Error("Expected usable QTI 2 source for mutation.");
      const changed = exported.xml.replace(
        '<baseValue baseType="float">3</baseValue>',
        '<baseValue baseType="float">7</baseValue>',
      );
      expect(changed).not.toBe(exported.xml);
      for (const repairPolicy of ["none", "safe"] as const) {
        const migrated = migrateQtiItemToQti3(
          { kind: "xml", xml: changed },
          { repairPolicy, unsupportedPolicy: "diagnostic" },
        );
        expect(migrated.xml).toBeUndefined();
        expect(migrated.authoringItem).toBeUndefined();
        expect(migrated.diagnostics).toContainEqual(
          expect.objectContaining({
            code: "qti2_response_processing_not_preserved",
            severity: "error",
          }),
        );
      }
    },
  );

  it.each(profiles)("refuses unmatched positive score-range metadata in %s", (profile) => {
    const exported = transcodeQti3Item({ kind: "xml", xml: sourceChoice(3, false) }, { profile });
    if (!exported.ok) throw new Error("Expected usable metadata mutation source.");
    const changed = exported.xml.replace('normalMaximum="3"', 'normalMaximum="9"');
    expect(changed).not.toBe(exported.xml);
    for (const repairPolicy of ["none", "safe"] as const) {
      const migrated = migrateQtiItemToQti3(
        { kind: "xml", xml: changed },
        { repairPolicy, unsupportedPolicy: "diagnostic" },
      );
      expect(migrated.xml).toBeUndefined();
      expect(migrated.authoringItem).toBeUndefined();
      expect(migrated.diagnostics).toContainEqual(
        expect.objectContaining({ code: "qti2_outcomes_not_preserved", severity: "error" }),
      );
    }
  });

  // Intentionally invalid maximum defaults are diagnostic inputs, not positive scoring fixtures.
  it.each(profiles)(
    "rejects invalid explicit maximum defaults without emitting an item in %s",
    (profile) => {
      const exported = transcodeQti3Item({ kind: "xml", xml: sourceChoice(3, false) }, { profile });
      if (!exported.ok) throw new Error("Expected usable invalid-default mutation source.");
      for (const value of ["", "-1", "NaN", "Infinity"]) {
        const changed = exported.xml.replace(
          /(<outcomeDeclaration[^>]*identifier="MAXSCORE"[^>]*><defaultValue><value>)3(<\/value>)/,
          `$1${value}$2`,
        );
        expect(changed).not.toBe(exported.xml);
        const migrated = migrateQtiItemToQti3(
          { kind: "xml", xml: changed },
          { repairPolicy: "safe", unsupportedPolicy: "diagnostic" },
        );
        expect(migrated.xml).toBeUndefined();
        expect(migrated.authoringItem).toBeUndefined();
        expect(migrated.diagnostics).toContainEqual(
          expect.objectContaining({ code: "qti2_outcomes_not_preserved", severity: "error" }),
        );
      }
    },
  );
});
