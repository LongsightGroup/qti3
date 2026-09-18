import { createEvaluationContext } from "./processing-evaluator.js";
import type { QtiExecutableTest } from "./test-model.js";
import type { QtiValue } from "./types.js";

/** Trusted server-scored submission. Item scores are finite scalar numbers. */
export interface QtiTestSubmission {
  readonly itemRef: string;
  readonly score: number;
}

/** Recompute test outcomes from defaults and committed item outcomes, as required by QTI. */
export function processTestOutcomes(
  test: QtiExecutableTest,
  submissions: readonly QtiTestSubmission[],
) {
  const outcomes: Record<string, QtiValue> = Object.fromEntries(
    test.outcomeDeclarations.map((d) => [d.identifier, d.defaultValue]),
  );
  const categories = new Map(
    test.sections.flatMap((s) => s.items.map((i) => [i.identifier, i.categories] as const)),
  );
  const context = createEvaluationContext(
    { test },
    {},
    outcomes,
    {},
    {},
    () => {
      throw new Error("Validated deterministic test processing cannot request randomness.");
    },
    {},
    {
      builtInVariable: () => undefined,
      testVariables: (expression) => {
        const scores = submissions
          .filter(
            (submission) =>
              expression.includeCategory === undefined ||
              categories.get(submission.itemRef)?.includes(expression.includeCategory),
          )
          .map((submission) => submission.score);
        return scores.length ? scores : null;
      },
    },
  );
  for (const rule of test.outcomeProcessing)
    outcomes[rule.identifier] = context.evaluate(rule.expression);
  return context;
}
