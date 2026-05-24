import type { QtiInteraction } from "@longsightgroup/qti3-core";
import { errorView } from "../player-validation.js";

export function renderUnsupportedInteraction(interaction: QtiInteraction): HTMLElement {
  const message = interaction.responseIdentifier
    ? `Interaction type "${interaction.type}" (${interaction.responseIdentifier}) is not supported.`
    : `Interaction type "${interaction.type}" is not supported.`;
  const alert = errorView(message);
  alert.className = "qti3-unsupported-interaction";
  return alert;
}
