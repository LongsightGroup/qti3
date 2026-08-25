import type { QtiInteraction } from "@longsightgroup/qti3-core";
import { objectIsImage } from "../interaction-support.js";
import { parseAuthoredAssetUrl } from "../asset-url-policy.js";

export function appendGraphicContext(group: HTMLElement, interaction: QtiInteraction): void {
  if (!interaction.type.startsWith("graphic") || !interaction.object) return;
  const context = document.createElement("div");
  context.className = "qti3-graphic-context";
  const object = interaction.object;
  const label = interaction.prompt ?? (object.text || "Graphic interaction");

  if (object.data && objectIsImage(object)) {
    const src = parseAuthoredAssetUrl(object.data, "image");
    if (src) {
      const image = document.createElement("img");
      image.src = src;
      image.alt = label;
      image.style.maxInlineSize = "100%";
      image.style.blockSize = "auto";
      if (object.width) image.width = Number(object.width);
      if (object.height) image.height = Number(object.height);
      context.append(image);
    } else {
      context.textContent = label;
    }
  } else {
    const fallbackHref = [object.data, ...object.sources.map((source) => source.src)]
      .filter((value): value is string => value !== undefined)
      .map((value) => parseAuthoredAssetUrl(value, "navigation"))
      .find((value): value is string => value !== undefined);
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
