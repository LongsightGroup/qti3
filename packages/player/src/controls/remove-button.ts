import { trashIcon } from "../icons.js";
import type { QtiPlayerMessages } from "../player-messages.js";

export function removeButton(label: string | null, messages: QtiPlayerMessages): HTMLButtonElement {
  const safeLabel = label?.trim() || messages.remove();
  const button = document.createElement("button");
  button.type = "button";
  button.className = "qti3-icon-button qti3-remove-button";
  button.title = messages.remove();
  button.setAttribute("aria-label", messages.removePair({ label: safeLabel }));
  button.append(trashIcon());
  return button;
}
