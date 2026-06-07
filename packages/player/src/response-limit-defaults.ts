import type { QtiInteraction } from "@longsightgroup/qti3-core";

export function implicitMaximumResponses(interaction: QtiInteraction): number | undefined {
  switch (interaction.type) {
    case "graphicGapMatch":
      return 1;
    default:
      return undefined;
  }
}
