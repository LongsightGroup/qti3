import type { QtiInteraction } from "@longsightgroup/qti3-core";
import { readableType } from "../interaction-support.js";

export function interactionLabel(interaction: QtiInteraction): string {
  return interaction.prompt ?? interaction.contextText ?? readableType(interaction.type);
}

export function qtiSharedClassNames(value: string | undefined): string[] {
  return (value ?? "").split(/\s+/).filter((className) => className.startsWith("qti-"));
}
