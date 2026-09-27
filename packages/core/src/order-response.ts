import type { QtiInteraction, QtiValue } from "./types.js";
import { valueContainer } from "./processing-values.js";
import { parseNonNegativeInteger } from "./validation-primitives.js";

/** A contract for an already projected order interaction, never the authored hidden choices. */
export function orderResponseContract(interaction: QtiInteraction | undefined) {
  if (interaction?.type !== "order" && interaction?.type !== "graphicOrder") return undefined;
  const identifiers = new Set(interaction.choices.map((choice) => choice.identifier));
  const subset = interaction.attributes["min-choices"] !== undefined;
  const minimum = subset
    ? (parseNonNegativeInteger(interaction.attributes["min-choices"]) ?? 1)
    : identifiers.size;
  const authoredMaximum = parseNonNegativeInteger(interaction.attributes["max-choices"] ?? "");
  const maximum = subset && authoredMaximum ? authoredMaximum : identifiers.size;
  return { identifiers, subset, minimum, maximum };
}

/** Complete orders are permutations; incomplete saves and authored subsets remain unique subsets. */
export function validateOrderResponse(
  contract: NonNullable<ReturnType<typeof orderResponseContract>>,
  value: QtiValue,
  allowIncomplete: boolean,
): "domain" | "minimum" | "maximum" | undefined {
  const entries = valueContainer(value);
  if (
    new Set(entries).size !== entries.length ||
    entries.some((entry) => typeof entry !== "string" || !contract.identifiers.has(entry))
  )
    return "domain";
  if (!allowIncomplete && entries.length < contract.minimum) return "minimum";
  if (entries.length > contract.maximum) return "maximum";
  return undefined;
}
