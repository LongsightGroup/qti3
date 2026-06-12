import type { QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import { createQtiInteractionRegionMarkers } from "../player/interaction-regions.js";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import { interactionLabel } from "./interaction-label.js";

export function renderUploadResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  messages: PlayerMessageResolver,
): HTMLElement {
  const regions = createQtiInteractionRegionMarkers(interaction);
  const input = document.createElement("input");
  input.type = "file";
  input.className = "qti3-upload-input";
  regions.control(input);
  input.setAttribute(
    "aria-label",
    interactionLabel(interaction) || messages.message("uploadResponse"),
  );
  input.addEventListener("change", () => update(input.files?.[0]?.name ?? ""));
  return input;
}
