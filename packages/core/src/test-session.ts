import {
  evaluateTestExpression,
  processTestOutcomes,
  type QtiTestSubmission,
} from "./test-processing.js";
import {
  testFailure,
  type QtiExecutableTest,
  type QtiTestItemRef,
  type QtiTestResult,
} from "./test-model.js";
import type { QtiValue } from "./types.js";

interface TestSessionBase {
  readonly testIdentifier: string;
  readonly submissions: readonly QtiTestSubmission[];
  readonly outcomes: Readonly<Record<string, QtiValue>>;
}

/** Live route state. Only an active session has a current item. */
export type QtiTestSession = TestSessionBase &
  (
    | { readonly status: "active"; readonly currentItemRef: string }
    | { readonly status: "completed" }
  );

/** Stable JSON contract: computed frontier/outcomes are reconstructed, never trusted. */
export interface QtiTestSessionSnapshot {
  readonly version: 1;
  readonly testIdentifier: string;
  readonly submissions: readonly QtiTestSubmission[];
}

/** Start a validated test at its first item. */
export function startQtiTest(test: QtiExecutableTest): QtiTestSession {
  const first = test.sections[0].items[0];
  return {
    status: "active",
    testIdentifier: test.identifier,
    currentItemRef: first.identifier,
    submissions: [],
    outcomes: processTestOutcomes(test, []).outcomes,
  };
}

/** Accept one trusted scored answer at the frontier; does not mutate input state. */
export function submitQtiTestAnswer(
  test: QtiExecutableTest,
  session: QtiTestSession,
  submission: QtiTestSubmission,
): QtiTestResult<QtiTestSession> {
  if (session.testIdentifier !== test.identifier)
    return testFailure("session.test", "Session belongs to another test.");
  if (session.status !== "active" || session.currentItemRef !== submission.itemRef)
    return testFailure("session.frontier", "Only the current unanswered item can be submitted.");
  if (!Number.isFinite(submission.score))
    return testFailure("session.score", "Item score must be a finite number.");
  const sectionIndex = test.sections.findIndex((s) =>
    s.items.some((i) => i.identifier === submission.itemRef),
  );
  const section = test.sections[sectionIndex];
  if (!section) return testFailure("session.item", "Current item does not belong to the test.");
  const submissions = [
    ...session.submissions,
    { itemRef: submission.itemRef, score: submission.score },
  ];
  const { outcomes } = processTestOutcomes(test, submissions);
  const base = { testIdentifier: test.identifier, submissions, outcomes };
  const next = nextItemAfter(
    test,
    sectionIndex,
    submission.itemRef,
    (expression) =>
      evaluateTestExpression(expression, {
        outcomes,
        submissions,
        categories: new Map(
          test.sections.flatMap((candidate) =>
            candidate.items.map((item) => [item.identifier, item.categories] as const),
          ),
        ),
      }) === true,
  );
  return {
    ok: true,
    value: next
      ? { ...base, status: "active", currentItemRef: next.identifier }
      : { ...base, status: "completed" },
  };
}

function nextItemAfter(
  test: QtiExecutableTest,
  sectionIndex: number,
  itemRef: string,
  evaluate: (expression: import("./test-expression.js").QtiTestExpression) => boolean,
): QtiTestItemRef | undefined {
  const section = test.sections[sectionIndex];
  if (!section) return undefined;
  const nextItem =
    section.items[section.items.findIndex((item) => item.identifier === itemRef) + 1];
  if (nextItem) return nextItem;
  const branch = section.branches.find((candidate) => evaluate(candidate.expression));
  if (branch?.target === "EXIT_TEST") return undefined;
  const nextSection = branch
    ? test.sections.find((candidate) => candidate.identifier === branch.target)
    : test.sections[sectionIndex + 1];
  return nextSection?.items[0];
}

/** Project session state into its minimal persisted contract. */
export function snapshotQtiTestSession(session: QtiTestSession): QtiTestSessionSnapshot {
  return {
    version: 1,
    testIdentifier: session.testIdentifier,
    submissions: session.submissions.map((s) => ({ itemRef: s.itemRef, score: s.score })),
  };
}

/** Parse persisted state and replay it against the pinned test to reject impossible routes. */
export function restoreQtiTestSession(
  test: QtiExecutableTest,
  input: unknown,
): QtiTestResult<QtiTestSession> {
  if (
    typeof input !== "object" ||
    input === null ||
    !("version" in input) ||
    input.version !== 1 ||
    !("testIdentifier" in input) ||
    input.testIdentifier !== test.identifier ||
    !("submissions" in input) ||
    !Array.isArray(input.submissions) ||
    Object.keys(input).some((k) => !["version", "testIdentifier", "submissions"].includes(k))
  )
    return testFailure("session.snapshot", "Invalid test session snapshot.");
  if (input.submissions.length > test.sections.reduce((n, s) => n + s.items.length, 0))
    return testFailure("session.length", "Session exceeds test inventory.");
  let session = startQtiTest(test);
  for (const raw of input.submissions) {
    const value: unknown = raw;
    if (
      typeof value !== "object" ||
      value === null ||
      !("itemRef" in value) ||
      typeof value.itemRef !== "string" ||
      !("score" in value) ||
      typeof value.score !== "number" ||
      Object.keys(value).some((k) => k !== "itemRef" && k !== "score")
    )
      return testFailure("session.submission", "Invalid saved test submission.");
    const result = submitQtiTestAnswer(test, session, {
      itemRef: value.itemRef,
      score: value.score,
    });
    if (!result.ok) return result;
    session = result.value;
  }
  return { ok: true, value: session };
}
