import type {
  QtiAssessmentItem,
  QtiAttemptStateV1,
  QtiDiagnostic,
  QtiDocument,
  QtiScoreResult,
  QtiValue,
} from "./types.js";

export interface QtiItemSession {
  readonly item: QtiAssessmentItem;
  respond(identifier: string, value: QtiValue): void;
  score(): QtiScoreResult;
  serialize(): QtiAttemptStateV1;
}

export function createItemSession(
  document: QtiDocument,
  priorState?: QtiAttemptStateV1,
): QtiItemSession {
  const responses: Record<string, QtiValue> = { ...priorState?.responses };
  const outcomes: Record<string, QtiValue> = {};

  for (const outcome of document.item.outcomeDeclarations) {
    outcomes[outcome.identifier] = outcome.defaultValue;
  }
  Object.assign(outcomes, priorState?.outcomes ?? {});

  return {
    item: document.item,
    respond(identifier: string, value: QtiValue) {
      responses[identifier] = value;
    },
    score() {
      const diagnostics: QtiDiagnostic[] = [];
      for (const declaration of document.item.responseDeclarations) {
        const response = responses[declaration.identifier] ?? null;
        if (declaration.mapping) {
          outcomes.SCORE = scoreMapping(response, declaration.mapping);
          continue;
        }
        if (declaration.correctResponse !== null) {
          outcomes.SCORE = valuesEqual(response, declaration.correctResponse) ? 1 : 0;
        }
      }
      const state = serialize(document.item.identifier, responses, outcomes, diagnostics);
      return { outcomes: { ...outcomes }, diagnostics, state };
    },
    serialize() {
      return serialize(document.item.identifier, responses, outcomes, []);
    },
  };
}

function serialize(
  itemIdentifier: string,
  responses: Record<string, QtiValue>,
  outcomes: Record<string, QtiValue>,
  validationMessages: QtiDiagnostic[],
): QtiAttemptStateV1 {
  return {
    schema: "qti3.attempt-state.v1",
    itemIdentifier,
    responses: { ...responses },
    outcomes: { ...outcomes },
    validationMessages: [...validationMessages],
  };
}

function scoreMapping(response: QtiValue, mapping: Record<string, number>): number {
  if (Array.isArray(response)) {
    return response.reduce((sum, value) => sum + (mapping[value] ?? 0), 0);
  }
  return typeof response === "string" ? (mapping[response] ?? 0) : 0;
}

function valuesEqual(actual: QtiValue, expected: QtiValue): boolean {
  if (Array.isArray(actual) || Array.isArray(expected)) {
    if (!Array.isArray(actual) || !Array.isArray(expected)) return false;
    if (actual.length !== expected.length) return false;
    return [...actual].sort().every((value, index) => value === [...expected].sort()[index]);
  }
  return actual === expected;
}
