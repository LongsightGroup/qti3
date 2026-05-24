import { isResolvableAssetUrl } from "../content/content-dom.js";
import type { QtiPlayerResolveAsset } from "../player-types.js";

export function resolveRenderedAssets(root: ParentNode, resolveAsset: QtiPlayerResolveAsset): void {
  for (const element of root.querySelectorAll("[src], [href], [data]")) {
    for (const attribute of ["src", "href", "data"]) {
      const value = element.getAttribute(attribute);
      if (!value || !isResolvableAssetUrl(value)) continue;
      element.setAttribute(attribute, resolveAsset(value));
    }
  }
}
