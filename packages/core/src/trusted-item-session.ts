import { parseQtiXml } from "./parser.js";
import { itemExpectsAutomatedScore } from "./item-scoring-expectation.js";
import { validateQtiResponseVariables } from "./response-validation.js";
import { createItemSession, isQtiAttemptStateV1, type QtiItemSession } from "./session.js";
import type {
  QtiAttemptStateV1,
  QtiAttemptStatus,
  QtiDiagnostic,
  QtiDocument,
  QtiPortableCustomStateValue,
  QtiValue,
} from "./types.js";
import { isQtiPortableCustomStateValue, readQtiJsonValue } from "./value-format.js";
import {
  listNamedResponseInputs,
  type QtiNamedResponseInput,
  type QtiNamedResponsesInput,
} from "./response-input.js";

export type QtiTrustedResponseInput = QtiNamedResponseInput;

export type QtiTrustedResponsesInput = QtiNamedResponsesInput;

export type QtiTrustedInputDiagnosticPrefix = "serverScoring" | "adaptiveTurn" | "itemSubmission";

export type QtiTrustedSubmissionValidation = "trusted" | "strict";

export interface QtiTrustedResponseApplication {
  trustedResponses?: QtiTrustedResponsesInput;
  trustedInteractionStates?: Record<string, QtiPortableCustomStateValue> | undefined;
}

export interface QtiTrustedItemParseOptions {
  allowedUndeclaredResponseIdentifiers?: readonly string[] | undefined;
}

export interface QtiTrustedItemDocument {
  document: QtiDocument;
  diagnostics: QtiDiagnostic[];
  responseIdentifiers: Set<string>;
}

export type QtiTrustedItemScoringPolicy = "always" | "onSubmission";

export interface RunTrustedItemSessionInput extends QtiTrustedItemParseOptions {
  itemXml: string;
  parsedItem?: QtiTrustedItemDocument | undefined;
  diagnosticPrefix: QtiTrustedInputDiagnosticPrefix;
  submission: QtiTrustedResponseApplication;
  priorState?: QtiAttemptStateV1 | null | undefined;
  /** Applied before submission. Intended for server-side scoring, not adaptive turns. */
  attemptStatus?: QtiAttemptStatus | undefined;
  scoring: QtiTrustedItemScoringPolicy;
  requireNumericScore: boolean;
  /**
   * `strict` rejects undeclared and malformed responses before trusted application.
   * `trusted` keeps the legacy warning path for undeclared identifiers.
   */
  submissionValidation?: QtiTrustedSubmissionValidation | undefined;
  allowIncompleteResponses?: boolean | undefined;
}

export interface RunTrustedItemSessionSuccess {
  ok: true;
  diagnostics: QtiDiagnostic[];
  state: QtiAttemptStateV1;
  responses: Record<string, QtiValue>;
  outcomes: Record<string, QtiValue>;
  score: number | null;
}

export interface RunTrustedItemSessionFailure {
  ok: false;
  diagnostics: QtiDiagnostic[];
  state: QtiAttemptStateV1 | null;
  responses: Record<string, QtiValue>;
  outcomes: Record<string, QtiValue>;
  score: number | null;
}

export type RunTrustedItemSessionResult =
  | RunTrustedItemSessionSuccess
  | RunTrustedItemSessionFailure;

export function readPriorAttemptState(
  priorState: unknown,
  diagnosticPrefix: QtiTrustedInputDiagnosticPrefix,
): { state: QtiAttemptStateV1 | null; diagnostics: QtiDiagnostic[] } {
  if (priorState === undefined || priorState === null) return { state: null, diagnostics: [] };
  if (isQtiAttemptStateV1(priorState)) return { state: priorState, diagnostics: [] };
  return {
    state: null,
    diagnostics: [
      {
        code: `${diagnosticPrefix}.state.value`,
        severity: "error",
        message: "Prior attempt state is not a valid qti3.attempt-state.v1 value.",
      },
    ],
  };
}

export function parseTrustedItemDocument(
  itemXml: string,
  allowedUndeclaredResponseIdentifiers: readonly string[] = [],
): { ok: true; parsed: QtiTrustedItemDocument } | { ok: false; diagnostics: QtiDiagnostic[] } {
  let parsed: ReturnType<typeof parseQtiXml>;
  try {
    parsed = parseQtiXml(itemXml);
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "xml.parse",
          severity: "error",
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }

  const allowedUndeclared = new Set(allowedUndeclaredResponseIdentifiers);
  const diagnostics = parsed.diagnostics.filter(
    (diagnostic) => !isAllowedUndeclaredVariableReference(diagnostic, allowedUndeclared),
  );
  if (!parsed.document || diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return { ok: false, diagnostics };
  }

  return {
    ok: true,
    parsed: {
      document: parsed.document,
      diagnostics,
      responseIdentifiers: new Set(
        parsed.document.item.responseDeclarations.map((declaration) => declaration.identifier),
      ),
    },
  };
}

