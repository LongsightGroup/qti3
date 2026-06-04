import { trashIcon } from "../icons.js";
import type { PlayerMessageResolver } from "../player-message-resolver.js";

export function removeButton(
  label: string | null,
  messages: PlayerMessageResolver,
  ariaLabelKey: "removePair" | "removeOrderedChoice" = "removePair",
): HTMLButtonElement {
  const safeLabel = label?.trim() || messages.message("remove");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "qti3-icon-button qti3-remove-button";
  button.title = messages.message("remove");
  button.setAttribute("aria-label", messages.message(ariaLabelKey, { label: safeLabel }));
  button.append(trashIcon());
  return button;
}
