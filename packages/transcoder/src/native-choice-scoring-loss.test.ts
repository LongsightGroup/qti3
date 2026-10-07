import { createItemSession } from "@longsightgroup/qti3-core";
import { writeQti3AssessmentItemResult } from "@longsightgroup/qti3-writer";
import { describe, expect, it } from "vitest";
import { validQtiDocument } from "../../../tests/fixtures/valid-qti-document.js";
import { transcodeQti3Item, transcodeQti3Package } from "./index.js";

const profiles = [
  "qti12-standard@1",
  "canvas-classic-quizzes@1",
  "canvas-new-quizzes@1",
  "moodle-xml@1",
] as const;

function mappedSource(): string {
  const source = writeQti3AssessmentItemResult({
    interactionType: "choice",
    identifier: "POINTS",
    title: "Mapped points",
    responseCardinality: "multiple",
    scoring: "map_response",
    maximumScore: 3,
    maxChoices: 3,
    choices: [
      { identifier: "A", text: "Alpha" },
      { identifier: "B", text: "Beta" },
      { identifier: "C", text: "Gamma" },
    ],
    correctResponse: ["A", "B"],
  });
  if (!source.ok) throw new Error("Expected valid mapped source.");
  const document = validQtiDocument(source.xml);
  for (const [response, expected] of [
    [["A", "C"], 1.5],
    [["A", "B", "C"], 3],
  ] as const) {
    const session = createItemSession(document);
    session.respond("RESPONSE", [...response]);
    expect(session.score().outcomes.SCORE).toBe(expected);
  }
  return source.xml;
}

// Existing native serializers rebuild scoring. The conversion receipt must identify
// that loss even though the questions remain usable and automatically graded.
describe("native choice scoring disclosure", () => {
  it.each(profiles)(
    "reports replaced point and partial-credit rules in actual %s item/package output",
    async (profile) => {
      const source = mappedSource();
      const code =
        profile === "moodle-xml@1"
          ? "profile.moodle.xml.scoring.choice_rebuilt"
          : profile === "qti12-standard@1"
            ? "profile.qti12.scoring.choice_rebuilt"
            : "profile.canvas.scoring.choice_rebuilt";
      const item = transcodeQti3Item(
        { kind: "xml", xml: source, sourcePath: "items/points.xml" },
        { profile },
      );
      expect(item.ok).toBe(true);
      if (!item.ok) throw new Error("Expected usable downgraded item.");
      expect(item.diagnostics).toContainEqual(
        expect.objectContaining({ code, severity: "warning", path: "items/points.xml" }),
      );
      expect(item.report).toMatchObject({
        fidelity: "lossy",
        diagnosticCodes: expect.arrayContaining([code]),
        mappings: [
          expect.objectContaining({
            scoring: "automatic",
            fidelity: "lossy",
            diagnosticCodes: expect.arrayContaining([code]),
          }),
        ],
      });
      expect(item.diagnostics.find((entry) => entry.code === code)?.message).toContain(
        profile === "moodle-xml@1" ? "wrong answers" : "all-or-nothing",
      );
      if (profile === "moodle-xml@1") expect(item.xml).toContain('<answer fraction="-100"');
      else
        expect(item.xml).toContain(
          `varname="SCORE">${profile === "qti12-standard@1" ? 1 : 100}</setvar>`,
        );
      const packaged = await transcodeQti3Package(
        {
          kind: "authoringPackage",
          package: {
            identifier: "POINTS",
            title: "Points",
            items: [{ kind: "xml", identifier: "POINTS", path: "items/points.xml", xml: source }],
          },
        },
        { profile },
      );
      expect(packaged.ok).toBe(true);
      if (!packaged.ok) throw new Error("Expected usable downgraded package.");
      expect(packaged.diagnostics).toContainEqual(
        expect.objectContaining({ code, severity: "warning" }),
      );
      const report = packaged.files.find(
        (file) => file.path.startsWith("assets/generated/") && file.path.endsWith(".json"),
      )?.data;
      expect(report).toContain(code);
    },
  );

  it.each(profiles)(
    "keeps ordinary one-point matching free of a rebuilt-scoring warning in %s",
    (profile) => {
      const written = writeQti3AssessmentItemResult({
        interactionType: "choice",
        identifier: "UNIT",
        title: "Unit score",
        responseCardinality: "single",
        choices: [
          { identifier: "A", text: "Alpha" },
          { identifier: "B", text: "Beta" },
        ],
        correctResponse: ["A"],
      });
      if (!written.ok) throw new Error("Expected ordinary unit source.");
      const session = createItemSession(validQtiDocument(written.xml));
      session.respond("RESPONSE", "A");
      expect(session.score().outcomes.SCORE).toBe(1);
      const result = transcodeQti3Item({ kind: "xml", xml: written.xml }, { profile });
      expect(result.ok).toBe(true);
      expect(
        result.diagnostics.filter((entry) => entry.code.endsWith("scoring.choice_rebuilt")),
      ).toEqual([]);
    },
  );

  it.each(profiles)(
    "does not trust a standard template when inline rules override its grade in %s",
    (profile) => {
      const written = writeQti3AssessmentItemResult({
        interactionType: "choice",
        identifier: "OVERRIDE",
        title: "Authored score",
        responseCardinality: "single",
        choices: [
          { identifier: "A", text: "Alpha" },
          { identifier: "B", text: "Beta" },
        ],
        correctResponse: ["A"],
        maximumScore: 1,
      });
      if (!written.ok) throw new Error("Expected a scoring mutation source.");
      const changed = written.xml
        .replace(
          '<qti-base-value base-type="float">1</qti-base-value>',
          '<qti-base-value base-type="float">7</qti-base-value>',
        )
        .replace(
          "<qti-response-processing>",
          '<qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct">',
        );
      expect(changed).not.toBe(written.xml);
      expect(changed).toContain(
        '<qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct">',
      );
      const session = createItemSession(validQtiDocument(changed));
      session.respond("RESPONSE", "A");
      expect(session.score().outcomes).toMatchObject({ SCORE: 7, MAXSCORE: 1 });
      const result = transcodeQti3Item({ kind: "xml", xml: changed }, { profile });
      expect(result.ok).toBe(true);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          code: expect.stringMatching(/scoring\.choice_rebuilt$/),
          severity: "warning",
        }),
      );
    },
  );
});
