import type { QtiAttemptStateV1, QtiValue } from "@longsightgroup/qti3-core";

export interface QtiFixtureAttempt {
  name: string;
  responses: Record<string, QtiValue>;
  expectedOutcomes: Record<string, QtiValue>;
  expectedResponses?: Record<string, QtiValue> | undefined;
  expectedState?: Partial<QtiAttemptStateV1> | undefined;
}

export function basicCorrectAttempt(
  responses: Record<string, QtiValue>,
  expectedOutcomes: Record<string, QtiValue>,
  itemIdentifier: string,
): QtiFixtureAttempt {
  return {
    name: "correct",
    responses,
    expectedResponses: responses,
    expectedOutcomes,
    expectedState: {
      schema: "qti3.attempt-state.v1",
      itemIdentifier,
      status: "interacting",
      responses,
      outcomes: expectedOutcomes,
    },
  };
}
