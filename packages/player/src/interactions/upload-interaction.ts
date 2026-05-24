import type { QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import type { QtiPlayerMessages } from "../player-messages.js";
import { interactionLabel } from "./interaction-label.js";

export function renderUploadResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  messages: QtiPlayerMessages,
): HTMLElement {
  const input = document.createElement("input");
  input.type = "file";
  input.className = "qti3-upload-input";
  input.setAttribute("aria-label", interactionLabel(interaction) || messages.uploadResponse());
  input.addEventListener("change", () => update(input.files?.[0]?.name ?? ""));
  return input;
}
