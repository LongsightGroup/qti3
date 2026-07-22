import type { QtiChoice, QtiDiagnostic, QtiInteraction, QtiValue } from "./types.js";
import { parseXmlBoolean } from "./parser-values.js";
import { parseNonNegativeInteger } from "./validation-primitives.js";
import { qtiValueToIdentifierList } from "./value-format.js";

export interface QtiResponseValidationPolicy {
  checkMinimum: boolean;
  checkMaximum: boolean;
  checkMatchMax: boolean;
}

export function responseIsEmpty(value: QtiValue): boolean {
  return value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

export function responseCount(value: QtiValue): number {
  return responseIsEmpty(value) ? 0 : Array.isArray(value) ? value.length : 1;
}

/** Order and graphic order ignore max-choices unless min-choices is authored. */
export function orderSubsetLimitsActive(interaction: QtiInteraction): boolean {
  return (
    (interaction.type === "order" || interaction.type === "graphicOrder") &&
    interaction.attributes["min-choices"] !== undefined
  );
}

export function responseLimitAttribute(
  interaction: QtiInteraction,
  choiceKey: "min-choices" | "max-choices",
  associationKey: "min-associations" | "max-associations",
): string | undefined {
  if (interaction.type === "order" || interaction.type === "graphicOrder") {
    return interaction.attributes[choiceKey];
  }
  return interaction.attributes[choiceKey] ?? interaction.attributes[associationKey];
}

function interactionRequiresResponse(interaction: QtiInteraction): boolean {
  return parseXmlBoolean(interaction.attributes.required) === true;
}

export function minimumRequiredResponses(interaction: QtiInteraction | undefined): number {
  if (!interaction) return 1;
  if (interaction.type === "media") return minimumMediaPlays(interaction);
  const explicit = responseLimitAttribute(interaction, "min-choices", "min-associations");
  if (explicit === undefined) return interactionRequiresResponse(interaction) ? 1 : 0;
  return parseNonNegativeInteger(explicit) ?? 1;
}

export function maximumAllowedResponses(
  interaction: QtiInteraction | undefined,
): number | undefined {
  if (!interaction) return undefined;
  if (interaction.type === "media") return maximumMediaPlays(interaction);
  if (
    (interaction.type === "order" || interaction.type === "graphicOrder") &&
    !orderSubsetLimitsActive(interaction)
  ) {
    return undefined;
  }
  const explicit = responseLimitAttribute(interaction, "max-choices", "max-associations");
  if (explicit === undefined) return undefined;
  const parsed = parseNonNegativeInteger(explicit);
  return parsed === undefined || parsed <= 0 ? undefined : parsed;
}

export function associationMaximumResponses(interaction: QtiInteraction): number | undefined {
  return interaction.responseCardinality === "single" ? 1 : maximumAllowedResponses(interaction);
}

export function mediaPlayCount(value: QtiValue): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function minimumMediaPlays(interaction: QtiInteraction): number {
  const parsed = parseNonNegativeInteger(interaction.attributes["min-plays"]);
  if (parsed !== undefined) return parsed;
  return interactionRequiresResponse(interaction) ? 1 : 0;
}

function maximumMediaPlays(interaction: QtiInteraction): number | undefined {
  const parsed = parseNonNegativeInteger(interaction.attributes["max-plays"]);
  return parsed === undefined || parsed <= 0 ? undefined : parsed;
}

export { maximumMediaPlays, minimumMediaPlays };

export function responseValidationPolicy(
  declaration: { readonly correctResponse: QtiValue | null },
  interaction: QtiInteraction | undefined,
): QtiResponseValidationPolicy {
  const authoredMinimum =
    interaction === undefined
      ? undefined
      : responseLimitAttribute(interaction, "min-choices", "min-associations");
  const minimum = interaction === undefined ? undefined : minimumRequiredResponses(interaction);
  const validatesMinimum =
    declaration.correctResponse !== null ||
    interaction?.type === "media" ||
    authoredMinimum !== undefined ||
    (minimum !== undefined && minimum > 0);
  const maximum = maximumAllowedResponses(interaction);
  if (
    declaration.correctResponse === null &&
    interaction?.type !== "media" &&
    !validatesMinimum &&
    maximum === undefined
  ) {
    return { checkMinimum: false, checkMaximum: false, checkMatchMax: false };
  }
  return {
    checkMinimum: validatesMinimum,
    checkMaximum: maximum !== undefined,
    checkMatchMax: interaction !== undefined,
  };
}

export function requiredResponseDiagnostic(
  responseIdentifier: string,
  interaction: QtiInteraction | undefined,
  minimum: number,
): QtiDiagnostic {
  return {
    code: "response.required",
    severity: "error",
    message:
      interaction?.attributes["data-min-selections-message"] ??
      (interaction?.type === "media"
        ? `${responseIdentifier} requires at least ${minimum} play${minimum === 1 ? "" : "s"}.`
        : minimum === 1
          ? `${responseIdentifier} requires a response.`
          : `${responseIdentifier} requires at least ${minimum} responses.`),
    path: responseIdentifier,
  };
}

export function maximumResponseDiagnostic(
  responseIdentifier: string,
  interaction: QtiInteraction | undefined,
  maximum: number,
): QtiDiagnostic {
  return {
    code: "response.maximum",
    severity: "error",
    message:
      interaction?.attributes["data-max-selections-message"] ??
      (interaction?.type === "media"
        ? `${responseIdentifier} allows at most ${maximum} play${maximum === 1 ? "" : "s"}.`
        : `${responseIdentifier} allows at most ${maximum} response${maximum === 1 ? "" : "s"}.`),
    path: responseIdentifier,
  };
}

export function parseUnlimitedMaximum(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = parseNonNegativeInteger(value);
  return parsed === undefined || parsed <= 0 ? undefined : parsed;
}

export function choiceMatchMaximum(choice: QtiChoice): number | undefined {
  return parseUnlimitedMaximum(choice.attributes["match-max"]);
}

export type DirectedPairUseSide = "source" | "target" | "either";

export function directedPairChoiceUseCount(
  choice: QtiChoice,
  selectedPairs: string[],
  side: DirectedPairUseSide = "either",
): number {
  return selectedPairs.reduce((count, pair) => {
    const [source = "", target = ""] = pair.split(/\s+/);
    if (side === "source") return source === choice.identifier ? count + 1 : count;
    if (side === "target") return target === choice.identifier ? count + 1 : count;
    return count + (source === choice.identifier ? 1 : 0) + (target === choice.identifier ? 1 : 0);
  }, 0);
}

export function choiceMatchLimitExceeded(choice: QtiChoice, useCount: number): boolean {
  const maximum = choiceMatchMaximum(choice);
  return maximum !== undefined && useCount > maximum;
}

export function wouldExceedChoiceMatchMaximum(
  choice: QtiChoice,
  selectedPairs: string[],
  side: DirectedPairUseSide = "either",
): boolean {
  return choiceMatchLimitExceeded(
    choice,
    directedPairChoiceUseCount(choice, selectedPairs, side) + 1,
  );
}

function responseChoiceIdentifiers(response: QtiValue): string[] {
  return qtiValueToIdentifierList(response).flatMap((value) => value.split(/\s+/).filter(Boolean));
}

export function matchMaxDiagnostics(
  responseIdentifier: string,
  interaction: QtiInteraction,
  response: QtiValue,
): QtiDiagnostic[] {
  const identifiers = responseChoiceIdentifiers(response);
  if (identifiers.length === 0) return [];
  const counts = new Map<string, number>();
  for (const identifier of identifiers) {
    counts.set(identifier, (counts.get(identifier) ?? 0) + 1);
  }

  const diagnostics: QtiDiagnostic[] = [];
  for (const choice of interaction.choices) {
    const maximum = choiceMatchMaximum(choice);
    if (maximum === undefined) continue;
    const count = counts.get(choice.identifier) ?? 0;
    if (count <= maximum) continue;
    diagnostics.push({
      code: "response.matchMax",
      severity: "error",
      message: `${choice.text || choice.identifier} may be used at most ${maximum} time${maximum === 1 ? "" : "s"}.`,
      path: responseIdentifier,
    });
  }
  return diagnostics;
}