export function runTrustedItemSession(
  input: RunTrustedItemSessionInput,
): RunTrustedItemSessionResult {
  const parsedResult = input.parsedItem
    ? { ok: true as const, parsed: input.parsedItem }
    : parseTrustedItemDocument(input.itemXml, input.allowedUndeclaredResponseIdentifiers);
  if (!parsedResult.ok) {
    return emptyTrustedItemSessionFailure(parsedResult.diagnostics);
  }

  const sessionResult = createTrustedItemSession(
    parsedResult.parsed,
    input.priorState,
    input.diagnosticPrefix,
    input.allowedUndeclaredResponseIdentifiers,
    parsedResult.parsed.diagnostics,
  );
  if (!sessionResult.ok) {
    return emptyTrustedItemSessionFailure(sessionResult.diagnostics);
  }

  if (input.attemptStatus) sessionResult.session.setStatus(input.attemptStatus);

  if (input.submissionValidation === "strict") {
    const validation = validateQtiResponseVariables({
      item: parsedResult.parsed.document.item,
      responses: input.submission.trustedResponses ?? {},
      allowIncompleteResponses: input.allowIncompleteResponses,
      allowedUndeclaredResponseIdentifiers: input.allowedUndeclaredResponseIdentifiers,
    });
    if (!validation.ok) {
      return emptyTrustedItemSessionFailure(validation.diagnostics);
    }
  }

  const applicationResult = applyTrustedResponseApplication(
    sessionResult.session,
    parsedResult.parsed,
    input.submission,
    input.allowedUndeclaredResponseIdentifiers,
    input.diagnosticPrefix,
  );
  const diagnostics = applicationResult.diagnostics;
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return emptyTrustedItemSessionFailure(diagnostics);
  }

  const shouldScore = input.scoring === "always" || applicationResult.appliedSubmission;

  let outcomes = sessionResult.session.serialize().outcomes;
  let state = sessionResult.session.serialize();
  let score: number | null = null;
  let scoredDiagnostics = diagnostics;

  if (shouldScore) {
    const scoredResult = scoreTrustedItemSession(
      sessionResult.session,
      diagnostics,
      input.diagnosticPrefix,
    );
    if (!scoredResult.ok) {
      return emptyTrustedItemSessionFailure(scoredResult.diagnostics);
    }

    scoredDiagnostics = [...diagnostics, ...scoredResult.scored.diagnostics];
    outcomes = scoredResult.scored.outcomes;
    state = stripUndeclaredResponses(
      scoredResult.scored.state,
      parsedResult.parsed.responseIdentifiers,
    );
    score = readNumericScore(outcomes.SCORE);

    if (scoredResult.scored.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
      return emptyTrustedItemSessionFailure(scoredDiagnostics, {
        state,
        responses: state.responses,
        outcomes,
        score,
      });
    }

    if (
      input.requireNumericScore &&
      itemExpectsAutomatedScore(parsedResult.parsed.document.item) &&
      score === null
    ) {
      return emptyTrustedItemSessionFailure(
        [...scoredDiagnostics, missingNumericScoreDiagnostic(input.diagnosticPrefix)],
        {
          state,
          responses: state.responses,
          outcomes,
          score,
        },
      );
    }
  } else {
    state = stripUndeclaredResponses(state, parsedResult.parsed.responseIdentifiers);
    outcomes = state.outcomes;
    score = readNumericScore(outcomes.SCORE);
  }

  return {
    ok: true,
    diagnostics: scoredDiagnostics,
    state,
    responses: state.responses,
    outcomes,
    score,
  };
}

function emptyTrustedItemSessionFailure(
  diagnostics: QtiDiagnostic[],
  partial: Partial<
    Pick<RunTrustedItemSessionFailure, "state" | "responses" | "outcomes" | "score">
  > = {},
): RunTrustedItemSessionFailure {
  return {
    ok: false,
    diagnostics,
    state: partial.state ?? null,
    responses: partial.responses ?? partial.state?.responses ?? {},
    outcomes: partial.outcomes ?? partial.state?.outcomes ?? {},
    score: partial.score ?? null,
  };
}

