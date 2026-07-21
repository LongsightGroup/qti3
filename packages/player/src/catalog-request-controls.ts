import type { QtiCatalogDeliveryReference } from "./catalog-delivery.js";
import type { PlayerMessageResolver } from "./player-message-resolver.js";
import type { QtiCatalogRequestActivation } from "./player-types.js";

export type QtiCatalogRequestControlPlacement = "inside-origin" | "after-origin";

/** Derives where the native catalog request affordance should be placed. */
export function catalogRequestControlPlacement(
  reference: QtiCatalogDeliveryReference,
): QtiCatalogRequestControlPlacement {
  return reference.qtiName === "qti-item-body" ? "inside-origin" : "after-origin";
}

/** Installs native-button request affordances without changing authored element semantics. */
export function installCatalogRequestControls(options: {
  readonly references: readonly QtiCatalogDeliveryReference[];
  readonly elements: ReadonlyMap<string, Element>;
  readonly messages: PlayerMessageResolver;
  readonly onRequest: (
    reference: QtiCatalogDeliveryReference,
    origin: Element,
    activation: QtiCatalogRequestActivation,
  ) => void;
}): void {
  for (const reference of options.references) {
    if (reference.matches.length === 0) continue;
    const origin = options.elements.get(reference.referenceId);
    if (!origin) continue;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "qti3-catalog-request";
    button.textContent = options.messages.message("catalogSupportTrigger");
    button.setAttribute(
      "aria-label",
      options.messages.message("catalogSupportTriggerLabel", {
        label: catalogOriginLabel(origin, reference.catalogId),
      }),
    );
    button.addEventListener("click", (event) => {
      options.onRequest(reference, origin, event.detail === 0 ? "keyboard" : "pointer");
    });

    if (catalogRequestControlPlacement(reference) === "inside-origin") {
      origin.prepend(button);
    } else {
      origin.after(button);
    }
  }
}

function catalogOriginLabel(origin: Element, fallback: string): string {
  const label = origin.textContent.replace(/\s+/g, " ").trim();
  return label || fallback;
}
