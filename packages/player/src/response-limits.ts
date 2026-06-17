import type { QtiChoice, QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import { implicitMaximumResponses } from "./response-limit-defaults.js";

/** Order and graphic order ignore max-choices unless min-choices is authored. */
export function orderSubsetLimitsActive(interaction: QtiInteraction): boolean {
  return (
    (interaction.type === "order" || interaction.type === "graphicOrder") &&
    interaction.attributes["min-choices"] !== undefined
  );
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
  if (explicit === undefined) return implicitMaximumResponses(interaction);
  const parsed = Number(explicit);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}

export function associationMaximumResponses(interaction: QtiInteraction): number | undefined {
  return interaction.responseCardinality === "single" ? 1 : maximumAllowedResponses(interaction);
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

function maximumMediaPlays(interaction: QtiInteraction): number | undefined {
  const parsed = Number(interaction.attributes["max-plays"] ?? "0");
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function minimumMediaPlays(interaction: QtiInteraction): number {
  const parsed = Number(interaction.attributes["min-plays"] ?? "0");
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export { maximumMediaPlays };

export function mediaPlayCount(value: QtiValue): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

export type DirectedPairUseSide = "source" | "target" | "either";

export function choiceMatchMaximum(choice: QtiChoice): number | undefined {
  return parseUnlimitedMaximum(choice.attributes["match-max"]);
}

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

export function parseUnlimitedMaximum(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}