function createTrustedItemSession(
  parsed: QtiTrustedItemDocument,
  priorState: QtiAttemptStateV1 | null | undefined,
  diagnosticPrefix: QtiTrustedInputDiagnosticPrefix,
  allowedUndeclaredResponseIdentifiers: readonly string[] | undefined,
  existingDiagnostics: QtiDiagnostic[] = [],
): { ok: true; session: QtiItemSession } | { ok: false; diagnostics: QtiDiagnostic[] } {
  try {
    return {
      ok: true,
      session: createItemSession(parsed.document, priorState ?? undefined, {
        allowedUndeclaredResponseIdentifiers,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        ...existingDiagnostics,
        {
          code: `${diagnosticPrefix}.state.restore`,
          severity: "error",
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
}

function applyTrustedResponseApplication(
  session: QtiItemSession,
  parsed: QtiTrustedItemDocument,
  submission: QtiTrustedResponseApplication,
  allowedUndeclaredResponseIdentifiers: readonly string[] | undefined,
  diagnosticPrefix: QtiTrustedInputDiagnosticPrefix,
): { diagnostics: QtiDiagnostic[]; appliedSubmission: boolean } {
  const diagnostics = [...parsed.diagnostics];
  const allowedUndeclared = new Set(allowedUndeclaredResponseIdentifiers ?? []);
  let appliedSubmission = false;

  for (const response of listNamedResponseInputs(submission.trustedResponses)) {
    const identifier = response.identifier.trim();
    if (!identifier) {
      diagnostics.push({
        code: `${diagnosticPrefix}.response.identifier`,
        severity: "error",
        message: "Trusted response identifiers must be non-empty strings.",
      });
      continue;
    }

    if (!parsed.responseIdentifiers.has(identifier) && !allowedUndeclared.has(identifier)) {
      diagnostics.push({
        code: `${diagnosticPrefix}.response.ignored`,
        severity: "warning",
        message: `Trusted response ${identifier} was ignored because it is not declared by the item.`,
      });
      continue;
    }

    const value = readQtiJsonValue(response.value);
    if (value === undefined) {
      diagnostics.push({
        code: `${diagnosticPrefix}.response.value`,
        severity: "error",
        message: `Trusted response ${identifier} is not a supported QTI value.`,
      });
      continue;
    }
    session.respond(identifier, value);
    appliedSubmission = true;
  }

  for (const [identifier, state] of Object.entries(submission.trustedInteractionStates ?? {})) {
    if (!isQtiPortableCustomStateValue(state)) {
      diagnostics.push({
        code: `${diagnosticPrefix}.interactionState.value`,
        severity: "error",
        message: `Trusted interaction state ${identifier} is not a supported portable custom state value.`,
      });
      continue;
    }

    try {
      session.setInteractionState(identifier, state);
      appliedSubmission = true;
    } catch (error) {
      diagnostics.push({
        code: `${diagnosticPrefix}.interactionState.identifier`,
        severity: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { diagnostics, appliedSubmission };
}

function scoreTrustedItemSession(
  session: QtiItemSession,
  diagnostics: QtiDiagnostic[],
  diagnosticPrefix: QtiTrustedInputDiagnosticPrefix,
):
  | { ok: true; scored: ReturnType<QtiItemSession["score"]> }
  | { ok: false; diagnostics: QtiDiagnostic[] } {
  try {
    return { ok: true, scored: session.score() };
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        ...diagnostics,
        {
          code: `${diagnosticPrefix}.score.exception`,
          severity: "error",
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
}

function readNumericScore(value: QtiValue | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const score = Number(value.trim());
    return Number.isFinite(score) ? score : null;
  }
  return null;
}

function missingNumericScoreDiagnostic(
  diagnosticPrefix: QtiTrustedInputDiagnosticPrefix,
): QtiDiagnostic {
  return {
    code: `${diagnosticPrefix}.score.missing`,
    severity: "error",
    message: "Server-side scoring did not produce a numeric SCORE outcome.",
  };
}

function stripUndeclaredResponses(
  state: QtiAttemptStateV1,
  declaredResponseIdentifiers: Set<string>,
): QtiAttemptStateV1 {
  return {
    ...state,
    responses: Object.fromEntries(
      Object.entries(state.responses).filter(([identifier]) =>
        declaredResponseIdentifiers.has(identifier),
      ),
    ),
  };
}

function isAllowedUndeclaredVariableReference(
  diagnostic: QtiDiagnostic,
  allowedUndeclaredResponseIdentifiers: Set<string>,
): boolean {
  if (diagnostic.code !== "processing.variable.reference") return false;
  const identifier = diagnostic.message.match(
    /^Processing expression references missing variable (.+)\.$/,
  )?.[1];
  return Boolean(identifier && allowedUndeclaredResponseIdentifiers.has(identifier));
}
