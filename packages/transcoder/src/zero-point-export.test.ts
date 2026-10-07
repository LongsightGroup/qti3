import { createItemSession } from "@longsightgroup/qti3-core";
import { writeQti3AssessmentItemResult } from "@longsightgroup/qti3-writer";
import { describe, expect, it } from "vitest";
import { validQtiDocument } from "../../../tests/fixtures/valid-qti-document.js";
import { transcodeQti3Item, transcodeQti3Package } from "./index.js";
import { choiceAuthoringPackage } from "./transcoder.test-helpers.js";
import { validateGeneratedTargetXml } from "./xml.js";

function zeroPointXml(): string {
  const written = writeQti3AssessmentItemResult({
    interactionType: "choice",
    identifier: "choice",
    title: "Practice question",
    responseCardinality: "single",
    choices: [
      { identifier: "A", text: "Alpha" },
      { identifier: "B", text: "Beta" },
    ],
    correctResponse: ["A"],
    maximumScore: 0,
  });
  if (!written.ok) throw new Error("Expected a valid zero-point source.");
  const session = createItemSession(validQtiDocument(written.xml));
  session.respond("RESPONSE", "A");
  expect(session.score().outcomes).toMatchObject({ SCORE: 0, MAXSCORE: 0 });
  return written.xml;
}

// QTI maximum metadata does not rescale SCORE (BPIG §3.5). Zero is an explicit MAXSCORE,
// not an absent value. Native Canvas/Moodle grade metadata must therefore remain zero.
describe("zero-point native export metadata", () => {
  it("accepts zero Moodle marks while rejecting missing, negative and non-finite marks", () => {
    const result = transcodeQti3Item(
      { kind: "xml", xml: zeroPointXml() },
      { profile: "moodle-xml@1" },
    );
    if (!result.ok) throw new Error("Expected valid zero-mark Moodle XML.");
    expect(validateGeneratedTargetXml(result.xml, "moodle-xml")).toEqual([]);
    for (const grade of ["", "-1", "NaN", "Infinity"]) {
      const replacement = grade ? `<defaultgrade>${grade}</defaultgrade>` : "";
      const invalid = result.xml.replace("<defaultgrade>0</defaultgrade>", replacement);
      expect(invalid).not.toBe(result.xml);
      expect(validateGeneratedTargetXml(invalid, "moodle-xml")).toContainEqual(
        expect.objectContaining({
          code: "target.moodle_xml.semantic",
          severity: "error",
          message: expect.stringContaining("defaultgrade must be non-negative"),
        }),
      );
    }
  });
  it.each(["canvas-classic-quizzes@1", "canvas-new-quizzes@1", "moodle-xml@1"] as const)(
    "retains the zero-point question maximum through %s item export",
    (profile) => {
      const result = transcodeQti3Item({ kind: "xml", xml: zeroPointXml() }, { profile });
      expect(result.diagnostics).toEqual([]);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected a usable zero-point export.");
      expect(result.xml).toContain(
        profile === "moodle-xml@1"
          ? "<defaultgrade>0</defaultgrade>"
          : "<fieldlabel>points_possible</fieldlabel><fieldentry>0</fieldentry>",
      );
    },
  );

  it.each(["canvas-classic-quizzes@1", "canvas-new-quizzes@1", "moodle-xml@1"] as const)(
    "retains zero-point item and assessment maxima through %s package export",
    async (profile) => {
      const sourceXml = zeroPointXml();
      const result = await transcodeQti3Package(
        {
          kind: "authoringPackage",
          package: {
            ...choiceAuthoringPackage,
            items: [
              { kind: "xml", identifier: "choice", path: "items/choice.xml", xml: sourceXml },
            ],
          },
        },
        { profile },
      );
      expect(result.diagnostics).toEqual([]);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected a usable zero-point package.");
      if (profile === "moodle-xml@1") {
        expect(
          result.files.find((file) => file.path.endsWith(".xml") && file.path !== "imsmanifest.xml")
            ?.data,
        ).toContain("<defaultgrade>0</defaultgrade>");
      } else {
        expect(result.files.find((file) => file.path === "assessment_qti.xml")?.data).toContain(
          "<fieldlabel>points_possible</fieldlabel><fieldentry>0</fieldentry>",
        );
        expect(result.files.find((file) => file.path === "assessment_meta.xml")?.data).toContain(
          "<points_possible>0</points_possible>",
        );
      }
    },
  );
});
