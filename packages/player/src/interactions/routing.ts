import type { QtiInteraction } from "@longsightgroup/qti3-core";

export function usesChoiceSet(interaction: QtiInteraction): boolean {
  if (interaction.type === "choice") return true;
  return (
    interaction.responseCardinality === "multiple" && interaction.responseBaseType === "identifier"
  );
}

export function usesOrderedResponse(interaction: QtiInteraction): boolean {
  return interaction.responseCardinality === "ordered" || interaction.type === "order";
}

const explicitNonPairInteractionTypes = new Set<QtiInteraction["type"]>([
  "match",
  "gapMatch",
  "graphicGapMatch",
  "graphicAssociate",
  "graphicOrder",
  "order",
]);

export function usesPairResponse(interaction: QtiInteraction): boolean {
  if (interaction.type === "associate") return true;
  if (explicitNonPairInteractionTypes.has(interaction.type)) return false;
  return (
    interaction.responseBaseType === "pair" || interaction.responseBaseType === "directedPair"
  );
}
