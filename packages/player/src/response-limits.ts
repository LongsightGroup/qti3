import type { QtiChoice, QtiInteraction } from "@longsightgroup/qti3-core";

export function maximumAllowedResponses(interaction: QtiInteraction | undefined): number | undefined {
  if (!interaction) return undefined;
  if (interaction.type === "media") return maximumMediaPlays(interaction);
  const explicit =
    interaction.attributes["max-choices"] ?? interaction.attributes["max-associations"];
  if (explicit === undefined) return undefined;
  const parsed = Number(explicit);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
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

export function exceedsHotspotMatchMax(choice: QtiChoice, selectedPairs: string[]): boolean {
  const maximum = parseUnlimitedMaximum(choice.attributes["match-max"]);
  if (maximum === undefined) return false;
  const currentUseCount = selectedPairs
    .flatMap((pair) => pair.split(" "))
    .filter((identifier) => identifier === choice.identifier).length;
  return currentUseCount + 1 > maximum;
}

export function parseUnlimitedMaximum(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}