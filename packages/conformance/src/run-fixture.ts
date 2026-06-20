import {
  createItemSession,
  isConformanceParseDiagnostic,
  parseQtiXml,
  validateAssessmentItem,
  type QtiAttemptStateV1,
  type QtiDiagnostic,
  type QtiValue,
} from "@longsightgroup/qti3-core";
import type { QtiExpectedDiagnostic, QtiFixture } from "@longsightgroup/qti3-fixtures";

export interface QtiConformanceResult {
  fixtureId: string;
  ok: boolean;
  diagnostics: QtiDiagnostic[];
}

export function runFixture(fixture: QtiFixture): QtiConformanceResult {
  const parseResult = parseQtiXml(fixture.xml);
  const parseDiagnostics = parseResult.diagnostics.filter(isParseDiagnostic);
  const diagnostics: QtiDiagnostic[] = [];
  assertExpectedDiagnostics(
    fixture,
    "parse",
    fixture.expectedParseDiagnostics,
    parseDiagnostics,
    diagnostics,
  );

  if (!parseResult.document) {
    return { fixtureId: fixture.id, ok: false, diagnostics };
  }

  const validation = validateAssessmentItem(parseResult.document);
  assertExpectedDiagnostics(
    fixture,
    "validation",
    fixture.expectedValidationDiagnostics,
    validation.diagnostics,
    diagnostics,
  );

  for (const attempt of fixture.attempts) {
    const session = createItemSession(parseResult.document);
    for (const [identifier, value] of Object.entries(attempt.responses)) {
      session.respond(identifier, value);
    }
    const scored = session.score();
    const state = scored.state;

    for (const [identifier, expected] of Object.entries(attempt.expectedResponses ?? {})) {
      if (!valuesEqual(state.responses[identifier] ?? null, expected)) {
        diagnostics.push({
          code: "fixture.response",
          severity: "error",
          message: `${fixture.id}/${attempt.name} expected response ${identifier}=${formatValue(expected)} but got ${formatValue(state.responses[identifier] ?? null)}.`,
        });
      }
    }

    for (const [identifier, expected] of Object.entries(attempt.expectedOutcomes)) {
      if (!valuesEqual(scored.outcomes[identifier] ?? null, expected)) {
        diagnostics.push({
          code: "fixture.outcome",
          severity: "error",
          message: `${fixture.id}/${attempt.name} expected outcome ${identifier}=${formatValue(expected)} but got ${formatValue(scored.outcomes[identifier] ?? null)}.`,
        });
      }
    }

    if (attempt.expectedState) {
      assertExpectedState(fixture, attempt.name, attempt.expectedState, state, diagnostics);
    }
  }

  return {
    fixtureId: fixture.id,
    ok: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

function assertExpectedDiagnostics(
  fixture: QtiFixture,
  phase: "parse" | "validation",
  expectedDiagnostics: QtiExpectedDiagnostic[],
  actualDiagnostics: QtiDiagnostic[],
  diagnostics: QtiDiagnostic[],
): void {
  for (const expected of expectedDiagnostics) {
    if (actualDiagnostics.some((actual) => diagnosticMatches(actual, expected))) continue;
    diagnostics.push({
      code: "fixture.diagnostic.missing",
      severity: "error",
      message: `${fixture.id} expected ${phase} diagnostic ${expected.code} but it was not reported.`,
    });
  }

  const unexpected = actualDiagnostics.filter(
    (actual) => !expectedDiagnostics.some((expected) => diagnosticMatches(actual, expected)),
  );
  for (const actual of unexpected) {
    if (actual.severity !== "error" && expectedDiagnostics.length === 0) continue;
    diagnostics.push({
      code: "fixture.diagnostic.unexpected",
      severity: "error",
      message: `${fixture.id} reported unexpected ${phase} diagnostic ${actual.code}.`,
    });
  }
}

function diagnosticMatches(actual: QtiDiagnostic, expected: QtiExpectedDiagnostic): boolean {
  return (
    actual.code === expected.code &&
    (!expected.severity || actual.severity === expected.severity) &&
    (!expected.path || actual.path === expected.path)
  );
}

function isParseDiagnostic(diagnostic: QtiDiagnostic): boolean {
  return isConformanceParseDiagnostic(diagnostic.code);
}

function assertExpectedState(
  fixture: QtiFixture,
  attemptName: string,
  expected: Partial<QtiAttemptStateV1>,
  actual: QtiAttemptStateV1,
  diagnostics: QtiDiagnostic[],
): void {
  if (expected.schema && !valuesEqual(actual.schema, expected.schema)) {
    stateMismatch(fixture, attemptName, "schema", expected.schema, actual.schema, diagnostics);
  }
  if (expected.itemIdentifier && actual.itemIdentifier !== expected.itemIdentifier) {
    stateMismatch(
      fixture,
      attemptName,
      "itemIdentifier",
      expected.itemIdentifier,
      actual.itemIdentifier,
      diagnostics,
    );
  }
  if (expected.status && actual.status !== expected.status) {
    stateMismatch(fixture, attemptName, "status", expected.status, actual.status, diagnostics);
  }
  if (expected.responses) {
    for (const [identifier, expectedValue] of Object.entries(expected.responses)) {
      if (!valuesEqual(actual.responses[identifier] ?? null, expectedValue)) {
        stateMismatch(
          fixture,
          attemptName,
          `responses.${identifier}`,
          expectedValue,
          actual.responses[identifier] ?? null,
          diagnostics,
        );
      }
    }
  }
  if (expected.outcomes) {
    for (const [identifier, expectedValue] of Object.entries(expected.outcomes)) {
      if (!valuesEqual(actual.outcomes[identifier] ?? null, expectedValue)) {
        stateMismatch(
          fixture,
          attemptName,
          `outcomes.${identifier}`,
          expectedValue,
          actual.outcomes[identifier] ?? null,
          diagnostics,
        );
      }
    }
  }
  if (expected.templateValues) {
    for (const [identifier, expectedValue] of Object.entries(expected.templateValues)) {
      if (!valuesEqual(actual.templateValues?.[identifier] ?? null, expectedValue)) {
        stateMismatch(
          fixture,
          attemptName,
          `templateValues.${identifier}`,
          expectedValue,
          actual.templateValues?.[identifier] ?? null,
          diagnostics,
        );
      }
    }
  }
}

function stateMismatch(
  fixture: QtiFixture,
  attemptName: string,
  path: string,
  expected: QtiValue,
  actual: QtiValue,
  diagnostics: QtiDiagnostic[],
): void {
  diagnostics.push({
    code: "fixture.state",
    severity: "error",
    message: `${fixture.id}/${attemptName} expected state ${path}=${formatValue(expected)} but got ${formatValue(actual)}.`,
  });
}

function valuesEqual(actual: QtiValue, expected: QtiValue): boolean {
  if (Array.isArray(actual) || Array.isArray(expected)) {
    if (!Array.isArray(actual) || !Array.isArray(expected)) return false;
    return (
      actual.length === expected.length && actual.every((value, index) => value === expected[index])
    );
  }
  return actual === expected;
}

function formatValue(value: QtiValue): string {
  return JSON.stringify(value);
}
