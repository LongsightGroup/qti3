import {
  coerceValue,
  normalizeValueForCardinality,
  parseBaseType,
  parseCardinality,
  parseCoords,
  parseShape,
  parseXmlBoolean,
} from "./parser-values.js";
import type {
  QtiAssessmentItem,
  QtiBaseType,
  QtiDiagnostic,
  QtiLookupTable,
  QtiOutcomeDeclaration,
  QtiResponseDeclaration,
  QtiScalarValue,
  QtiTemplateDeclaration,
  QtiValue,
} from "./types.js";
import { childElements, textContent, type XmlNode } from "./xml.js";

export function parseResponseDeclaration(
  node: XmlNode,
  diagnostics: QtiDiagnostic[],
): QtiResponseDeclaration {
  const cardinality = parseCardinality(node.attributes.cardinality);
  const baseType = parseBaseType(node.attributes["base-type"]);
  return {
    kind: "response",
    identifier: node.attributes.identifier ?? "",
    cardinality,
    baseType,
    defaultValue: parseVariableValue(
      childElements(node, "qti-default-value")[0],
      baseType,
      diagnostics,
    ),
    correctResponse: normalizeValueForCardinality(
      parseVariableValue(childElements(node, "qti-correct-response")[0], baseType, diagnostics),
      cardinality,
    ),
    mapping: parseMapping(childElements(node, "qti-mapping")[0]),
    areaMapping: parseAreaMapping(childElements(node, "qti-area-mapping")[0]),
    attributes: node.attributes,
    source: node.source,
  };
}

export function parseOutcomeDeclaration(
  node: XmlNode,
  diagnostics: QtiDiagnostic[],
): QtiOutcomeDeclaration {
  const baseType = parseBaseType(node.attributes["base-type"]);
  return {
    kind: "outcome",
    identifier: node.attributes.identifier ?? "",
    cardinality: parseCardinality(node.attributes.cardinality),
    baseType,
    defaultValue: parseVariableValue(
      childElements(node, "qti-default-value")[0],
      baseType,
      diagnostics,
    ),
    lookupTable: parseLookupTable(node, baseType),
    attributes: node.attributes,
    source: node.source,
  };
}

export function parseTemplateDeclaration(
  node: XmlNode,
  diagnostics: QtiDiagnostic[],
): QtiTemplateDeclaration {
  const baseType = parseBaseType(node.attributes["base-type"]);
  return {
    kind: "template",
    identifier: node.attributes.identifier ?? "",
    cardinality: parseCardinality(node.attributes.cardinality),
    baseType,
    defaultValue: parseVariableValue(
      childElements(node, "qti-default-value")[0],
      baseType,
      diagnostics,
    ),
    attributes: node.attributes,
    source: node.source,
  };
}

function parseVariableValue(
  node: XmlNode | undefined,
  baseType: QtiBaseType | undefined,
  diagnostics: QtiDiagnostic[],
): QtiValue {
  if (!node) return null;
  const valueNodes = childElements(node, "qti-value");
  const entries = valueNodes.map((valueNode) => ({
    fieldIdentifier: valueNode.attributes["field-identifier"],
    value: coerceValue(textContent(valueNode), valueNode.attributes["base-type"] ?? baseType),
  }));
  const recordEntries = entries.filter(
    (entry): entry is { fieldIdentifier: string; value: QtiScalarValue } =>
      Boolean(entry.fieldIdentifier),
  );
  const fieldedEntryCount = entries.filter((entry) => entry.fieldIdentifier !== undefined).length;
  if (fieldedEntryCount > 0 && fieldedEntryCount < entries.length) {
    diagnostics.push({
      code: "declaration.value.fieldIdentifier.mixed",
      severity: "error",
      message: `${node.localName} must not mix qti-value children with and without field-identifier.`,
      path: node.source.path,
      source: node.source,
    });
  }
  if (recordEntries.length > 0) {
    return Object.fromEntries(recordEntries.map((entry) => [entry.fieldIdentifier, entry.value]));
  }
  if (entries.length === 0) {
    const text = textContent(node);
    return text.length > 0 ? coerceValue(text, baseType) : null;
  }
  if (entries.length === 1) return entries[0]?.value ?? null;
  return entries.map((entry) => entry.value);
}

