import type { QtiInteraction } from "@longsightgroup/qti3-core";
import { usesChoiceSet, usesOrderedResponse, usesPairResponse } from "./routing.js";

export function isInteractionSupported(interaction: QtiInteraction): boolean {
  if (interaction.type === "graphicOrder") return true;
  if (usesOrderedResponse(interaction)) return true;
  if (interaction.type === "gapMatch" || interaction.type === "graphicGapMatch") return true;
  if (interaction.type === "graphicAssociate") return true;
  if (interaction.type === "match") return true;
  if (usesPairResponse(interaction)) return true;
  if (interaction.type === "hotspot" && interaction.object) return true;
  if (interaction.type === "hottext") return true;
  if (usesChoiceSet(interaction)) return true;
  if (interaction.type === "inlineChoice") return true;
  if (interaction.type === "extendedText") return true;
  if (interaction.type === "selectPoint") return true;
  if (interaction.type === "positionObject") return true;
  if (interaction.type === "drawing") return true;
  if (interaction.type === "portableCustom") return true;
  if (interaction.type === "textEntry") return true;
  if (interaction.type === "slider") return true;
  if (interaction.type === "upload") return true;
  if (interaction.type === "endAttempt") return true;
  if (interaction.type === "media") return true;
  return false;
}
