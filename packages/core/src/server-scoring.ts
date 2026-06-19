import type { QtiAttemptStateV1, QtiAttemptStatus, QtiDiagnostic, QtiValue } from "./types.js";
import {
  runTrustedItemSession,
  type QtiTrustedItemParseOptions,
  type QtiTrustedResponseApplication,
  type QtiTrustedResponseInput,
} from "./trusted-item-session.js";

export type QtiServerScoringResponseInput = QtiTrustedResponseInput;

export interface QtiServerScoringInput
  extends QtiTrustedResponseApplication, QtiTrustedItemParseOptions {
  itemXml: string;
  status?: QtiAttemptStatus | undefined;
}

export interface QtiServerScoringResult {
  ok: boolean;
  diagnostics: QtiDiagnostic[];
  state: QtiAttemptStateV1 | null;
  responses: Record<string, QtiValue>;
  outcomes: Record<string, QtiValue>;
  score: number | null;
}

export function scoreQtiItemServerSide(input: QtiServerScoringInput): QtiServerScoringResult {
  const result = runTrustedItemSession({
    itemXml: input.itemXml,
    diagnosticPrefix: "serverScoring",
    allowedUndeclaredResponseIdentifiers: input.allowedUndeclaredResponseIdentifiers,
    submission: {
      trustedResponses: input.trustedResponses,
      trustedInteractionStates: input.trustedInteractionStates,
    },
    attemptStatus: input.status,
    scoring: "always",
    requireNumericScore: true,
  });

  return {
    ok: result.ok,
    diagnostics: result.diagnostics,
    state: result.state,
    responses: result.responses,
    outcomes: result.outcomes,
    score: result.score,
  };
}
