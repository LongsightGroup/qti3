import { createItemSession, parseQtiXml, type QtiDiagnostic } from "@qti3/core";
import type { QtiFixture } from "@qti3/fixtures";

export interface QtiConformanceResult {
  fixtureId: string;
  ok: boolean;
  diagnostics: QtiDiagnostic[];
}

export function runFixture(fixture: QtiFixture): QtiConformanceResult {
  const parseResult = parseQtiXml(fixture.xml);
  const diagnostics = [...parseResult.diagnostics];
  if (!parseResult.document) {
    return { fixtureId: fixture.id, ok: false, diagnostics };
  }

  for (const attempt of fixture.attempts) {
    const session = createItemSession(parseResult.document);
    for (const [identifier, value] of Object.entries(attempt.responses)) {
      session.respond(identifier, value);
    }
    const scored = session.score();
    for (const [identifier, expected] of Object.entries(attempt.expectedOutcomes)) {
      if (scored.outcomes[identifier] !== expected) {
        diagnostics.push({
          code: "fixture.outcome",
          severity: "error",
          message: `${fixture.id}/${attempt.name} expected ${identifier}=${String(expected)} but got ${String(scored.outcomes[identifier])}.`,
        });
      }
    }
  }

  return {
    fixtureId: fixture.id,
    ok: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}
