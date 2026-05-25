import type { QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import type { PlayerMessageResolver } from "../player-message-resolver.js";

export function renderEndAttemptResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  endAttempt: () => void,
  messages: PlayerMessageResolver,
): HTMLElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "qti3-end-attempt-button";
  button.textContent = interaction.attributes.title ?? messages.message("endAttempt");
  button.addEventListener("click", () => {
    if (interaction.responseIdentifier) update(true);
    endAttempt();
  });
  return button;
}
