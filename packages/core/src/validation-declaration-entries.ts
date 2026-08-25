import type { QtiDiagnostic, QtiLookupTable } from "./types.js";
import {
  hasValidShapeCoordinateCount,
  isAreaShape,
  isNumericCsv,
  numericCsv,
} from "./validation-geometry.js";
import { isFiniteNumber, isInteger } from "./validation-primitives.js";

interface DeclarationEntryAttributes {
  attributes: Record<string, string>;
  source?: QtiDiagnostic["source"] | undefined;
}

/** Append diagnostics for raw qti-map-entry attributes. */
export function validateMapEntryAttributes(
  declarationIdentifier: string,
  entry: DeclarationEntryAttributes,
  diagnostics: QtiDiagnostic[],
): void {
  if (!entry.attributes["map-key"]) {
    diagnostics.push({
      code: "mapEntry.mapKey.required",
      severity: "error",
      message: `Response declaration ${declarationIdentifier} map entry requires map-key.`,
      path: entry.source?.path,
      source: entry.source,
    });
  }

  const mappedValue = entry.attributes["mapped-value"];
  if (mappedValue === undefined) {
    diagnostics.push({
      code: "mapEntry.mappedValue.required",
      severity: "error",
      message: `Response declaration ${declarationIdentifier} map entry requires mapped-value.`,
      path: entry.source?.path,
      source: entry.source,
    });
  } else if (!isFiniteNumber(mappedValue)) {
    diagnostics.push({
      code: "mapEntry.mappedValue",
      severity: "error",
      message: `Response declaration ${declarationIdentifier} map entry requires numeric mapped-value.`,
      path: entry.source?.path,
      source: entry.source,
    });
  }
}

/** Append diagnostics for raw qti-area-map-entry attributes. */
export function validateAreaMapEntryAttributes(
  declarationIdentifier: string,
  entry: DeclarationEntryAttributes,
  diagnostics: QtiDiagnostic[],
): void {
  const shape = entry.attributes.shape;
  const coords = entry.attributes.coords;
  const mappedValue = entry.attributes["mapped-value"];

  if (!shape) {
    diagnostics.push({
      code: "areaMapEntry.shape.required",
      severity: "error",
      message: `Response declaration ${declarationIdentifier} area map entry requires shape.`,
      path: entry.source?.path,
      source: entry.source,
    });
  } else if (!isAreaShape(shape)) {
    diagnostics.push({
      code: "areaMapEntry.shape",
      severity: "error",
      message: `Response declaration ${declarationIdentifier} area map entry has unsupported shape ${shape}.`,
      path: entry.source?.path,
      source: entry.source,
    });
  }

  if (!coords) {
    diagnostics.push({
      code: "areaMapEntry.coords.required",
      severity: "error",
      message: `Response declaration ${declarationIdentifier} area map entry requires coords.`,
      path: entry.source?.path,
      source: entry.source,
    });
  } else if (!isNumericCsv(coords)) {
    diagnostics.push({
      code: "areaMapEntry.coords",
      severity: "error",
      message: `Response declaration ${declarationIdentifier} area map entry requires comma-separated numeric coords.`,
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
      message: `Response declaration ${declarationIdentifier} area map entry shape ${shape} has invalid coords arity.`,
      path: entry.source?.path,
      source: entry.source,
    });
  }

  if (mappedValue === undefined) {
    diagnostics.push({
      code: "areaMapEntry.mappedValue.required",
      severity: "error",
      message: `Response declaration ${declarationIdentifier} area map entry requires mapped-value.`,
      path: entry.source?.path,
      source: entry.source,
    });
  } else if (!isFiniteNumber(mappedValue)) {
    diagnostics.push({
      code: "areaMapEntry.mappedValue",
      severity: "error",
      message: `Response declaration ${declarationIdentifier} area map entry requires numeric mapped-value.`,
      path: entry.source?.path,
      source: entry.source,
    });
  }
}

/** Append diagnostics for raw lookup-table entry attributes. */
export function validateLookupTableEntryAttributes(
  tableType: QtiLookupTable["type"],
  entry: DeclarationEntryAttributes,
  diagnostics: QtiDiagnostic[],
): void {
  const sourceValue = entry.attributes["source-value"];
  if (sourceValue === undefined || !isFiniteNumber(sourceValue)) {
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
  if (tableType === "match" && sourceValue !== undefined && !isInteger(sourceValue)) {
    diagnostics.push({
      code: "lookupTable.match.sourceValue",
      severity: "error",
      message: "qti-match-table-entry source-value must be an integer.",
      path: entry.source?.path,
      source: entry.source,
    });
  }
}
