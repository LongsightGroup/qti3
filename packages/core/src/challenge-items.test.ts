import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { validQtiDocument } from "../../../tests/fixtures/valid-qti-document.js";
import {
  assertQtiAttemptStateV1,
  createItemSession,
  visibleModalFeedback,
  type QtiDocument,
  type QtiItemSession,
} from "./index.js";

// Independently authored MIT fixtures and fixed grade tables. QTI 3.0.1 ASI:
// §§4.6, 5.88.1–2, 7.22: response processing and bounded response mappings;
// §§4.1.7, 5.45: adaptive outcomes and end-attempt triggers.
// https://www.imsglobal.org/sites/default/files/spec/qti/v3/info/imsqti_asi_v3p0p1_infomodel_v1p0.html
// https://www.imsglobal.org/spec/qti/v3p0/impl (3.4.2 and adaptive items)
const partialXml = readFileSync(
  new URL("../../../tests/fixtures/challenges/partial-credit.xml", import.meta.url),
  "utf8",
);
const adaptiveXml = readFileSync(
  new URL("../../../tests/fixtures/challenges/adaptive-retries.xml", import.meta.url),
  "utf8",
);

function restore(document: QtiDocument, session: QtiItemSession): QtiItemSession {
  const before = session.serialize();
  const saved: unknown = JSON.parse(JSON.stringify(before));
  assertQtiAttemptStateV1(saved);
  const restored = createItemSession(document, saved, { now: () => 0, presentationSeed: "other" });
  expect(restored.serialize()).toEqual(before);
  return restored;
}

// Columns: unanswered measurement, correct (7), wrong (6), zero (also wrong).
// The table is literal: neither the writer nor a copy of the scoring algorithm is the oracle.
const evidenceCases = [
  ["unanswered", null, 0, [0, 3, 0, 0]],
  ["empty", [], 0, [0, 3, 0, 0]],
  ["A", ["A"], 3, [3, 5, 1, 1]],
  ["B", ["B"], 2, [2, 5, 0, 0]],
  ["upper bound", ["A", "B"], 4, [4, 5, 2, 2]],
  ["reordered upper bound", ["B", "A"], 4, [4, 5, 2, 2]],
  ["lower bound", ["A", "C"], 0, [0, 3, 0, 0]],
  ["penalty before bound", ["A", "B", "C"], 1, [1, 4, 0, 0]],
  ["default penalty", ["A", "D"], 2, [2, 5, 0, 0]],
  ["only default", ["D"], 0, [0, 3, 0, 0]],
] as const;
const measurements = [
  [null, 0],
  [7, 3],
  [6, -2],
  [0, -2],
] as const;

for (const restored of [false, true]) {
  it.each(evidenceCases)(
    `challenge partial credit: %s (restore=${restored})`,
    (_label, evidence, points, totals) => {
      const document = validQtiDocument(partialXml);
      for (const [column, [measurement, measurementPoints]] of measurements.entries()) {
        let session = createItemSession(document, undefined, {
          now: () => 0,
          presentationSeed: "challenge",
        });
        expect(session.respond("EVIDENCE", evidence === null ? null : [...evidence])).toEqual([]);
        if (restored) session = restore(document, session);
        expect(session.respond("MEASUREMENT", measurement)).toEqual([]);
        if (restored) session = restore(document, session);
        const expected = {
          EVIDENCE_POINTS: points,
          MEASUREMENT_POINTS: measurementPoints,
          SCORE: totals[column],
        };
        const scored = session.score();
        expect(scored.diagnostics).toEqual([]);
        expect(scored.outcomes, `measurement=${measurement}`).toMatchObject(expected);
        if (restored) session = restore(document, session);
        // Each non-adaptive scoring invocation starts from defaults, even after restoration.
        expect(session.score().outcomes).toMatchObject(expected);
        expect(session.respond("EVIDENCE", ["D"])).toEqual([]);
        expect(session.respond("MEASUREMENT", null)).toEqual([]);
        if (restored) session = restore(document, session);
        const cleared = session.score();
        expect(cleared.diagnostics).toEqual([]);
        expect(cleared.outcomes).toMatchObject({
          EVIDENCE_POINTS: 0,
          MEASUREMENT_POINTS: 0,
          SCORE: 0,
        });
      }
    },
  );
}

