import { mapImageSourceSet } from "../image-source-set.js";
import { isResolvableAssetUrl, isSafeResolvedAssetUrl } from "../content/content-dom.js";
import type { QtiPlayerResolveAsset } from "../player-types.js";

export function resolveRenderedAssets(root: ParentNode, resolveAsset: QtiPlayerResolveAsset): void {
  if (root instanceof Element) {
    resolveElementAssets(root, resolveAsset);
  }
  for (const element of root.querySelectorAll("[src], [href], [data], [srcset]")) {
    resolveElementAssets(element, resolveAsset);
  }
}

export function resolveElementAssets(element: Element, resolveAsset: QtiPlayerResolveAsset): void {
  const srcset = element.getAttribute("srcset");
  if (srcset) {
    const resolved = mapImageSourceSet(srcset, (url) => {
      const result = isResolvableAssetUrl(url) ? resolveAsset(url) : url;
      return isSafeResolvedAssetUrl(result) ? result : undefined;
    });
    if (resolved) element.setAttribute("srcset", resolved);
    else element.removeAttribute("srcset");
  }
  for (const attribute of ["src", "href", "data"]) {
    resolveElementAssetAttribute(element, attribute, resolveAsset);
  }
}

export function resolveElementAssetAttribute(
  element: Element,
  attribute: string,
  resolveAsset: QtiPlayerResolveAsset,
): void {
  const value = element.getAttribute(attribute);
  if (!value || !isResolvableAssetUrl(value)) return;
  const resolved = resolveAsset(value);
  if (!isSafeResolvedAssetUrl(resolved)) {
    element.removeAttribute(attribute);
    return;
  }
  if (resolved !== value) element.setAttribute(attribute, resolved);
}
