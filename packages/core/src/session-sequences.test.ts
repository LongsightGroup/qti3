import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  createItemSession,
  parseQtiXml,
  validateAssessmentItem,
  assertQtiAttemptStateV1,
} from "./index.js";

// QTI 3.0.1 ASI §§2.2,2.5: adaptive completion and repeated attempts.
// Independent model: each accepted scoring turn earns 1; finish permanently closes.
const xml = readFileSync(
  new URL("../../../tests/fixtures/semantic-pilots/adaptive.xml", import.meta.url),
  "utf8",
);
const actions = ["respond", "begin", "score", "finish", "suspend", "restore"] as const;
type Action = (typeof actions)[number];
// Exhaustive bounded enumeration: no random seed or sampled path can hide a failure.
// Shortest sequences run first, and the full sequence is the test's replay identifier.
function sequences(depth: number): Action[][] {
  let level: Action[][] = [[]];
  const result: Action[][] = [];
  for (let length = 1; length <= depth; length++) {
    level = level.flatMap((prefix) => actions.map((action) => [...prefix, action]));
    result.push(...level);
  }
  return result;
}
const depth = process.env.QTI3_EXTENDED_SEMANTICS === "1" ? 5 : 3;
it.each(sequences(depth).map((sequence) => [sequence.join(" → "), sequence] as const))(
  "[ASI-ADAPTIVE-SEQUENCES] adaptive model: %s",
  (_name, sequence) => {
    const parsed = parseQtiXml(xml);
    expect(parsed.diagnostics).toEqual([]);
    if (!parsed.document) throw new Error("Missing independent item fixture");
    expect(validateAssessmentItem(parsed.document).diagnostics).toEqual([]);
    let session = createItemSession(parsed.document, undefined, { now: () => 0 });
    let closed = false;
    let earned = 0;
    for (const action of sequence) {
      const before = session.serialize();
      if (action === "restore") {
        const saved: unknown = JSON.parse(JSON.stringify(before));
        assertQtiAttemptStateV1(saved);
        session = createItemSession(parsed.document, saved, { now: () => 0 });
        expect(session.serialize()).toEqual(before);
        continue;
      }
      let diagnostics;
      switch (action) {
        case "respond":
          diagnostics = session.respond("FINISH", false);
          break;
        case "begin":
          diagnostics = session.beginAttempt();
          break;
        case "suspend":
          diagnostics = session.setStatus("suspended");
          break;
        case "score":
          diagnostics = session.score().diagnostics;
          break;
        case "finish":
          diagnostics = session.score({ endAttemptResponseIdentifier: "FINISH" }).diagnostics;
          break;
      }
      if (closed) {
        expect(diagnostics).toContainEqual(
          expect.objectContaining({ code: "session.completed", severity: "error" }),
        );
        expect(session.serialize()).toEqual(before);
      } else {
        expect(diagnostics).toEqual([]);
        if (action === "score" || action === "finish") earned++;
        if (action === "finish") closed = true;
      }
      expect(session.serialize().outcomes.SCORE).toBe(earned);
      if (closed) expect(session.serialize().status).toBe("completed");
    }
  },
);
