import { isResolvableAssetUrl } from "../content/content-dom.js";
import type { QtiPlayerResolveAsset } from "../player-types.js";

export function resolveRenderedAssets(root: ParentNode, resolveAsset: QtiPlayerResolveAsset): void {
  const ElementConstructor = globalThis.Element;
  if (ElementConstructor && root instanceof ElementConstructor) {
    resolveElementAssets(root, resolveAsset);
  }
  for (const element of root.querySelectorAll("[src], [href], [data]")) {
    resolveElementAssets(element, resolveAsset);
  }
}

export function resolveElementAssets(element: Element, resolveAsset: QtiPlayerResolveAsset): void {
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
  if (resolved !== value) element.setAttribute(attribute, resolved);
}
