import { isResolvableAssetUrl } from "./asset-url.js";
import type {
  QtiAssessmentItem,
  QtiCompanionMaterialsUnparsedChild,
  QtiDigitalMaterial,
  QtiDocument,
  QtiSourceLocation,
} from "./types.js";

export interface QtiCompanionMaterialsResolutionOptions {
  resolveAsset?: ((url: string) => string) | undefined;
}

export interface QtiCompanionMaterialsResolution {
  itemIdentifier: string;
  physicalMaterials: QtiResolvedPhysicalCompanionMaterial[];
  digitalMaterials: QtiResolvedDigitalCompanionMaterial[];
  unparsedChildren: QtiResolvedCompanionMaterialUnparsedChild[];
}

export interface QtiResolvedPhysicalCompanionMaterial {
  text: string;
  source?: QtiSourceLocation | undefined;
}

export interface QtiResolvedDigitalCompanionMaterial {
  fileHref: string;
  resolvedFileHref?: string | undefined;
  label?: string | undefined;
  mimeType?: string | undefined;
  resourceIcon?: string | undefined;
  resolvedResourceIcon?: string | undefined;
  attributes: Record<string, string>;
  source?: QtiSourceLocation | undefined;
}

export interface QtiResolvedCompanionMaterialUnparsedChild {
  qtiName: string;
  source?: QtiSourceLocation | undefined;
}

export function createCompanionMaterialsResolution(
  model: QtiDocument | QtiAssessmentItem,
  options: QtiCompanionMaterialsResolutionOptions = {},
): QtiCompanionMaterialsResolution | undefined {
  const item = "item" in model ? model.item : model;
  const companionMaterials = item.companionMaterials;
  if (!companionMaterials) return undefined;

  return {
    itemIdentifier: item.identifier,
    physicalMaterials: companionMaterials.physicalMaterials.map(({ text, source }) => {
      const resolved: QtiResolvedPhysicalCompanionMaterial = { text };
      if (source) resolved.source = source;
      return resolved;
    }),
    digitalMaterials: companionMaterials.digitalMaterials.map((material) =>
      resolveDigitalMaterial(material, options.resolveAsset),
    ),
    unparsedChildren: companionMaterials.unparsedChildren.map(resolveUnparsedChild),
  };
}

function resolveUnparsedChild(
  child: QtiCompanionMaterialsUnparsedChild,
): QtiResolvedCompanionMaterialUnparsedChild {
  const resolved: QtiResolvedCompanionMaterialUnparsedChild = { qtiName: child.qtiName };
  if (child.source) resolved.source = child.source;
  return resolved;
}

function resolveDigitalMaterial(
  material: QtiDigitalMaterial,
  resolveAsset: QtiCompanionMaterialsResolutionOptions["resolveAsset"],
): QtiResolvedDigitalCompanionMaterial {
  const resolved: QtiResolvedDigitalCompanionMaterial = {
    fileHref: material.fileHref,
    attributes: material.attributes,
  };
  const label = material.attributes.label?.trim();
  if (label) resolved.label = label;
  const mimeType = material.attributes["mime-type"]?.trim();
  if (mimeType) resolved.mimeType = mimeType;
  if (material.resourceIcon) resolved.resourceIcon = material.resourceIcon;
  const resolvedFileHref = resolveAssetUrl(material.fileHref, resolveAsset);
  if (resolvedFileHref) resolved.resolvedFileHref = resolvedFileHref;
  const resolvedResourceIcon = resolveAssetUrl(material.resourceIcon, resolveAsset);
  if (resolvedResourceIcon) resolved.resolvedResourceIcon = resolvedResourceIcon;
  if (material.source) resolved.source = material.source;
  return resolved;
}

function resolveAssetUrl(
  url: string | undefined,
  resolveAsset: QtiCompanionMaterialsResolutionOptions["resolveAsset"],
): string | undefined {
  if (!url || !resolveAsset || !isResolvableAssetUrl(url)) return undefined;
  return resolveAsset(url);
}
