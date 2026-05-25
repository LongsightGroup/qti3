import type { QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import { interactionLabel } from "./interaction-label.js";

export function renderUploadResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  messages: PlayerMessageResolver,
): HTMLElement {
  const input = document.createElement("input");
  input.type = "file";
  input.className = "qti3-upload-input";
  input.setAttribute(
    "aria-label",
    interactionLabel(interaction) || messages.message("uploadResponse"),
  );
  input.addEventListener("change", () => update(input.files?.[0]?.name ?? ""));
  return input;
}
