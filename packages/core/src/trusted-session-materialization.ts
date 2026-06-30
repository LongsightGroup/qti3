import {
  classifyQtiItemScoringDisposition,
  type QtiItemSubmissionScoringDisposition,
} from "./scoring-disposition-policy.js";
import type { QtiAssessmentItem, QtiAttemptStateV1, QtiDiagnostic, QtiValue } from "./types.js";
import { snapshotQtiVariableDeclarations, type QtiVariableSnapshot } from "./variable-snapshot.js";

export interface QtiTrustedSessionMaterialization {
  diagnostics: QtiDiagnostic[];
  state: QtiAttemptStateV1;
  responses: Record<string, QtiValue>;
  outcomes: Record<string, QtiValue>;
  score: number | null;
  candidateSafeXml?: string | undefined;
}

export interface QtiItemSubmissionMaterializationSuccess {
  ok: true;
  diagnostics: QtiDiagnostic[];
  state: QtiAttemptStateV1;
  responseVariables: QtiVariableSnapshot[];
  outcomeVariables: QtiVariableSnapshot[];
  score: number | null;
  scoringDisposition: Exclude<QtiItemSubmissionScoringDisposition, "invalid">;
  candidateSafeXml?: string | undefined;
}

export interface QtiItemSubmissionMaterializationFailure {
  ok: false;
  diagnostics: QtiDiagnostic[];
  state?: QtiAttemptStateV1 | undefined;
  responseVariables: QtiVariableSnapshot[];
  outcomeVariables: QtiVariableSnapshot[];
  score: null;
  scoringDisposition: "invalid";
}

export function buildItemSubmissionMaterializationSuccess(
  item: QtiAssessmentItem,
  result: QtiTrustedSessionMaterialization,
): QtiItemSubmissionMaterializationSuccess {
  return {
    ok: true,
    diagnostics: result.diagnostics,
    state: result.state,
    responseVariables: snapshotQtiVariableDeclarations(item.responseDeclarations, result.responses),
    outcomeVariables: snapshotQtiVariableDeclarations(item.outcomeDeclarations, result.outcomes),
    score: result.score,
    scoringDisposition: classifyQtiItemScoringDisposition(item, result.score),
    candidateSafeXml: result.candidateSafeXml,
  };
}

export function buildItemSubmissionMaterializationFailure(
  diagnostics: QtiDiagnostic[],
  state?: QtiAttemptStateV1,
): QtiItemSubmissionMaterializationFailure {
  return {
    ok: false,
    diagnostics,
    state,
    responseVariables: [],
    outcomeVariables: [],
    score: null,
    scoringDisposition: "invalid",
  };
}
