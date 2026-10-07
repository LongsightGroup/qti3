import { createItemSession } from "@longsightgroup/qti3-core";
import { qti3TrustedXmlFragment, writeQti3AssessmentItemResult } from "@longsightgroup/qti3-writer";
import { transcodeQti3Item } from "@longsightgroup/qti3-transcoder";
import { describe, expect, it } from "vitest";
import { validQtiDocument } from "../../../tests/fixtures/valid-qti-document.js";
import { migrateQtiItemToQti3 } from "./index.js";

const profiles = ["qti21-standard@1", "qti22-standard@1"] as const;

function sourceDropdown(maximumScore: number, multipleSlots: boolean): string {
  const ids = multipleSlots ? ["FIRST", "SECOND"] : ["ANSWER"];
  const result = writeQti3AssessmentItemResult({
    interactionType: "inlineChoice",
    identifier: "POINTS",
    title: "Portable dropdown points",
    maximumScore,
    bodyHtml: qti3TrustedXmlFragment(
      `<p>${ids.map((id) => `<qti-inline-choice-interaction response-identifier="${id}"/>`).join(" and ")}</p>`,
    ),
    slots: ids.map((responseIdentifier) => ({
      responseIdentifier,
      correctResponse: "A",
      options: [
        { identifier: "A", text: "Alpha" },
        { identifier: "B", text: "Beta" },
      ],
    })),
  });
  if (!result.ok) throw new Error("Expected canonical dropdown points.");
  validQtiDocument(result.xml);
  return result.xml;
}

describe("explicit dropdown points through actual QTI 2 round trips", () => {
  for (const maximumScore of [0, 3, 3.125])
    for (const multipleSlots of [false, true]) {
      it.each(profiles)(
        `preserves ${maximumScore} points with ${multipleSlots ? "two" : "one"} slots through %s`,
        (profile) => {
          const original = sourceDropdown(maximumScore, multipleSlots);
          const exported = transcodeQti3Item({ kind: "xml", xml: original }, { profile });
          expect(exported.ok).toBe(true);
          if (!exported.ok) throw new Error("Expected usable QTI 2 dropdown output.");
          const migrated = migrateQtiItemToQti3(
            { kind: "xml", xml: exported.xml },
            { repairPolicy: "none", unsupportedPolicy: "diagnostic" },
          );
          expect(migrated.diagnostics.filter((entry) => entry.severity === "error")).toEqual([]);
          expect(migrated.authoringItem).toMatchObject({
            interactionType: "inlineChoice",
            maximumScore,
          });
          if (!migrated.xml) throw new Error("Expected preserved dropdown output.");
          for (const xml of [original, migrated.xml]) {
            const document = validQtiDocument(xml);
            const rows = multipleSlots
              ? [
                  { values: ["A", "A"], expected: maximumScore },
                  { values: ["A", "B"], expected: 0 },
                  { values: ["B", "A"], expected: 0 },
                  { values: [null, "A"], expected: 0 },
                  { values: [null, null], expected: 0 },
                ]
              : [
                  { values: ["A"], expected: maximumScore },
                  { values: ["B"], expected: 0 },
                  { values: [null], expected: 0 },
                ];
            for (const { values, expected } of rows) {
              const session = createItemSession(document);
              document.item.responseDeclarations.forEach((declaration, index) =>
                session.respond(declaration.identifier, values[index] ?? null),
              );
              expect(session.score().outcomes).toMatchObject({
                SCORE: expected,
                MAXSCORE: maximumScore,
              });
            }
          }
        },
      );
    }

  it.each(profiles)(
    "refuses changed inline score rules despite matching maximum metadata in %s",
    (profile) => {
      const exported = transcodeQti3Item(
        { kind: "xml", xml: sourceDropdown(3, false) },
        { profile },
      );
      if (!exported.ok) throw new Error("Expected a valid negative-case source.");
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

  it.each(profiles)("refuses unmatched dropdown range metadata in %s", (profile) => {
    const exported = transcodeQti3Item({ kind: "xml", xml: sourceDropdown(3, true) }, { profile });
    if (!exported.ok) throw new Error("Expected a valid negative-case source.");
    const changed = exported.xml.replace('normalMaximum="3"', 'normalMaximum="9"');
    expect(changed).not.toBe(exported.xml);
    for (const repairPolicy of ["none", "safe"] as const) {
      const migrated = migrateQtiItemToQti3(
        { kind: "xml", xml: changed },
        { repairPolicy, unsupportedPolicy: "diagnostic" },
      );
      expect(migrated.xml).toBeUndefined();
      expect(migrated.authoringItem).toBeUndefined();
      expect(migrated.diagnostics.some((entry) => entry.severity === "error")).toBe(true);
    }
  });
});

// Brightspace's configured text-entry downgrade is intentionally not a lossless dropdown import.
for (const maximumScore of [0, 3, 3.125])
  it.each([false, true])(
    `discloses the usable Brightspace text-answer downgrade at ${maximumScore} points with multi-slot=%s`,
    (multipleSlots) => {
      const original = sourceDropdown(maximumScore, multipleSlots);
      const exported = transcodeQti3Item(
        { kind: "xml", xml: original },
        { profile: "brightspace-course-import@1" },
      );
      expect(exported.ok).toBe(true);
      if (!exported.ok) throw new Error("Expected a usable disclosed downgrade.");
      expect(exported.report).toMatchObject({
        fidelity: "lossy",
        diagnosticCodes: expect.arrayContaining([
          "profile.brightspace.inline_choice.text_entry_fallback",
        ]),
      });
      expect(exported.report.mappings).toHaveLength(multipleSlots ? 2 : 1);
      for (const mapping of exported.report.mappings)
        expect(mapping).toMatchObject({
          sourceInteraction: "inlineChoice",
          emittedInteraction: "textEntryInteraction",
          scoring: "automatic",
          fidelity: "lossy",
          fallback: "text-entry",
        });
      expect(exported.xml).toContain("<textEntryInteraction responseIdentifier=");
      expect(exported.xml).toContain(`<defaultValue><value>${maximumScore}</value></defaultValue>`);
      expect(exported.xml).toContain("Source options: Alpha; Beta");
      for (const repairPolicy of ["none", "safe"] as const) {
        const migrated = migrateQtiItemToQti3(
          { kind: "xml", xml: exported.xml },
          { repairPolicy, unsupportedPolicy: "diagnostic" },
        );
        expect(migrated.xml).toBeUndefined();
        expect(migrated.authoringItem).toBeUndefined();
        expect(migrated.diagnostics.some((entry) => entry.severity === "error")).toBe(true);
      }
    },
  );