function parseMapping(node: XmlNode | undefined): QtiResponseDeclaration["mapping"] | undefined {
  if (!node) return undefined;
  return {
    defaultValue: parseFiniteNumber(node.attributes["default-value"]) ?? 0,
    attributes: node.attributes,
    source: node.source,
    entries: childElements(node, "qti-map-entry").map((entry) => ({
      mapKey: entry.attributes["map-key"],
      mappedValue: parseFiniteNumber(entry.attributes["mapped-value"]) ?? 0,
      attributes: entry.attributes,
      source: entry.source,
    })),
  };
}

function parseAreaMapping(
  node: XmlNode | undefined,
): QtiResponseDeclaration["areaMapping"] | undefined {
  if (!node) return undefined;
  return {
    defaultValue: parseFiniteNumber(node.attributes["default-value"]) ?? 0,
    attributes: node.attributes,
    source: node.source,
    entries: childElements(node, "qti-area-map-entry").map((entry) => ({
      shape: parseShape(entry.attributes.shape),
      coords: parseCoords(entry.attributes.coords),
      mappedValue: parseFiniteNumber(entry.attributes["mapped-value"]) ?? 0,
      attributes: entry.attributes,
      source: entry.source,
    })),
  };
}

function parseLookupTable(
  node: XmlNode,
  baseType: QtiOutcomeDeclaration["baseType"],
): QtiLookupTable | undefined {
  const matchTable = childElements(node, "qti-match-table")[0];
  if (matchTable) return parseMatchTable(matchTable, baseType);
  const interpolationTable = childElements(node, "qti-interpolation-table")[0];
  if (interpolationTable) return parseInterpolationTable(interpolationTable, baseType);
  return undefined;
}

function parseMatchTable(
  node: XmlNode,
  baseType: QtiOutcomeDeclaration["baseType"],
): QtiLookupTable {
  return {
    type: "match",
    defaultValue: parseLookupValue(node.attributes["default-value"], baseType),
    attributes: node.attributes,
    source: node.source,
    entries: childElements(node, "qti-match-table-entry").map((entry) => ({
      sourceValue: parseFiniteNumber(entry.attributes["source-value"]) ?? 0,
      targetValue: parseLookupValue(entry.attributes["target-value"], baseType),
      attributes: entry.attributes,
      source: entry.source,
    })),
  };
}

function parseInterpolationTable(
  node: XmlNode,
  baseType: QtiOutcomeDeclaration["baseType"],
): QtiLookupTable {
  return {
    type: "interpolation",
    defaultValue: parseLookupValue(node.attributes["default-value"], baseType),
    attributes: node.attributes,
    source: node.source,
    entries: childElements(node, "qti-interpolation-table-entry").map((entry) => ({
      sourceValue: parseFiniteNumber(entry.attributes["source-value"]) ?? 0,
      targetValue: parseLookupValue(entry.attributes["target-value"], baseType),
      includeBoundary: parseXmlBoolean(entry.attributes["include-boundary"]) ?? true,
      attributes: entry.attributes,
      source: entry.source,
    })),
  };
}

function parseLookupValue(value: string | undefined, baseType: string | undefined): QtiValue {
  return value === undefined ? null : coerceValue(value, baseType);
}

function parseFiniteNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Remove entries that retained raw invalid attributes only long enough for validation. */
export function finalizeParsedDeclarationNumbers(item: QtiAssessmentItem): void {
  for (const declaration of item.responseDeclarations) {
    if (declaration.mapping) {
      declaration.mapping.entries = declaration.mapping.entries.filter(
        (entry) => parseFiniteNumber(entry.attributes["mapped-value"]) !== undefined,
      );
    }
    if (declaration.areaMapping) {
      declaration.areaMapping.entries = declaration.areaMapping.entries.filter(
        (entry) => parseFiniteNumber(entry.attributes["mapped-value"]) !== undefined,
      );
    }
  }
  for (const declaration of item.outcomeDeclarations) {
    if (!declaration.lookupTable) continue;
    declaration.lookupTable.entries = declaration.lookupTable.entries.filter(
      (entry) => parseFiniteNumber(entry.attributes["source-value"]) !== undefined,
    );
  }
}
