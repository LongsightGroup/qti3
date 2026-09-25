import { parseXmlBoolean } from "./parser-values.js";
import type { QtiChoice, QtiDiagnostic, QtiInteraction, QtiInteractionType } from "./types.js";

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

/** Interactions whose QTI contract supports shuffle. */
export const SHUFFLE_INTERACTION_TYPES: readonly QtiInteractionType[] = [
  "choice",
  "order",
  "inlineChoice",
  "associate",
  "match",
  "gapMatch",
];

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
  const rejectAttribute = (
    attributes: Record<string, string>,
    attribute: string,
    source = interaction.source,
  ): void => {
    if (attributes[attribute] === undefined) return;
    diagnostics.push({
      code: "interaction.presentation.unsupportedAttribute",
      severity: "error",
      message: `${attribute} is not supported on this QTI element.`,
      source,
      path: source?.path,
    });
  };
  const booleanAttribute = (
    attributes: Record<string, string>,
    attribute: string,
    source = interaction.source,
  ): boolean => {
    const raw = attributes[attribute];
    if (raw === undefined) return false;
    const value = parseXmlBoolean(raw);
    if (value === undefined)
      diagnostics.push({
        code: "interaction.booleanAttribute",
        severity: "error",
        message: `Invalid boolean ${attribute}: ${raw}.`,
        source,
        path: source?.path,
      });
    return value === true;
  };
  const supportsShuffle = SHUFFLE_INTERACTION_TYPES.includes(interaction.type);
  if (!supportsShuffle) rejectAttribute(interaction.attributes, "shuffle");
  const shuffle = supportsShuffle && booleanAttribute(interaction.attributes, "shuffle");
  rejectAttribute(interaction.attributes, "qti-fixed");
  rejectAttribute(interaction.attributes, "fixed");
  const fixedIdentifiers = new Set<string>();
  for (const choice of interaction.choices) {
    if (fixedChoiceNames.has(choice.qtiName)) {
      if (booleanAttribute(choice.attributes, "fixed", choice.source))
        fixedIdentifiers.add(choice.identifier);
    } else rejectAttribute(choice.attributes, "fixed", choice.source);
    rejectAttribute(choice.attributes, "qti-fixed", choice.source);
    rejectAttribute(choice.attributes, "shuffle", choice.source);
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
