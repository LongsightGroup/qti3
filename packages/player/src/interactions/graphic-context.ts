import type { QtiInteraction } from "@longsightgroup/qti3-core";
import { objectIsImage } from "../interaction-support.js";

export function appendGraphicContext(group: HTMLElement, interaction: QtiInteraction): void {
  if (!interaction.type.startsWith("graphic") || !interaction.object) return;
  const context = document.createElement("div");
  context.className = "qti3-graphic-context";
  const object = interaction.object;
  const label = interaction.prompt ?? (object.text || "Graphic interaction");

  if (object.data && objectIsImage(object)) {
    const image = document.createElement("img");
    image.src = object.data;
    image.alt = label;
    image.style.maxInlineSize = "100%";
    image.style.blockSize = "auto";
    if (object.width) image.width = Number(object.width);
    if (object.height) image.height = Number(object.height);
    context.append(image);
  } else {
    const fallbackHref = object.data ?? object.sources.find((source) => source.src)?.src;
    if (fallbackHref) {
      const link = document.createElement("a");
      link.href = fallbackHref;
      link.textContent = object.text || fallbackHref;
      context.append(link);
    } else {
      context.textContent = label;
    }
  }

  group.append(context);
}
