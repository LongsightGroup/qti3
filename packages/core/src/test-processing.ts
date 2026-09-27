import { assertNever } from "./assert-never.js";
import type { QtiTestExpression } from "./test-expression.js";
import { testFailure, type QtiTestResult, type QtiExecutableTest } from "./test-model.js";

/** Trusted server-scored submission. Item scores are finite scalar numbers. */
export interface QtiTestSubmission {
  readonly itemRef: string;
  readonly score: number;
}

type TestValue = number | boolean | string | number[] | null;

/** Data used by the deterministic test interpreter; no item session state or hooks. */
export interface TestExpressionValues {
  readonly outcomes: Readonly<Record<string, TestValue>>;
  readonly submissions: readonly QtiTestSubmission[];
  readonly categories: ReadonlyMap<string, readonly string[]>;
}

/** Evaluate a validated test expression using QTI null and three-valued boolean semantics. */
export function evaluateTestExpression(
  expression: QtiTestExpression,
  values: TestExpressionValues,
): QtiTestResult<TestValue> {
  const state = { failed: false };
  const evaluate = (child: QtiTestExpression): TestValue => {
    if (state.failed) return null;
    const result = evaluateTestNode(child, values, evaluate);
    if (typeof result === "number" && !Number.isFinite(result)) {
      state.failed = true;
      return null;
    }
    return result;
  };
  const value = evaluate(expression);
  return state.failed
    ? testFailure("processing.nonFinite", "Test processing produced a non-finite number.")
    : { ok: true, value };
}

function evaluateTestNode(
  expression: QtiTestExpression,
  values: TestExpressionValues,
  evaluate: (child: QtiTestExpression) => TestValue,
): TestValue {
  switch (expression.type) {
    case "baseValue":
      return expression.value;
    case "variable":
      return values.outcomes[expression.identifier] ?? null;
    case "testVariables": {
      const scores = values.submissions
        .filter(
          (submission) =>
            expression.includeCategory === undefined ||
            values.categories.get(submission.itemRef)?.includes(expression.includeCategory),
        )
        .map((submission) => submission.score);
      return scores.length ? scores : null;
    }
    case "sum": {
      let sum = 0;
      for (const child of expression.expressions) {
        const value = evaluate(child);
        if (value === null) return null;
        if (typeof value === "number") sum += value;
        else if (typeof value === "object") for (const number of value) sum += number;
        else return null;
      }
      return sum;
    }
    case "numericCompare": {
      const left = evaluate(expression.left);
      const right = evaluate(expression.right);
      if (typeof left !== "number" || typeof right !== "number") return null;
      switch (expression.operator) {
        case "gt":
          return left > right;
        case "gte":
          return left >= right;
        case "lt":
          return left < right;
        case "lte":
          return left <= right;
        default:
          return assertNever(expression.operator);
      }
    }
    case "and":
    case "or": {
      const decisive = expression.type === "or";
      let sawNull = false;
      for (const child of expression.expressions) {
        const value = evaluate(child);
        if (value === decisive) return decisive;
        if (value === null) sawNull = true;
      }
      return sawNull ? null : !decisive;
    }
    case "not": {
      const value = evaluate(expression.expression);
      return value === null ? null : !value;
    }
    default:
      return assertNever(expression);
  }
}

/** Recompute outcomes from defaults and committed scores, in assignment order. */
export function processTestOutcomes(
  test: QtiExecutableTest,
  submissions: readonly QtiTestSubmission[],
): QtiTestResult<{ readonly outcomes: Record<string, TestValue> }> {
  const outcomes: Record<string, TestValue> = Object.fromEntries(
    test.outcomeDeclarations.map((d) => [d.identifier, d.defaultValue]),
  );
  const categories = new Map(
    test.sections.flatMap((s) => s.items.map((i) => [i.identifier, i.categories] as const)),
  );
  for (const rule of test.outcomeProcessing) {
    const result = evaluateTestExpression(rule.expression, {
      outcomes,
      submissions,
      categories,
    });
    if (!result.ok) return result;
    outcomes[rule.identifier] = result.value;
  }
  return { ok: true, value: { outcomes } };
}
