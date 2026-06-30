import { runTrustedAdaptiveItemTurn } from "./adaptive-turn.js";
import type { QtiItemSubmissionScoringDisposition } from "./scoring-disposition-policy.js";
import {
  buildItemSubmissionMaterializationFailure,
  buildItemSubmissionMaterializationSuccess,
} from "./trusted-session-materialization.js";
import {
  parseTrustedItemDocument,
  readPriorAttemptState,
  runTrustedItemSession,
  type QtiTrustedItemDocument,
  type QtiTrustedItemParseOptions,
  type QtiTrustedResponseInput,
  type QtiTrustedResponseApplication,
} from "./trusted-item-session.js";
import type { QtiAttemptStateV1, QtiDiagnostic } from "./types.js";
import type { QtiVariableSnapshot } from "./variable-snapshot.js";

export type QtiItemSubmissionResponseInput = QtiTrustedResponseInput;
export type { QtiItemSubmissionScoringDisposition } from "./scoring-disposition-policy.js";
export type { QtiVariableSnapshot } from "./variable-snapshot.js";

export interface QtiItemSubmissionMaterializationInput
  extends QtiTrustedItemParseOptions, QtiTrustedResponseApplication {
  itemXml: string;
  existingState?: unknown;
  allowIncompleteResponses?: boolean | undefined;
}

export interface QtiItemSubmissionMaterializationResult {
  ok: boolean;
  diagnostics: QtiDiagnostic[];
  state?: QtiAttemptStateV1 | undefined;
  responseVariables: QtiVariableSnapshot[];
  outcomeVariables: QtiVariableSnapshot[];
  score: number | null;
  scoringDisposition: QtiItemSubmissionScoringDisposition;
  candidateSafeXml?: string | undefined;
}

/** Materialize trusted submitted responses into QTI attempt state and variable snapshots. */
export function materializeQtiItemSubmission(
  input: QtiItemSubmissionMaterializationInput,
): QtiItemSubmissionMaterializationResult {
  const parsedResult = parseTrustedItemDocument(
    input.itemXml,
    input.allowedUndeclaredResponseIdentifiers,
  );
  if (!parsedResult.ok) {
    return buildItemSubmissionMaterializationFailure(parsedResult.diagnostics);
  }

  const item = parsedResult.parsed.document.item;
  if (item.adaptive) {
    return materializeAdaptiveSubmission(input, parsedResult.parsed);
  }

  const priorState = readPriorAttemptState(input.existingState, "itemSubmission");
  if (priorState.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return buildItemSubmissionMaterializationFailure(priorState.diagnostics);
  }

  const result = runTrustedItemSession({
    itemXml: input.itemXml,
    parsedItem: parsedResult.parsed,
    diagnosticPrefix: "itemSubmission",
    allowedUndeclaredResponseIdentifiers: input.allowedUndeclaredResponseIdentifiers,
    priorState: priorState.state,
    submission: {
      trustedResponses: input.trustedResponses,
      trustedInteractionStates: input.trustedInteractionStates,
    },
    scoring: "always",
    requireNumericScore: false,
    submissionValidation: "strict",
    allowIncompleteResponses: input.allowIncompleteResponses,
  });

  if (!result.ok) {
    return buildItemSubmissionMaterializationFailure(result.diagnostics, result.state ?? undefined);
  }

  return buildItemSubmissionMaterializationSuccess(item, {
    diagnostics: result.diagnostics,
    state: result.state,
    responses: result.responses,
    outcomes: result.outcomes,
    score: result.score,
  });
}

function materializeAdaptiveSubmission(
  input: QtiItemSubmissionMaterializationInput,
  parsedItem: QtiTrustedItemDocument,
): QtiItemSubmissionMaterializationResult {
  const result = runTrustedAdaptiveItemTurn({
    itemXml: input.itemXml,
    parsedItem,
    diagnosticPrefix: "itemSubmission",
    allowedUndeclaredResponseIdentifiers: input.allowedUndeclaredResponseIdentifiers,
    priorState: input.existingState,
    trustedResponses: input.trustedResponses,
    trustedInteractionStates: input.trustedInteractionStates,
    submissionValidation: "strict",
    allowIncompleteResponses: input.allowIncompleteResponses,
  });

  if (!result.ok || !result.state) {
    return buildItemSubmissionMaterializationFailure(result.diagnostics, result.state ?? undefined);
  }

  return buildItemSubmissionMaterializationSuccess(parsedItem.document.item, {
    diagnostics: result.diagnostics,
    state: result.state,
    responses: result.responses,
    outcomes: result.outcomes,
    score: result.score,
    candidateSafeXml: result.candidateSafeXml,
  });
}
