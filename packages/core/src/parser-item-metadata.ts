import type {
  QtiCatalogCard,
  QtiCatalogCardEntry,
  QtiCatalogFileHref,
  QtiCatalogHtmlContent,
  QtiCatalogInfo,
  QtiCatalogReference,
  QtiCompanionMaterialsInfo,
  QtiCompanionMaterialsUnparsedChild,
  QtiContentNode,
  QtiDiagnostic,
  QtiModalFeedback,
  QtiPhysicalMaterial,
  QtiStylesheet,
} from "./types.js";
import { childElements, descendants, textContent, type XmlNode } from "./xml.js";

export function firstChildElement(
  parent: XmlNode,
  childName: string,
  diagnostics: QtiDiagnostic[],
  duplicateCode: string,
): XmlNode | undefined {
  const matches = childElements(parent, childName);
  if (matches.length > 1) {
    diagnostics.push({
      code: duplicateCode,
      severity: "error",
      message: `${parent.localName} allows at most one ${childName} child.`,
      path: matches[1]?.source?.path ?? parent.source?.path,
      source: matches[1]?.source ?? parent.source,
    });
  }
  return matches[0];
}

export function parseStylesheet(node: XmlNode): QtiStylesheet {
  return {
    href: node.attributes.href ?? "",
    type: node.attributes.type,
    media: node.attributes.media,
    title: node.attributes.title,
    attributes: node.attributes,
    source: node.source,
  };
}

export function parseCatalogReferences(node: XmlNode): QtiCatalogReference[] {
  const references = [
    ...(node.attributes["data-catalog-idref"] ? [node] : []),
    ...descendants(node, (child) => Boolean(child.attributes["data-catalog-idref"])),
  ];
  return references.map((reference) => ({
    idref: reference.attributes["data-catalog-idref"] ?? "",
    source: reference.source,
  }));
}

export function parseModalFeedback(node: XmlNode): QtiModalFeedback {
  const showHide = node.attributes["show-hide"] === "hide" ? "hide" : "show";
  return {
    identifier: node.attributes.identifier ?? "",
    outcomeIdentifier: node.attributes["outcome-identifier"] ?? "",
    showHide,
    text: textContent(node),
    source: node.source,
  };
}

export function parseCatalogInfo(node: XmlNode | undefined): QtiCatalogInfo | undefined {
  if (!node) return undefined;
  return {
    catalogs: childElements(node, "qti-catalog").map((catalog) => ({
      id: catalog.attributes.id ?? "",
      attributes: catalog.attributes,
      cards: childElements(catalog, "qti-card").map(parseCatalogCard),
      source: catalog.source,
    })),
    source: node.source,
  };
}

function parseCatalogCard(node: XmlNode): QtiCatalogCard {
  return {
    support: node.attributes.support ?? "",
    htmlContent: parseCatalogHtmlContent(childElements(node, "qti-html-content")[0]),
    fileHrefs: childElements(node, "qti-file-href").map(parseCatalogFileHref),
    entries: childElements(node, "qti-card-entry").map(parseCatalogCardEntry),
    attributes: node.attributes,
    source: node.source,
  };
}

function parseCatalogCardEntry(node: XmlNode): QtiCatalogCardEntry {
  return {
    language: node.attributes["xml:lang"] ?? node.attributes.lang,
    default: node.attributes.default === "true",
    htmlContent: parseCatalogHtmlContent(childElements(node, "qti-html-content")[0]),
    fileHrefs: childElements(node, "qti-file-href").map(parseCatalogFileHref),
    attributes: node.attributes,
    source: node.source,
  };
}

function parseCatalogHtmlContent(node: XmlNode | undefined): QtiCatalogHtmlContent | undefined {
  if (!node) return undefined;
  return {
    text: textContent(node),
    children: parseCatalogHtmlChildren(node),
    attributes: node.attributes,
    source: node.source,
  };
}

function parseCatalogHtmlChildren(node: XmlNode): QtiContentNode[] {
  const content: QtiContentNode[] = [];
  for (const entry of node.content) {
    if (typeof entry === "string") {
      if (entry.length > 0) content.push({ kind: "text", text: entry, source: node.source });
      continue;
    }
    content.push({
      kind: "element",
      qtiName: entry.localName,
      attributes: entry.attributes,
      children: parseCatalogHtmlChildren(entry),
      source: entry.source,
    });
  }
  return content;
}

function parseCatalogFileHref(node: XmlNode): QtiCatalogFileHref {
  return {
    href: textContent(node).trim(),
    mimeType: node.attributes["mime-type"],
    attributes: node.attributes,
    source: node.source,
  };
}

export function parseCompanionMaterialsInfo(
  node: XmlNode | undefined,
  diagnostics: QtiDiagnostic[],
): QtiCompanionMaterialsInfo | undefined {
  if (!node) return undefined;

  const physicalMaterials: QtiPhysicalMaterial[] = [];
  const unparsedChildren: QtiCompanionMaterialsUnparsedChild[] = [];

  for (const child of childElements(node)) {
    if (child.localName === "qti-physical-material") {
      const material = parsePhysicalMaterial(child, diagnostics);
      if (material) physicalMaterials.push(material);
      continue;
    }

    unparsedChildren.push({ qtiName: child.localName, source: child.source });
    diagnostics.push({
      code: "companionMaterials.child.unsupported",
      severity: "warning",
      message: `${child.localName} is not currently modeled in companion materials parsing.`,
      path: child.source?.path,
      source: child.source,
    });
  }

  return {
    physicalMaterials,
    unparsedChildren,
    source: node.source,
  };
}

function parsePhysicalMaterial(
  node: XmlNode,
  diagnostics: QtiDiagnostic[],
): QtiPhysicalMaterial | undefined {
  const text = textContent(node).trim();
  if (text.length === 0) {
    diagnostics.push({
      code: "companionMaterials.physicalMaterial.empty",
      severity: "warning",
      message: "qti-physical-material requires non-empty text content.",
      path: node.source?.path,
      source: node.source,
    });
    return undefined;
  }
  return {
    text,
    source: node.source,
  };
}
