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

export function renderUnsupportedEmbeddedInteraction(interaction: QtiInteraction): HTMLElement {
  const message = interaction.responseIdentifier
    ? `Interaction type "${interaction.type}" (${interaction.responseIdentifier}) cannot be embedded inline in item body.`
    : `Interaction type "${interaction.type}" cannot be embedded inline in item body.`;
  const alert = document.createElement("span");
  alert.className = "qti3-embedded-interaction qti3-embedded-interaction-unsupported";
  alert.role = "alert";
  alert.textContent = message;
  if (interaction.responseIdentifier) {
    alert.dataset.responseIdentifier = interaction.responseIdentifier;
  }
  return alert;
}
