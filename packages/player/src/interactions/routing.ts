import type { QtiInteraction } from "@longsightgroup/qti3-core";

export function usesChoiceSet(interaction: QtiInteraction): boolean {
  if (interaction.type === "choice" || interaction.type === "hotspot") {
    return true;
  }
  return (
    interaction.responseCardinality === "multiple" && interaction.responseBaseType === "identifier"
  );
}

export function usesOrderedResponse(interaction: QtiInteraction): boolean {
  return (
    interaction.responseCardinality === "ordered" ||
    interaction.type === "order" ||
    interaction.type === "graphicOrder"
  );
}

export function usesPairResponse(interaction: QtiInteraction): boolean {
  return (
    interaction.responseBaseType === "pair" ||
    interaction.responseBaseType === "directedPair" ||
    interaction.type === "associate" ||
    interaction.type === "graphicAssociate" ||
    interaction.type === "match" ||
    interaction.type === "gapMatch" ||
    interaction.type === "graphicGapMatch"
  );
}



