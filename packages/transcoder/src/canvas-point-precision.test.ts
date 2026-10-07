import { createItemSession } from "@longsightgroup/qti3-core";
import { writeQti3AssessmentItemResult } from "@longsightgroup/qti3-writer";
import { describe, expect, it } from "vitest";
import { validQtiDocument } from "../../../tests/fixtures/valid-qti-document.js";
import { transcodeQti3Item, transcodeQti3Package } from "./index.js";

function pointedChoice(identifier: string, maximumScore: number): string {
  const written = writeQti3AssessmentItemResult({
    interactionType: "choice",
    identifier,
    title: "Fractional practice points",
    responseCardinality: "single",
    choices: [
      { identifier: "A", text: "Alpha" },
      { identifier: "B", text: "Beta" },
    ],
    correctResponse: ["A"],
    maximumScore,
  });
  if (!written.ok) throw new Error("Expected valid fractional-point QTI.");
  const session = createItemSession(validQtiDocument(written.xml));
  session.respond("RESPONSE", "A");
  expect(session.score().outcomes.SCORE).toBe(maximumScore);
  return written.xml;
}

// The XML export must not choose a decimal-place rounding policy for the author.
// These independent binary-exact totals distinguish per-item rounding from aggregation.
describe("Canvas fractional point maxima", () => {
  for (const [left, right, total] of [
    [3.125, 1.375, 4.5],
    [0.00390625, 0.00390625, 0.0078125],
  ] as const) {
    it.each(["canvas-classic-quizzes@1", "canvas-new-quizzes@1"] as const)(
      `preserves ${left} and ${right} with assessment total ${total} through %s`,
      async (profile) => {
        const items = [left, right].map((points, index) => ({
          kind: "xml" as const,
          identifier: `choice_${index}`,
          path: `items/choice_${index}.xml`,
          xml: pointedChoice(`choice_${index}`, points),
        }));
        for (const [index, item] of items.entries()) {
          const result = transcodeQti3Item(item, { profile });
          expect(result.ok).toBe(true);
          if (!result.ok) throw new Error("Expected a usable fractional-point item.");
          expect(result.xml).toContain(
            `<fieldlabel>points_possible</fieldlabel><fieldentry>${index === 0 ? left : right}</fieldentry>`,
          );
        }
        const result = await transcodeQti3Package(
          { kind: "authoringPackage", package: { identifier: "POINTS", title: "Points", items } },
          { profile },
        );
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error("Expected a usable fractional-point assessment.");
        const assessment = result.files.find((file) => file.path === "assessment_qti.xml")?.data;
        expect(assessment).toContain(
          `<fieldlabel>points_possible</fieldlabel><fieldentry>${left}</fieldentry>`,
        );
        expect(assessment).toContain(
          `<fieldlabel>points_possible</fieldlabel><fieldentry>${right}</fieldentry>`,
        );
        expect(result.files.find((file) => file.path === "assessment_meta.xml")?.data).toContain(
          `<points_possible>${total}</points_possible>`,
        );
      },
    );
  }
});
