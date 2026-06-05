import type { QtiInteraction } from "@longsightgroup/qti3-core";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import { wirePatternMask, type WirePatternMaskOptions } from "./text-pattern-mask.js";

export function wireTextControlConstraints(
  control: HTMLInputElement | HTMLTextAreaElement,
  interaction: QtiInteraction,
  messages: PlayerMessageResolver,
  options: WirePatternMaskOptions = {},
): HTMLElement | undefined {
  const placeholder = interaction.attributes["placeholder-text"];
  if (placeholder !== undefined) {
    control.placeholder = placeholder;
  }
  return wirePatternMask(control, interaction, messages, options);
}
