import type { QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import type { QtiPlayerMessages } from "../player-messages.js";

export function renderEndAttemptResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  endAttempt: () => void,
  messages: QtiPlayerMessages,
): HTMLElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "qti3-end-attempt-button";
  button.textContent = interaction.attributes.title ?? messages.endAttempt();
  button.addEventListener("click", () => {
    if (interaction.responseIdentifier) update(true);
    endAttempt();
  });
  return button;
}
