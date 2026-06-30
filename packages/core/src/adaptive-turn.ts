import { materializeAdaptiveCandidateView } from "./adaptive-turn-materializer.js";
import type { QtiAttemptStateV1, QtiDiagnostic, QtiValue } from "./types.js";
import {
  readPriorAttemptState,
  runTrustedItemSession,
  type QtiTrustedItemParseOptions,
  type QtiTrustedResponseApplication,
  type QtiTrustedResponseInput,
} from "./trusted-item-session.js";

export type QtiAdaptiveTurnResponseInput = QtiTrustedResponseInput;

export interface QtiAdaptiveTurnInput
  extends QtiTrustedItemParseOptions, QtiTrustedResponseApplication {
  itemXml: string;
  /**
   * Prior attempt state from a previous adaptive turn. Non-conforming values produce
   * `adaptiveTurn.state.value` diagnostics instead of being silently accepted.
   */
  priorState?: unknown;
}

export interface QtiAdaptiveTurnResult {
  ok: boolean;
  diagnostics: QtiDiagnostic[];
  state: QtiAttemptStateV1 | null;
  responses: Record<string, QtiValue>;
  outcomes: Record<string, QtiValue>;
  score: number | null;
  completionStatus: QtiValue;
  candidateSafeXml?: string | undefined;
}

export function processQtiAdaptiveItemTurn(input: QtiAdaptiveTurnInput): QtiAdaptiveTurnResult {
  const priorStateResult = readPriorAttemptState(input.priorState, "adaptiveTurn");
  if (priorStateResult.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return failed(priorStateResult.diagnostics);
  }

  const sessionResult = runTrustedItemSession({
    itemXml: input.itemXml,
    diagnosticPrefix: "adaptiveTurn",
    allowedUndeclaredResponseIdentifiers: input.allowedUndeclaredResponseIdentifiers,
    priorState: priorStateResult.state,
    submission: {
      trustedResponses: input.trustedResponses,
      trustedInteractionStates: input.trustedInteractionStates,
    },
    scoring: "onSubmission",
    requireNumericScore: true,
  });
  if (!sessionResult.ok) {
    return failed(
      sessionResult.diagnostics,
      sessionResult.state,
      sessionResult.outcomes,
      sessionResult.score,
    );
  }

  const delivery = materializeAdaptiveCandidateView({
    itemXml: input.itemXml,
    outcomes: sessionResult.outcomes,
  });
  const deliveryDiagnostics = [...sessionResult.diagnostics, ...delivery.diagnostics];
  const candidateSafeXml = delivery.xml;
  if (!delivery.ok || !candidateSafeXml) {
    return failed(
      [
        ...deliveryDiagnostics,
        {
          code: "adaptiveTurn.delivery.materialization",
          severity: "error",
          message: "Adaptive turn did not produce candidate-safe item XML.",
        },
      ],
      sessionResult.state,
      sessionResult.outcomes,
      sessionResult.score,
    );
  }

  return {
    ok: true,
    diagnostics: deliveryDiagnostics,
    state: sessionResult.state,
    responses: sessionResult.responses,
    outcomes: sessionResult.outcomes,
    score: sessionResult.score,
    completionStatus: sessionResult.outcomes.completionStatus ?? null,
    candidateSafeXml,
  };
}

function failed(
  diagnostics: QtiDiagnostic[],
  state: QtiAttemptStateV1 | null = null,
  outcomes: Record<string, QtiValue> = {},
  score: number | null = null,
): QtiAdaptiveTurnResult {
  return {
    ok: false,
    diagnostics,
    state,
    responses: state?.responses ?? {},
    outcomes,
    score,
    completionStatus: outcomes.completionStatus ?? null,
  };
}
