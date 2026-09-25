import { parseXmlBoolean } from "./parser-values.js";
import type { QtiChoice, QtiDiagnostic, QtiInteraction } from "./types.js";

/** One independently shuffled set of authored choices. */
export interface QtiPresentationGroupDefinition {
  readonly name: "choices" | "source" | "target";
  readonly choices: readonly QtiChoice[];
  readonly fixedIdentifiers: ReadonlySet<string>;
}

/** Parsed shuffle policy, or source-located authoring failures. */
export type QtiPresentationDefinitionResult =
  | { readonly ok: true; readonly groups: readonly QtiPresentationGroupDefinition[] }
  | { readonly ok: false; readonly diagnostics: readonly QtiDiagnostic[] };

const shuffleTypes = new Set(["choice", "order", "inlineChoice", "associate", "match", "gapMatch"]);
const fixedChoiceNames = new Set([
  "qti-simple-choice",
  "qti-inline-choice",
  "qti-simple-associable-choice",
]);

/** Refines shuffle/fixed attributes once for validation and session presentation. */
export function parseQtiPresentationDefinition(
  interaction: QtiInteraction,
): QtiPresentationDefinitionResult {
  const diagnostics: QtiDiagnostic[] = [];
  const check = (
    attributes: Record<string, string>,
    attribute: string,
    supported: boolean,
    source = interaction.source,
  ): boolean => {
    const raw = attributes[attribute];
    if (raw === undefined) return false;
    const value = parseXmlBoolean(raw);
    if (!supported || value === undefined) {
      diagnostics.push({
        code: supported
          ? "interaction.booleanAttribute"
          : "interaction.presentation.unsupportedAttribute",
        severity: "error",
        message: supported
          ? `Invalid boolean ${attribute}: ${raw}.`
          : `${attribute} is not supported on this QTI element.`,
        source,
        path: source?.path,
      });
    }
    return value === true;
  };
  const shuffle = check(interaction.attributes, "shuffle", shuffleTypes.has(interaction.type));
  check(interaction.attributes, "qti-fixed", false);
  check(interaction.attributes, "fixed", false);
  const fixedIdentifiers = new Set<string>();
  for (const choice of interaction.choices) {
    if (check(choice.attributes, "fixed", fixedChoiceNames.has(choice.qtiName), choice.source))
      fixedIdentifiers.add(choice.identifier);
    check(choice.attributes, "qti-fixed", false, choice.source);
    check(choice.attributes, "shuffle", false, choice.source);
  }
  if (diagnostics.length > 0) return { ok: false, diagnostics };
  if (!shuffle) return { ok: true, groups: [] };
  if (interaction.type === "match") {
    return {
      ok: true,
      groups: [
        {
          name: "source",
          choices: interaction.choices.filter((choice) => choice.role === "matchSource"),
          fixedIdentifiers,
        },
        {
          name: "target",
          choices: interaction.choices.filter((choice) => choice.role === "matchTarget"),
          fixedIdentifiers,
        },
      ],
    };
  }
  return {
    ok: true,
    groups: [
      {
        name: "choices",
        choices:
          interaction.type === "gapMatch"
            ? interaction.choices.filter((choice) => choice.role === "gapChoice")
            : interaction.choices,
        fixedIdentifiers,
      },
    ],
  };
}
