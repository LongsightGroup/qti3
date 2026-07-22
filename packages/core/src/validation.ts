import type {
  QtiAssessmentItem,
  QtiBaseType,
  QtiCatalogCard,
  QtiCatalogCardEntry,
  QtiContentNode,
  QtiDiagnostic,
  QtiDocument,
  QtiOutcomeDeclaration,
  QtiResponseDeclaration,
  QtiTemplateDeclaration,
  QtiValue,
  QtiValidationResult,
} from "./types.js";
import { assertNever } from "./assert-never.js";
import { validateQtiDataSsmlMetadata } from "./tts.js";
import { validateCompanionMaterials } from "./validation-companion-materials.js";
import {
  hasValidShapeCoordinateCount,
  isAreaShape,
  isNumericCsv,
  numericCsv,
} from "./validation-geometry.js";
import {
  isBaseType,
  isBooleanAttribute,
  isCardinality,
  isFiniteNumber,
  isInteger,
  isPair,
  isPoint,
  requireIdentifier,
} from "./validation-primitives.js";
import { validateItemBodySharedVocabulary } from "./validation-shared-vocabulary-layout.js";
import { validateInteractions } from "./validation-interactions.js";
import {
  validateProcessingReferences,
  validateResponseProcessingTemplate,
} from "./validation-processing.js";
import { COMPLETION_STATUS } from "./attempt-state-constants.js";

