import { parseQtiXml } from "./parser.js";
import { createItemSession } from "./session.js";
import { collectQtiResponseProcessingExpressions } from "./processing-expression-collection.js";
import { responseProcessingTemplateKind } from "./processing-templates.js";
import type { QtiDiagnostic } from "./types.js";

/** A deterministic, single-response item with exactly one 1-point answer and 0 otherwise. */
export type QtiBinaryChoiceInspection =
  | { readonly ok: true; readonly responseIdentifier: string; readonly correctChoice: string }
  | { readonly ok: false; readonly diagnostics: readonly QtiDiagnostic[] };

/** Inspect every possible choice; excludes templates, random scoring and session-dependent rules. */
export function inspectQtiBinaryChoice(itemXml: string): QtiBinaryChoiceInspection {
  const fail = (message: string): QtiBinaryChoiceInspection => ({
    ok: false,
    diagnostics: [{ code: "item.binaryChoice", severity: "error", message }],
  });
  const parsed = parseQtiXml(itemXml);
  if (!parsed.ok || !parsed.document) return { ok: false, diagnostics: parsed.diagnostics };
  const { item } = parsed.document;
  const interaction = item.interactions[0];
  const response = item.responseDeclarations[0];
  if (
    item.adaptive ||
    item.timeDependent ||
    item.templateProcessing ||
    item.templateDeclarations.length ||
    item.interactions.length !== 1 ||
    interaction?.type !== "choice" ||
    interaction.attributes["max-choices"] !== "1" ||
    item.responseDeclarations.length !== 1 ||
    !response ||
    response.cardinality !== "single" ||
    response.baseType !== "identifier" ||
    interaction.responseIdentifier !== response.identifier ||
    interaction.choices.length < 2 ||
    typeof response.correctResponse !== "string" ||
    !item.responseProcessing
  ) {
    return fail("Requires one non-adaptive single-choice interaction with one correct response.");
  }
  const processing = item.responseProcessing;
  if (
    processing.template &&
    !["matchCorrect", "mapResponse"].includes(
      responseProcessingTemplateKind(processing.template) ?? "",
    )
  ) {
    return fail("Unsupported binary-choice scoring template.");
  }
  const variables = new Set([
    response.identifier,
    ...item.outcomeDeclarations.map((d) => d.identifier),
  ]);
  const expressions = collectQtiResponseProcessingExpressions(processing);
  if (
    expressions.some(
      (e) =>
        ![
          "baseValue",
          "variable",
          "correct",
          "match",
          "isNull",
          "and",
          "or",
          "not",
          "mapResponse",
          "numericCompare",
          "sum",
          "product",
        ].includes(e.type) ||
        (e.type === "variable" && !variables.has(e.identifier)),
    )
  ) {
    return fail("Binary-choice scoring must depend only on the answer and declared outcomes.");
  }
  let correctCount = 0;
  for (const choice of interaction.choices) {
    const session = createItemSession(parsed.document);
    session.respond(response.identifier, choice.identifier);
    const scored = session.score();
    const expected = choice.identifier === response.correctResponse ? 1 : 0;
    if (
      scored.outcomes.SCORE !== expected ||
      scored.diagnostics.some((d) => d.severity === "error")
    ) {
      return fail("Every choice must score 0 or 1 and agree with the declared correct response.");
    }
    correctCount += expected;
  }
  return correctCount === 1
    ? { ok: true, responseIdentifier: response.identifier, correctChoice: response.correctResponse }
    : fail("Exactly one available choice must be correct.");
}
