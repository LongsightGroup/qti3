import {
  createCatalogSupportResolution,
  type QtiCatalogReference,
  type QtiCatalogSupportResolutionOptions,
  type QtiDocument,
  type QtiSourceLocation,
} from "@longsightgroup/qti3-core";
import {
  createCatalogDeliveryResolution,
  type QtiCatalogDeliveryResolution,
} from "./catalog-delivery.js";
import { installCatalogRequestControls } from "./catalog-request-controls.js";
import type { PlayerMessageResolver } from "./player-message-resolver.js";
import type {
  QtiCatalogRequestActivation,
  QtiCatalogRequestEventDetail,
  QtiCatalogRequestPolicy,
  QtiPlayerResolveAsset,
  QtiRenderedCatalogReference,
} from "./player-types.js";

/** Owns host policy and the exact relationship between parsed catalog references and rendered elements. */
export class CatalogHost {
  private policy: QtiCatalogRequestPolicy | undefined;
  private readonly referenceElements = new Map<string, Element>();
  private readonly referencesById = new Map<string, QtiCatalogReference>();
  private readonly referencesBySourcePath = new Map<string, QtiCatalogReference[]>();

  /** Returns the host-owned support policy currently used for candidate requests. */
  get requestPolicy(): QtiCatalogRequestPolicy | undefined {
    return this.policy;
  }

  /** Replaces the host-owned support policy without changing item-derived bindings. */
  setRequestPolicy(policy: QtiCatalogRequestPolicy | undefined): void {
    this.policy = policy;
  }

  /** Clears item-derived bindings while preserving host-owned request policy. */
  clearItemState(): void {
    this.referenceElements.clear();
    this.referencesById.clear();
    this.referencesBySourcePath.clear();
  }

  /** Starts an atomic render binding pass for one parsed item. */
  beginRender(documentModel: QtiDocument): void {
    this.clearItemState();
    for (const reference of documentModel.item.catalogReferences) {
      this.referencesById.set(reference.referenceId, reference);
      if (!reference.source) continue;
      const references = this.referencesBySourcePath.get(reference.source.path) ?? [];
      references.push(reference);
      this.referencesBySourcePath.set(reference.source.path, references);
    }
  }

  /** Registers the exact element produced from a parsed source node during rendering. */
  registerRenderedElement(source: QtiSourceLocation | undefined, element: Element): void {
    if (!source) return;
    for (const reference of this.referencesBySourcePath.get(source.path) ?? []) {
      this.referenceElements.set(reference.referenceId, element);
    }
  }

  /** Installs request controls after all item content has registered its live elements. */
  installRequestControls(
    documentModel: QtiDocument,
    resolveAsset: QtiPlayerResolveAsset | undefined,
    messages: PlayerMessageResolver,
    onRequest: (detail: QtiCatalogRequestEventDetail) => void,
  ): void {
    const policy = this.policy;
    if (!policy) return;
    const resolution = this.getDeliveryResolution(documentModel, resolveAsset, policy);
    installCatalogRequestControls({
      references: resolution.references,
      elements: this.referenceElements,
      messages,
      onRequest: (delivery, origin, activation) => {
        const reference = this.renderedReference(delivery.referenceId, origin);
        if (reference) onRequest({ reference, delivery, activation });
      },
    });
  }

  /** Returns the parsed references that currently have exact live render bindings. */
  getRenderedReferences(documentModel: QtiDocument): QtiRenderedCatalogReference[] {
    return documentModel.item.catalogReferences.flatMap((reference) => {
      const element = this.referenceElements.get(reference.referenceId);
      if (!element) return [];
      return [renderedCatalogReference(reference, element)];
    });
  }

  /** Projects catalog data using only the caller's explicit resolution options. */
  getDeliveryResolution(
    documentModel: QtiDocument,
    resolveAsset: QtiPlayerResolveAsset | undefined,
    options: QtiCatalogSupportResolutionOptions = {},
  ): QtiCatalogDeliveryResolution {
    return createCatalogDeliveryResolution(
      createCatalogSupportResolution(documentModel, options),
      resolveAsset,
    );
  }

  /** Emits a programmatic request for one policy-matching live reference. */
  requestCatalog(
    documentModel: QtiDocument,
    resolveAsset: QtiPlayerResolveAsset | undefined,
    referenceId: string,
    activation: QtiCatalogRequestActivation,
    emit: (detail: QtiCatalogRequestEventDetail) => void,
  ): boolean {
    const policy = this.policy;
    const origin = this.referenceElements.get(referenceId);
    if (!policy || !origin) return false;
    const delivery = this.getDeliveryResolution(
      documentModel,
      resolveAsset,
      policy,
    ).references.find((candidate) => candidate.referenceId === referenceId);
    if (!delivery || delivery.matches.length === 0) return false;
    const reference = this.renderedReference(referenceId, origin);
    if (!reference) return false;
    emit({ reference, delivery, activation });
    return true;
  }

  private renderedReference(
    referenceId: string,
    origin: Element,
  ): QtiRenderedCatalogReference | undefined {
    const parsed = this.referencesById.get(referenceId);
    return parsed ? renderedCatalogReference(parsed, origin) : undefined;
  }
}

function renderedCatalogReference(
  reference: QtiCatalogReference,
  element: Element,
): QtiRenderedCatalogReference {
  return {
    referenceId: reference.referenceId,
    catalogId: reference.idref,
    qtiName: reference.qtiName,
    element,
    source: reference.source,
  };
}
