import { createItemSession } from "./session.js";
import { parseQtiXml } from "./parser.js";
import type {
  QtiAssessmentItem,
  QtiAttemptStateV1,
  QtiAttemptStatus,
  QtiDiagnostic,
  QtiPortableCustomStateValue,
  QtiScoreResult,
  QtiValue,
} from "./types.js";
import { isQtiPortableCustomStateValue, readQtiJsonValue } from "./value-format.js";

export interface QtiServerScoringResponseInput {
  identifier: string;
  value: unknown;
}

export interface QtiServerScoringInput {
  itemXml: string;
  /**
   * Server-trusted response values. This API validates JSON/QTI value shape and declared
   * identifiers, but it does not run candidate response-validation policy such as required
   * interactions or min/max response counts.
   */
  trustedResponses?: Record<string, unknown> | readonly QtiServerScoringResponseInput[] | undefined;
  trustedInteractionStates?: Record<string, QtiPortableCustomStateValue> | undefined;
  status?: QtiAttemptStatus | undefined;
  allowedUndeclaredResponseIdentifiers?: readonly string[] | undefined;
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
  let parsed: ReturnType<typeof parseQtiXml>;
  try {
    parsed = parseQtiXml(input.itemXml);
  } catch (error) {
    return failed([
      {
        code: "xml.parse",
        severity: "error",
        message: error instanceof Error ? error.message : String(error),
      },
    ]);
  }

  const allowedUndeclaredResponseIdentifiers = new Set(
    input.allowedUndeclaredResponseIdentifiers ?? [],
  );
  const parseDiagnostics = parsed.diagnostics.filter(
    (diagnostic) =>
      !isAllowedUndeclaredVariableReference(diagnostic, allowedUndeclaredResponseIdentifiers),
  );
  if (!parsed.document || parseDiagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return failed(parseDiagnostics);
  }

  const diagnostics = [...parseDiagnostics];
  const session = createItemSession(parsed.document);
  if (input.status) session.setStatus(input.status);

  const responseIdentifiers = new Set(
    parsed.document.item.responseDeclarations.map((declaration) => declaration.identifier),
  );

  for (const response of normalizeResponseInputs(input.trustedResponses)) {
    const identifier = response.identifier.trim();
    if (!identifier) {
      diagnostics.push({
        code: "serverScoring.response.identifier",
        severity: "error",
        message: "Trusted response identifiers must be non-empty strings.",
      });
      continue;
    }

    if (
      !responseIdentifiers.has(identifier) &&
      !allowedUndeclaredResponseIdentifiers.has(identifier)
    ) {
      diagnostics.push({
        code: "serverScoring.response.ignored",
        severity: "warning",
        message: `Trusted response ${identifier} was ignored because it is not declared by the item.`,
      });
      continue;
    }

    const value = readQtiJsonValue(response.value);
    if (value === undefined) {
      diagnostics.push({
        code: "serverScoring.response.value",
        severity: "error",
        message: `Trusted response ${identifier} is not a supported QTI value.`,
      });
      continue;
    }
    session.respond(identifier, value);
  }

  for (const [identifier, state] of Object.entries(input.trustedInteractionStates ?? {})) {
    if (!isQtiPortableCustomStateValue(state)) {
      diagnostics.push({
        code: "serverScoring.interactionState.value",
        severity: "error",
        message: `Trusted interaction state ${identifier} is not a supported portable custom state value.`,
      });
      continue;
    }

    try {
      session.setInteractionState(identifier, state);
    } catch (error) {
      diagnostics.push({
        code: "serverScoring.interactionState.identifier",
        severity: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return failed(diagnostics);
  }

  let scored: QtiScoreResult;
  try {
    scored = session.score();
  } catch (error) {
    return failed([
      ...diagnostics,
      {
        code: "serverScoring.score.exception",
        severity: "error",
        message: error instanceof Error ? error.message : String(error),
      },
    ]);
  }

  const scoredDiagnostics = [...diagnostics, ...scored.diagnostics];
  const score = readNumericScore(scored.outcomes.SCORE);
  const scoredState = stripUndeclaredResponses(scored.state, responseIdentifiers);
  if (scored.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return failed(scoredDiagnostics, scoredState, scored.outcomes, score);
  }

  if (shouldRequireNumericScore(parsed.document.item) && score === null) {
    return failed(
      [
        ...scoredDiagnostics,
        {
          code: "serverScoring.score.missing",
          severity: "error",
          message: "Server-side scoring did not produce a numeric SCORE outcome.",
        },
      ],
      scoredState,
      scored.outcomes,
      score,
    );
  }

  return {
    ok: true,
    diagnostics: scoredDiagnostics,
    state: scoredState,
    responses: scoredState.responses,
    outcomes: scored.outcomes,
    score,
  };
}

function normalizeResponseInputs(
  responses: QtiServerScoringInput["trustedResponses"],
): QtiServerScoringResponseInput[] {
  if (!responses) return [];
  if (Array.isArray(responses)) return [...responses];
  return Object.entries(responses).map(([identifier, value]) => ({ identifier, value }));
}

function shouldRequireNumericScore(item: QtiAssessmentItem): boolean {
  return (
    Boolean(item.responseProcessing) ||
    item.outcomeDeclarations.some((declaration) => declaration.identifier === "SCORE")
  );
}

function readNumericScore(value: QtiValue | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const score = Number(value.trim());
    return Number.isFinite(score) ? score : null;
  }
  return null;
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

function failed(
  diagnostics: QtiDiagnostic[],
  state: QtiAttemptStateV1 | null = null,
  outcomes: Record<string, QtiValue> = {},
  score: number | null = null,
): QtiServerScoringResult {
  return {
    ok: false,
    diagnostics,
    state,
    responses: state?.responses ?? {},
    outcomes,
    score,
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