type Step = readonly [
  action: "hint" | "wrong" | "empty" | "correct" | "host-correct",
  hints: number,
  failures: number,
  score: number,
  feedback: "HELP" | "RETRY" | "EMPTY" | "SUCCESS" | "EXHAUSTED",
];
const journeys: ReadonlyArray<readonly [string, readonly Step[]]> = [
  ["first answer", [["correct", 0, 0, 6, "SUCCESS"]]],
  [
    "hint then host submit",
    [
      ["hint", 1, 0, 0, "HELP"],
      ["host-correct", 1, 0, 5, "SUCCESS"],
    ],
  ],
  [
    "two hints and retry",
    [
      ["hint", 1, 0, 0, "HELP"],
      ["wrong", 1, 1, 0, "RETRY"],
      ["hint", 2, 1, 0, "HELP"],
      ["correct", 2, 1, 3, "SUCCESS"],
    ],
  ],
  [
    "clear a wrong answer",
    [
      ["wrong", 0, 1, 0, "RETRY"],
      ["empty", 0, 2, 0, "EMPTY"],
      ["correct", 0, 2, 4, "SUCCESS"],
    ],
  ],
  [
    "exhaust retries",
    [
      ["empty", 0, 1, 0, "EMPTY"],
      ["hint", 1, 1, 0, "HELP"],
      ["wrong", 1, 2, 0, "RETRY"],
      ["empty", 1, 3, 0, "EXHAUSTED"],
    ],
  ],
  [
    "hint penalty floor",
    [
      ["hint", 1, 0, 0, "HELP"],
      ["hint", 2, 0, 0, "HELP"],
      ["hint", 3, 0, 0, "HELP"],
      ["hint", 4, 0, 0, "HELP"],
      ["hint", 5, 0, 0, "HELP"],
      ["hint", 6, 0, 0, "HELP"],
      ["hint", 7, 0, 0, "HELP"],
      ["correct", 7, 0, 0, "SUCCESS"],
    ],
  ],
];

for (const restored of [false, true]) {
  it.each(journeys)(`challenge adaptive: %s (restore=${restored})`, (_label, steps) => {
    const document = validQtiDocument(adaptiveXml);
    let session = createItemSession(document, undefined, { now: () => 0 });
    expect(visibleModalFeedback(document.item, session.serialize().outcomes)).toEqual([]);
    for (const [index, [action, hints, failures, score, feedback]] of steps.entries()) {
      if (restored) session = restore(document, session);
      if (action !== "hint") {
        const answer = action === "empty" ? null : action === "wrong" ? 6 : 7;
        expect(session.respond("ANSWER", answer)).toEqual([]);
      }
      if (restored) session = restore(document, session);
      const trigger = action === "hint" ? "HINT" : action === "host-correct" ? undefined : "DONE";
      const result = session.score({ endAttemptResponseIdentifier: trigger });
      expect(result.diagnostics).toEqual([]);
      const completed = feedback === "SUCCESS" || feedback === "EXHAUSTED";
      expect(result.outcomes).toMatchObject({
        HINTS: hints,
        FAILURES: failures,
        SCORE: score,
        FEEDBACK: feedback,
        completionStatus: completed ? "completed" : "unknown",
      });
      expect(result.state.builtInVariables?.numAttempts).toBe(index + 1);
      expect(result.state.responses).toMatchObject({
        HINT: trigger === "HINT",
        DONE: trigger === "DONE",
      });
      expect(
        visibleModalFeedback(document.item, result.outcomes).map((entry) => entry.identifier),
      ).toEqual([feedback]);
      if (restored) session = restore(document, session);
    }
    const closed = session.serialize();
    expect(closed.status).toBe("completed");
    // Completion must survive JSON restoration and reject further answers or attempts atomically.
    for (const mutate of [
      () => session.respond("ANSWER", 7),
      () => session.beginAttempt(),
      () => session.setStatus("interacting"),
      () => session.score({ endAttemptResponseIdentifier: "HINT" }).diagnostics,
      () => session.score().diagnostics,
    ]) {
      expect(mutate()).toEqual([
        expect.objectContaining({ code: "session.completed", severity: "error" }),
      ]);
      expect(session.serialize()).toEqual(closed);
    }
  });
}
