import {
  coerceValue,
  normalizeValueForCardinality,
  parseBaseType,
  parseCardinality,
  parseCoords,
  parseFiniteNumber,
  parseShape,
  parseXmlBoolean,
} from "./parser-values.js";
import type {
  QtiBaseType,
  QtiDiagnostic,
  QtiLookupTable,
  QtiOutcomeDeclaration,
  QtiResponseDeclaration,
  QtiScalarValue,
  QtiTemplateDeclaration,
  QtiValue,
} from "./types.js";
import {
  validateAreaMapEntryAttributes,
  validateLookupTableEntryAttributes,
  validateMapEntryAttributes,
} from "./validation-declaration-entries.js";
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
    mapping: parseMapping(
      childElements(node, "qti-mapping")[0],
      node.attributes.identifier ?? "",
      diagnostics,
    ),
    areaMapping: parseAreaMapping(
      childElements(node, "qti-area-mapping")[0],
      node.attributes.identifier ?? "",
      diagnostics,
    ),
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
    lookupTable: parseLookupTable(node, baseType, diagnostics),
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

function parseMapping(
  node: XmlNode | undefined,
  declarationIdentifier: string,
  diagnostics: QtiDiagnostic[],
): QtiResponseDeclaration["mapping"] | undefined {
  if (!node) return undefined;
  const defaultValue = parseFiniteNumber(node.attributes["default-value"]);
  return {
    defaultValue: defaultValue ?? 0,
    attributes: node.attributes,
    source: node.source,
    entries: childElements(node, "qti-map-entry").flatMap((entry) => {
      const rawMappedValue = entry.attributes["mapped-value"];
      const mappedValue = parseFiniteNumber(rawMappedValue);
      if (mappedValue === undefined) {
        validateMapEntryAttributes(declarationIdentifier, entry, diagnostics);
        return [];
      }
      return [
        {
          mapKey: entry.attributes["map-key"],
          mappedValue,
          attributes: entry.attributes,
          source: entry.source,
        },
      ];
    }),
  };
}

function parseAreaMapping(
  node: XmlNode | undefined,
  declarationIdentifier: string,
  diagnostics: QtiDiagnostic[],
): QtiResponseDeclaration["areaMapping"] | undefined {
  if (!node) return undefined;
  const defaultValue = parseFiniteNumber(node.attributes["default-value"]);
  return {
    defaultValue: defaultValue ?? 0,
    attributes: node.attributes,
    source: node.source,
    entries: childElements(node, "qti-area-map-entry").flatMap((entry) => {
      const mappedValue = parseFiniteNumber(entry.attributes["mapped-value"]);
      if (mappedValue === undefined) {
        validateAreaMapEntryAttributes(declarationIdentifier, entry, diagnostics);
        return [];
      }
      return [
        {
          shape: parseShape(entry.attributes.shape),
          coords: parseCoords(entry.attributes.coords),
          mappedValue,
          attributes: entry.attributes,
          source: entry.source,
        },
      ];
    }),
  };
}

function parseLookupTable(
  node: XmlNode,
  baseType: QtiOutcomeDeclaration["baseType"],
  diagnostics: QtiDiagnostic[],
): QtiLookupTable | undefined {
  const matchTable = childElements(node, "qti-match-table")[0];
  if (matchTable) return parseMatchTable(matchTable, baseType, diagnostics);
  const interpolationTable = childElements(node, "qti-interpolation-table")[0];
  if (interpolationTable) return parseInterpolationTable(interpolationTable, baseType, diagnostics);
  return undefined;
}

function parseMatchTable(
  node: XmlNode,
  baseType: QtiOutcomeDeclaration["baseType"],
  diagnostics: QtiDiagnostic[],
): QtiLookupTable {
  return {
    type: "match",
    defaultValue: parseLookupValue(node.attributes["default-value"], baseType),
    attributes: node.attributes,
    source: node.source,
    entries: parseLookupEntries(node, "match", baseType, diagnostics),
  };
}

function parseInterpolationTable(
  node: XmlNode,
  baseType: QtiOutcomeDeclaration["baseType"],
  diagnostics: QtiDiagnostic[],
): QtiLookupTable {
  return {
    type: "interpolation",
    defaultValue: parseLookupValue(node.attributes["default-value"], baseType),
    attributes: node.attributes,
    source: node.source,
    entries: parseLookupEntries(node, "interpolation", baseType, diagnostics),
  };
}

function parseLookupValue(value: string | undefined, baseType: string | undefined): QtiValue {
  return value === undefined ? null : coerceValue(value, baseType);
}

function parseLookupEntries(
  node: XmlNode,
  tableType: QtiLookupTable["type"],
  baseType: QtiOutcomeDeclaration["baseType"],
  diagnostics: QtiDiagnostic[],
): QtiLookupTable["entries"] {
  const entryName =
    tableType === "match" ? "qti-match-table-entry" : "qti-interpolation-table-entry";
  return childElements(node, entryName).flatMap((entry) => {
    const rawSourceValue = entry.attributes["source-value"];
    const sourceValue = parseFiniteNumber(rawSourceValue);
    if (sourceValue === undefined) {
      validateLookupTableEntryAttributes(tableType, entry, diagnostics);
      return [];
    }
    return [
      {
        sourceValue,
        targetValue: parseLookupValue(entry.attributes["target-value"], baseType),
        includeBoundary:
          tableType === "interpolation"
            ? (parseXmlBoolean(entry.attributes["include-boundary"]) ?? true)
            : undefined,
        attributes: entry.attributes,
        source: entry.source,
      },
    ];
  });
}