export function validateAssessmentItem(document: QtiDocument): QtiValidationResult {
  const diagnostics: QtiDiagnostic[] = [];
  const item = document.item;

  requireIdentifier("qti-assessment-item", item.identifier, diagnostics, item.source);
  validateAssessmentItemRoot(item, diagnostics);
  validateItemBody(item, diagnostics);
  validateItemBodySharedVocabulary(item, diagnostics);
  validateDeclarationIdentifiers(item, diagnostics);
  validateOutcomeLookupTables(item, diagnostics);
  validateInteractions(item, diagnostics);
  validateModalFeedback(item, diagnostics);
  validateCatalogInfo(item, diagnostics);
  validateCompanionMaterials(item, diagnostics);
  validateStylesheets(item, diagnostics);
  diagnostics.push(...validateQtiDataSsmlMetadata(item));
  validateResponseProcessingTemplate(item, diagnostics);
  validateProcessingReferences(item, diagnostics);

  return {
    ok: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

function validateAssessmentItemRoot(item: QtiAssessmentItem, diagnostics: QtiDiagnostic[]): void {
  if (!item.attributes.title?.trim()) {
    diagnostics.push({
      code: "assessmentItem.title.required",
      severity: "error",
      message: "qti-assessment-item requires a non-empty title attribute.",
      path: item.source?.path,
      source: item.source,
    });
  }
  const timeDependent = item.attributes["time-dependent"];
  if (timeDependent === undefined || timeDependent.trim() === "") {
    diagnostics.push({
      code: "assessmentItem.timeDependent.required",
      severity: "error",
      message: "qti-assessment-item requires a time-dependent attribute.",
      path: item.source?.path,
      source: item.source,
    });
  } else if (!isBooleanAttribute(timeDependent)) {
    diagnostics.push({
      code: "assessmentItem.timeDependent.boolean",
      severity: "error",
      message: `qti-assessment-item time-dependent must be an XML boolean, found ${timeDependent}.`,
      path: item.source?.path,
      source: item.source,
    });
  }
}

function validateItemBody(item: QtiAssessmentItem, diagnostics: QtiDiagnostic[]): void {
  if (item.itemBodySource) return;
  diagnostics.push({
    code: "itemBody.required",
    severity: "error",
    message: "qti-assessment-item requires a qti-item-body.",
    path: item.source?.path,
    source: item.source,
  });
}

function validateDeclarationIdentifiers(
  item: QtiAssessmentItem,
  diagnostics: QtiDiagnostic[],
): void {
  const seen = new Set<string>();
  for (const declaration of [
    ...item.responseDeclarations,
    ...item.outcomeDeclarations,
    ...item.templateDeclarations,
  ]) {
    requireIdentifier(
      `${declaration.kind} declaration`,
      declaration.identifier,
      diagnostics,
      declaration.source,
    );
    validateDeclarationRequiredAttributes(declaration, diagnostics);
    validateDeclarationValueMetadata(declaration, diagnostics);
    if (declaration.kind === "outcome" && declaration.identifier === COMPLETION_STATUS) {
      diagnostics.push({
        code: "declaration.outcome.builtIn",
        severity: "error",
        message:
          "completionStatus is a built-in QTI outcome variable and must not be declared explicitly.",
        path: declaration.source?.path,
        source: declaration.source,
      });
    }
    if (seen.has(declaration.identifier)) {
      diagnostics.push({
        code: "identifier.duplicate",
        severity: "error",
        message: `Duplicate declaration identifier ${declaration.identifier}.`,
        path: declaration.source?.path,
        source: declaration.source,
      });
    }
    seen.add(declaration.identifier);
  }
}

function validateDeclarationValueMetadata(
  declaration: QtiResponseDeclaration | QtiOutcomeDeclaration | QtiTemplateDeclaration,
  diagnostics: QtiDiagnostic[],
): void {
  validateDeclarationValue(declaration, declaration.defaultValue, "defaultValue", diagnostics);
  if (declaration.kind === "response") {
    validateDeclarationValue(
      declaration,
      declaration.correctResponse,
      "correctResponse",
      diagnostics,
    );
  }
  if (declaration.kind !== "response") return;
  validateMapping(declaration, diagnostics);
  validateAreaMapping(declaration, diagnostics);
}

function validateDeclarationValue(
  declaration: QtiResponseDeclaration | QtiOutcomeDeclaration | QtiTemplateDeclaration,
  value: QtiValue,
  role: "defaultValue" | "correctResponse",
  diagnostics: QtiDiagnostic[],
): void {
  if (value === null || declaration.cardinality === "record" || !declaration.baseType) return;
  if (!isBaseType(declaration.baseType)) return;

  if (declaration.cardinality === "single" && Array.isArray(value)) {
    const severity =
      declaration.kind === "response" &&
      role === "correctResponse" &&
      declaration.baseType === "string"
        ? "warning"
        : "error";
    diagnostics.push({
      code: `declaration.${role}.cardinality`,
      severity,
      message: `${declaration.kind} declaration ${declaration.identifier} ${role} must contain one value for single cardinality.`,
      path: declaration.source?.path,
      source: declaration.source,
    });
    return;
  }

  for (const entry of declarationValueEntries(value)) {
    if (isValidDeclarationBaseValue(entry, declaration.baseType)) continue;
    diagnostics.push({
      code: `declaration.${role}.baseType`,
      severity: "error",
      message: `${declaration.kind} declaration ${declaration.identifier} ${role} value ${entry} is not valid for base-type ${declaration.baseType}.`,
      path: declaration.source?.path,
      source: declaration.source,
    });
  }
}

function declarationValueEntries(value: QtiValue): string[] {
  if (value === null) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "object") return Object.values(value).flatMap(declarationValueEntries);
  return [String(value)];
}

function isValidDeclarationBaseValue(value: string, baseType: QtiBaseType): boolean {
  switch (baseType) {
    case "integer":
      return isInteger(value);
    case "float":
      return isFiniteNumber(value);
    case "boolean":
      return isBooleanAttribute(value);
    case "point":
      return isPoint(value);
    case "pair":
    case "directedPair":
      return isPair(value);
    case "identifier":
      return value.trim().length > 0 && !/\s/.test(value);
    case "string":
    case "duration":
    case "file":
    case "uri":
      return true;
    default:
      return assertNever(baseType);
  }
}

function validateMapping(declaration: QtiResponseDeclaration, diagnostics: QtiDiagnostic[]): void {
  const mapping = declaration.mapping;
  if (!mapping) return;
  if (!Number.isFinite(mapping.defaultValue)) {
    diagnostics.push({
      code: "mapping.defaultValue",
      severity: "error",
      message: `Response declaration ${declaration.identifier} mapping requires numeric default-value.`,
      path: declaration.source?.path,
      source: declaration.source,
    });
  }
  validateMappingBounds(declaration, mapping.attributes, mapping.source, "mapping", diagnostics);

  for (const entry of mapping.entries) {
    validateMapEntry(declaration, entry, diagnostics);
  }
}

function validateMapEntry(
  declaration: QtiResponseDeclaration,
  entry: NonNullable<QtiResponseDeclaration["mapping"]>["entries"][number],
  diagnostics: QtiDiagnostic[],
): void {
  if (!entry.attributes["map-key"]) {
    diagnostics.push({
      code: "mapEntry.mapKey.required",
      severity: "error",
      message: `Response declaration ${declaration.identifier} map entry requires map-key.`,
      path: entry.source?.path,
      source: entry.source,
    });
  }

  const mappedValue = entry.attributes["mapped-value"];
  if (mappedValue === undefined) {
    diagnostics.push({
      code: "mapEntry.mappedValue.required",
      severity: "error",
      message: `Response declaration ${declaration.identifier} map entry requires mapped-value.`,
      path: entry.source?.path,
      source: entry.source,
    });
  } else if (!isFiniteNumber(mappedValue)) {
    diagnostics.push({
      code: "mapEntry.mappedValue",
      severity: "error",
      message: `Response declaration ${declaration.identifier} map entry requires numeric mapped-value.`,
      path: entry.source?.path,
      source: entry.source,
    });
  }
}

function validateAreaMapping(
  declaration: QtiResponseDeclaration,
  diagnostics: QtiDiagnostic[],
): void {
  const areaMapping = declaration.areaMapping;
  if (!areaMapping) return;
  if (!Number.isFinite(areaMapping.defaultValue)) {
    diagnostics.push({
      code: "areaMapping.defaultValue",
      severity: "error",
      message: `Response declaration ${declaration.identifier} area mapping requires numeric default-value.`,
      path: declaration.source?.path,
      source: declaration.source,
    });
  }
  validateMappingBounds(
    declaration,
    areaMapping.attributes,
    areaMapping.source,
    "areaMapping",
    diagnostics,
  );

  for (const entry of areaMapping.entries) {
    validateAreaMapEntry(declaration, entry, diagnostics);
  }
}

function validateMappingBounds(
  declaration: QtiResponseDeclaration,
  attributes: Record<string, string>,
  source: QtiDiagnostic["source"],
  codePrefix: "mapping" | "areaMapping",
  diagnostics: QtiDiagnostic[],
): void {
  const lower = attributes["lower-bound"];
  const upper = attributes["upper-bound"];
  if (lower !== undefined && !isFiniteNumber(lower)) {
    diagnostics.push({
      code: `${codePrefix}.lowerBound`,
      severity: "error",
      message: `Response declaration ${declaration.identifier} ${codePrefix} requires numeric lower-bound.`,
      path: source?.path ?? declaration.source?.path,
      source: source ?? declaration.source,
    });
  }
  if (upper !== undefined && !isFiniteNumber(upper)) {
    diagnostics.push({
      code: `${codePrefix}.upperBound`,
      severity: "error",
      message: `Response declaration ${declaration.identifier} ${codePrefix} requires numeric upper-bound.`,
      path: source?.path ?? declaration.source?.path,
      source: source ?? declaration.source,
    });
  }
  if (
    lower !== undefined &&
    upper !== undefined &&
    isFiniteNumber(lower) &&
    isFiniteNumber(upper) &&
    Number(lower) > Number(upper)
  ) {
    diagnostics.push({
      code: `${codePrefix}.bounds`,
      severity: "error",
      message: `Response declaration ${declaration.identifier} ${codePrefix} requires lower-bound to be less than or equal to upper-bound.`,
      path: source?.path ?? declaration.source?.path,
      source: source ?? declaration.source,
    });
  }
}

function validateAreaMapEntry(
  declaration: QtiResponseDeclaration,
  entry: NonNullable<QtiResponseDeclaration["areaMapping"]>["entries"][number],
  diagnostics: QtiDiagnostic[],
): void {
  const shape = entry.attributes.shape;
  const coords = entry.attributes.coords;
  const mappedValue = entry.attributes["mapped-value"];

  if (!shape) {
    diagnostics.push({
      code: "areaMapEntry.shape.required",
      severity: "error",
      message: `Response declaration ${declaration.identifier} area map entry requires shape.`,
      path: entry.source?.path,
      source: entry.source,
    });
  } else if (!isAreaShape(shape)) {
    diagnostics.push({
      code: "areaMapEntry.shape",
      severity: "error",
      message: `Response declaration ${declaration.identifier} area map entry has unsupported shape ${shape}.`,
      path: entry.source?.path,
      source: entry.source,
    });
  }

  if (!coords) {
    diagnostics.push({
      code: "areaMapEntry.coords.required",
      severity: "error",
      message: `Response declaration ${declaration.identifier} area map entry requires coords.`,
      path: entry.source?.path,
      source: entry.source,
    });
  } else if (!isNumericCsv(coords)) {
    diagnostics.push({
      code: "areaMapEntry.coords",
      severity: "error",
      message: `Response declaration ${declaration.identifier} area map entry requires comma-separated numeric coords.`,
      path: entry.source?.path,
      source: entry.source,
    });
  } else if (
    shape &&
    isAreaShape(shape) &&
    !hasValidShapeCoordinateCount(shape, numericCsv(coords))
  ) {
    diagnostics.push({
      code: "areaMapEntry.coords.shape",
      severity: "error",
      message: `Response declaration ${declaration.identifier} area map entry shape ${shape} has invalid coords arity.`,
      path: entry.source?.path,
      source: entry.source,
    });
  }

  if (mappedValue === undefined) {
    diagnostics.push({
      code: "areaMapEntry.mappedValue.required",
      severity: "error",
      message: `Response declaration ${declaration.identifier} area map entry requires mapped-value.`,
      path: entry.source?.path,
      source: entry.source,
    });
  } else if (!isFiniteNumber(mappedValue)) {
    diagnostics.push({
      code: "areaMapEntry.mappedValue",
      severity: "error",
      message: `Response declaration ${declaration.identifier} area map entry requires numeric mapped-value.`,
      path: entry.source?.path,
      source: entry.source,
    });
  }
}

function validateDeclarationRequiredAttributes(
  declaration: QtiResponseDeclaration | QtiOutcomeDeclaration | QtiTemplateDeclaration,
  diagnostics: QtiDiagnostic[],
): void {
  if (!declaration.attributes.cardinality) {
    diagnostics.push({
      code: "declaration.cardinality.required",
      severity: "error",
      message: `${declaration.kind} declaration ${declaration.identifier || "(missing identifier)"} requires cardinality.`,
      path: declaration.source?.path,
      source: declaration.source,
    });
  } else if (!isCardinality(declaration.attributes.cardinality)) {
    diagnostics.push({
      code: "declaration.cardinality",
      severity: "error",
      message: `${declaration.kind} declaration ${declaration.identifier || "(missing identifier)"} has unsupported cardinality ${declaration.attributes.cardinality}.`,
      path: declaration.source?.path,
      source: declaration.source,
    });
  }

  if (declaration.cardinality === "record") return;

  if (!declaration.attributes["base-type"]) {
    diagnostics.push({
      code: "declaration.baseType.required",
      severity: "error",
      message: `${declaration.kind} declaration ${declaration.identifier || "(missing identifier)"} requires base-type unless cardinality is record.`,
      path: declaration.source?.path,
      source: declaration.source,
    });
  } else if (!isBaseType(declaration.attributes["base-type"])) {
    diagnostics.push({
      code: "declaration.baseType",
      severity: "error",
      message: `${declaration.kind} declaration ${declaration.identifier || "(missing identifier)"} has unsupported base-type ${declaration.attributes["base-type"]}.`,
      path: declaration.source?.path,
      source: declaration.source,
    });
  }
}

function validateOutcomeLookupTables(item: QtiAssessmentItem, diagnostics: QtiDiagnostic[]): void {
  for (const outcome of item.outcomeDeclarations) {
    const lookupTable = outcome.lookupTable;
    if (!lookupTable) continue;
    if (outcome.cardinality !== "single") {
      diagnostics.push({
        code: "lookupTable.outcome.cardinality",
        severity: "error",
        message: `Outcome declaration ${outcome.identifier} lookup table requires single cardinality.`,
        path: lookupTable.source?.path,
        source: lookupTable.source,
      });
    }
    if (lookupTable.entries.length === 0) {
      diagnostics.push({
        code: "lookupTable.entries.required",
        severity: "error",
        message: `${lookupTable.type} lookup table requires at least one entry.`,
        path: lookupTable.source?.path,
        source: lookupTable.source,
      });
    }
    for (const entry of lookupTable.entries) {
      if (!isFiniteNumber(entry.attributes["source-value"] ?? "")) {
        diagnostics.push({
          code: "lookupTable.entry.sourceValue",
          severity: "error",
          message: "Lookup table entry requires numeric source-value.",
          path: entry.source?.path,
          source: entry.source,
        });
      }
      if (entry.attributes["target-value"] === undefined) {
        diagnostics.push({
          code: "lookupTable.entry.targetValue",
          severity: "error",
          message: "Lookup table entry requires target-value.",
          path: entry.source?.path,
          source: entry.source,
        });
      }
      if (
        lookupTable.type === "match" &&
        entry.attributes["source-value"] !== undefined &&
        !isInteger(entry.attributes["source-value"])
      ) {
        diagnostics.push({
          code: "lookupTable.match.sourceValue",
          severity: "error",
          message: "qti-match-table-entry source-value must be an integer.",
          path: entry.source?.path,
          source: entry.source,
        });
      }
    }
  }
}

function validateStylesheets(item: QtiAssessmentItem, diagnostics: QtiDiagnostic[]): void {
  for (const stylesheet of item.stylesheets) {
    if (stylesheet.href.trim().length > 0) continue;
    diagnostics.push({
      code: "stylesheet.href.required",
      severity: "error",
      message: "qti-stylesheet requires a non-empty href attribute.",
      path: stylesheet.source?.path,
      source: stylesheet.source,
    });
  }
}

function validateCatalogInfo(item: QtiAssessmentItem, diagnostics: QtiDiagnostic[]): void {
  const catalogInfo = item.catalogInfo;
  if (!catalogInfo) {
    for (const reference of item.catalogReferences) {
      diagnostics.push({
        code: "catalog.idref.reference",
        severity: "error",
        message: `data-catalog-idref references missing qti-catalog id ${reference.idref}.`,
        path: reference.source?.path,
        source: reference.source,
      });
    }
    return;
  }

  const catalogIds = new Set<string>();
  for (const catalog of catalogInfo.catalogs) {
    requireIdentifier("qti-catalog", catalog.id, diagnostics, catalog.source);
    if (catalog.id && catalogIds.has(catalog.id)) {
      diagnostics.push({
        code: "catalog.id.duplicate",
        severity: "error",
        message: `Duplicate qti-catalog id ${catalog.id}.`,
        path: catalog.source?.path,
        source: catalog.source,
      });
    }
    catalogIds.add(catalog.id);

    if (catalog.cards.length === 0) {
      diagnostics.push({
        code: "catalog.card.required",
        severity: "error",
        message: `qti-catalog ${catalog.id || "(missing id)"} requires at least one qti-card.`,
        path: catalog.source?.path,
        source: catalog.source,
      });
    }

    const supports = new Set<string>();
    for (const card of catalog.cards) {
      validateCatalogCard(card, diagnostics);
      if (card.support && supports.has(card.support)) {
        diagnostics.push({
          code: "catalog.card.support.duplicate",
          severity: "error",
          message: `qti-catalog ${catalog.id || "(missing id)"} contains duplicate card support ${card.support}.`,
          path: card.source?.path,
          source: card.source,
        });
      }
      supports.add(card.support);
    }
  }

  for (const reference of item.catalogReferences) {
    if (catalogIds.has(reference.idref)) continue;
    diagnostics.push({
      code: "catalog.idref.reference",
      severity: "error",
      message: `data-catalog-idref references missing qti-catalog id ${reference.idref}.`,
      path: reference.source?.path,
      source: reference.source,
    });
  }
}

function validateCatalogCard(
  card: QtiCatalogCard | QtiCatalogCardEntry,
  diagnostics: QtiDiagnostic[],
): void {
  if ("support" in card && !card.support) {
    diagnostics.push({
      code: "catalog.card.support.required",
      severity: "error",
      message: "qti-card requires a non-empty support attribute.",
      path: card.source?.path,
      source: card.source,
    });
  }

  const entries = "entries" in card ? card.entries : [];
  const hasHtmlContent = Boolean(card.htmlContent);
  const hasFileHrefs = card.fileHrefs.length > 0;
  const hasDirectContent = hasHtmlContent || hasFileHrefs;
  const hasContent = hasDirectContent || entries.length > 0;
  if (!hasContent) {
    diagnostics.push({
      code: "catalog.card.content.required",
      severity: "error",
      message: "qti-card or qti-card-entry requires qti-html-content or qti-file-href content.",
      path: card.source?.path,
      source: card.source,
    });
  }

  if (hasHtmlContent && hasFileHrefs) {
    diagnostics.push({
      code: "catalog.card.content.choice",
      severity: "error",
      message: "qti-card or qti-card-entry must use qti-html-content or qti-file-href, not both.",
      path: card.source?.path,
      source: card.source,
    });
  }

  if (entries.length > 0 && hasDirectContent) {
    diagnostics.push({
      code: "catalog.card.entries.choice",
      severity: "error",
      message: "qti-card must use direct content or qti-card-entry children, not both.",
      path: card.source?.path,
      source: card.source,
    });
  }

  if (!("entries" in card)) {
    const defaultAttribute = card.attributes.default;
    if (defaultAttribute !== undefined && !isBooleanAttribute(defaultAttribute)) {
      diagnostics.push({
        code: "catalog.cardEntry.default.boolean",
        severity: "error",
        message: `qti-card-entry default must be an XML boolean, found ${defaultAttribute}.`,
        path: card.source?.path,
        source: card.source,
      });
    }
  }

  const defaultEntries = entries.filter((entry) => entry.default);
  if (defaultEntries.length > 1) {
    diagnostics.push({
      code: "catalog.cardEntry.default.multiple",
      severity: "error",
      message: "Only one qti-card-entry in a qti-card may be designated as default.",
      path: defaultEntries[1]?.source?.path ?? card.source?.path,
      source: defaultEntries[1]?.source ?? card.source,
    });
  }

  if (card.htmlContent) {
    validateCatalogHtmlContent(card.htmlContent.children, diagnostics);
  }
  for (const fileHref of card.fileHrefs) {
    if (fileHref.href.length > 0) continue;
    diagnostics.push({
      code: "catalog.fileHref.required",
      severity: "error",
      message: "qti-file-href requires a non-empty file reference.",
      path: fileHref.source?.path,
      source: fileHref.source,
    });
  }
  for (const entry of entries) {
    validateCatalogCard(entry, diagnostics);
  }
}

function validateCatalogHtmlContent(nodes: QtiContentNode[], diagnostics: QtiDiagnostic[]): void {
  for (const node of nodes) {
    if (node.kind === "element") {
      if (node.qtiName.startsWith("qti-")) {
        diagnostics.push({
          code: "catalog.htmlContent.qtiElement",
          severity: "error",
          message: "qti-html-content must not contain QTI-specific elements.",
          path: node.source?.path,
          source: node.source,
        });
      }
      validateCatalogHtmlContent(node.children, diagnostics);
    }
  }
}

function validateModalFeedback(item: QtiAssessmentItem, diagnostics: QtiDiagnostic[]): void {
  const outcomeIdentifiers = new Set(
    item.outcomeDeclarations.map((declaration) => declaration.identifier),
  );
  const seen = new Set<string>();
  for (const feedback of item.modalFeedback) {
    requireIdentifier("qti-modal-feedback", feedback.identifier, diagnostics, feedback.source);
    const key = `${feedback.outcomeIdentifier}\n${feedback.identifier}`;
    if (seen.has(key)) {
      diagnostics.push({
        code: "feedback.identifier.duplicate",
        severity: "error",
        message: `Duplicate modal feedback ${feedback.identifier} for outcome ${feedback.outcomeIdentifier}.`,
        path: feedback.source?.path,
        source: feedback.source,
      });
    }
    seen.add(key);
    if (!outcomeIdentifiers.has(feedback.outcomeIdentifier)) {
      diagnostics.push({
        code: "feedback.outcomeIdentifier.reference",
        severity: "error",
        message: `qti-modal-feedback ${feedback.identifier} references missing outcome declaration ${feedback.outcomeIdentifier}.`,
        path: feedback.source?.path,
        source: feedback.source,
      });
    }
  }
}
