import type { QtiInteraction } from "@longsightgroup/qti3-core";
import { errorView } from "../player-validation.js";

function unsupportedInteractionMessage(interaction: QtiInteraction): string {
  const suffix = interaction.responseIdentifier ? ` (${interaction.responseIdentifier})` : "";
  if (interaction.registryStatus === "deprecated") {
    return `Interaction "${interaction.qtiName}"${suffix} is deprecated and is not supported by this player.`;
  }
  if (interaction.registryStatus === "unsupported") {
    return `Interaction "${interaction.qtiName}"${suffix} is not in the QTI support registry and is not supported by this player.`;
  }
  return interaction.responseIdentifier
    ? `Interaction type "${interaction.type}" (${interaction.responseIdentifier}) is not supported.`
    : `Interaction type "${interaction.type}" is not supported.`;
}

export function renderUnsupportedInteraction(interaction: QtiInteraction): HTMLElement {
  const alert = errorView(unsupportedInteractionMessage(interaction));
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

export function renderUnsupportedInlineInteraction(interaction: QtiInteraction): HTMLElement {
  const alert = document.createElement("span");
  alert.className = "qti3-embedded-interaction qti3-unsupported-interaction";
  alert.role = "alert";
  alert.textContent = unsupportedInteractionMessage(interaction);
  if (interaction.responseIdentifier) {
    alert.dataset.responseIdentifier = interaction.responseIdentifier;
  }
  return alert;
}
