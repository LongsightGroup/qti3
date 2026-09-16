import type { QtiObjectAsset } from "@longsightgroup/qti3-core";
import { parseAuthoredAssetUrl } from "./asset-url-policy.js";
import { mapImageSourceSet } from "./image-source-set.js";

/** Build the authored image, preserving picture source selection and its fallback. */
export function createGraphicImage(
  object: QtiObjectAsset,
  alt: string,
): HTMLImageElement | HTMLPictureElement | undefined {
  const src = object.data && parseAuthoredAssetUrl(object.data, "image");
  if (!src) return undefined;
  const image = document.createElement("img");
  image.src = src;
  image.alt = alt;
  if (object.width) image.width = Number(object.width);
  if (object.height) image.height = Number(object.height);
  applySourceSet(image, object.imageAttributes);
  if (!object.imageAttributes || object.sources.length === 0) return image;
  const picture = document.createElement("picture");
  for (const source of object.sources) {
    const element = document.createElement("source");
    if (!applySourceSet(element, source.attributes)) continue;
    if (source.type) element.type = source.type;
    if (source.attributes.media) element.media = source.attributes.media;
    picture.append(element);
  }
  picture.append(image);
  return picture;
}

function applySourceSet(
  element: HTMLImageElement | HTMLSourceElement,
  attributes: Record<string, string> | undefined,
): boolean {
  const srcset =
    attributes?.srcset &&
    mapImageSourceSet(attributes.srcset, (url) => parseAuthoredAssetUrl(url, "image"));
  if (!srcset) return false;
  element.srcset = srcset;
  if (attributes.sizes) element.sizes = attributes.sizes;
  return true;
}
