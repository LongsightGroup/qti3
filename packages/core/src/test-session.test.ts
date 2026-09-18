import { describe, expect, it } from "vitest";
import { validateQtiTest } from "./test-validation.js";
import {
  startQtiTest,
  submitQtiTestAnswer,
  snapshotQtiTestSession,
  restoreQtiTestSession,
  type QtiTestSession,
} from "./test-session.js";
import { stagedTestFixture } from "../../../tests/fixtures/staged-test.js";
import type { QtiExecutableTest } from "./test-model.js";

function testOf(length = 15): QtiExecutableTest {
  const result = validateQtiTest(stagedTestFixture(length));
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function answerBlock(test: QtiExecutableTest, initial: QtiTestSession, correct: number) {
  let session = initial;
  for (let i = 0; i < 5; i++) {
    if (session.status !== "active") throw new Error("Premature completion");
    const result = submitQtiTestAnswer(test, session, {
      itemRef: session.currentItemRef,
      score: i < correct ? 1 : 0,
    });
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    session = result.value;
  }
  return session;
}

describe("QTI test sessions", () => {
  it("checks all six scores at every reachable block in a 100-answer test", () => {
    const test = testOf(100);
    const expected = [
      [0, 0, 0, 0, 1, 1],
      [0, 0, 1, 1, 2, 2],
      [1, 1, 2, 2, 2, 2],
    ];
    let frontier = new Map([[0, startQtiTest(test)]]);
    let checked = 0;
    for (let stage = 0; stage < 20; stage++) {
      const next = new Map<number, QtiTestSession>();
      expect([...frontier.keys()].toSorted((a, b) => a - b)).toEqual(
        stage === 0 ? [0] : stage === 1 ? [0, 1] : [0, 1, 2],
      );
      for (const [level, initial] of frontier) {
        for (let score = 0; score <= 5; score++) {
          const session = answerBlock(test, initial, score);
          const target = expected[level]?.[score];
          if (target === undefined) throw new Error("Missing expected level");
          expect(new Set(session.submissions.map((s) => s.itemRef)).size).toBe((stage + 1) * 5);
          if (stage === 19) expect(session.status).toBe("completed");
          else {
            expect(session.status === "active" && session.currentItemRef).toBe(
              `stage${stage + 1}_level${target}_item0`,
            );
            next.set(target, session);
          }
          checked++;
        }
      }
      frontier = next;
    }
    expect(checked).toBe(57 * 6);
  });
  it.each([0, 1, 2, 3, 4, 5])("branches at block boundaries for score %i", (score) => {
    const test = testOf(20);
    // Independent expected transitions for low, middle and high source levels.
    const expected = [
      [0, 0, 0, 0, 1, 1],
      [0, 0, 1, 1, 2, 2],
      [1, 1, 2, 2, 2, 2],
    ];
    for (const level of [0, 1, 2]) {
      let session = startQtiTest(test);
      session = answerBlock(test, session, level === 0 ? 0 : 5);
      session = answerBlock(test, session, level === 2 ? 5 : 2);
      session = answerBlock(test, session, score);
      expect(session.status === "active" && session.currentItemRef).toBe(
        `stage3_level${expected[level]?.[score]}_item0`,
      );
      expect(session.submissions).toHaveLength(15);
    }
  });

  it.each([15, 100])(
    "terminates every sampled path after %i unique answers and resumes exactly",
    (length) => {
      const test = testOf(length);
      for (const scores of [[5], [0], [2], [5, 5, 0, 0, 3, 4]]) {
        let session = startQtiTest(test);
        for (let stage = 0; stage < length / 5; stage++) {
          session = answerBlock(test, session, scores[stage % scores.length] ?? 0);
          const restored = restoreQtiTestSession(
            test,
            JSON.parse(JSON.stringify(snapshotQtiTestSession(session))),
          );
          expect(restored).toEqual({ ok: true, value: session });
        }
        expect(session.status).toBe("completed");
        expect(session.submissions).toHaveLength(length);
        expect(new Set(session.submissions.map((s) => s.itemRef)).size).toBe(length);
      }
    },
  );

  it("does not accumulate scores on reprocessing or accept duplicate/future answers", () => {
    const test = testOf();
    const initial = startQtiTest(test);
    const state = answerBlock(test, initial, 5);
    expect(state.outcomes.stage0_level0_score).toBe(5);
    const next = answerBlock(test, state, 3);
    expect(next.outcomes.stage0_level0_score).toBe(5);
    expect(next.outcomes.stage1_level1_score).toBe(3);
    expect(initial.submissions).toEqual([]);
    expect(submitQtiTestAnswer(test, state, { itemRef: "stage0_level0_item0", score: 1 }).ok).toBe(
      false,
    );
    expect(submitQtiTestAnswer(test, state, { itemRef: "stage2_level2_item0", score: 1 }).ok).toBe(
      false,
    );
    expect(
      restoreQtiTestSession(test, {
        version: 1,
        testIdentifier: test.identifier,
        submissions: [{ itemRef: "stage2_level2_item0", score: 1 }],
      }).ok,
    ).toBe(false);
    expect(
      restoreQtiTestSession(test, { ...snapshotQtiTestSession(initial), status: "completed" }).ok,
    ).toBe(false);
  });
});
