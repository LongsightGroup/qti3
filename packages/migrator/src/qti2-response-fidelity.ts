import { diagnostic } from "./diagnostics.js";
import { normalizeIdentifier } from "./text.js";
import type { QtiMigrationDiagnostic, QtiMigrationSourceFormat } from "./types.js";
import {
  attr,
  childElements,
  findAllDescendantsByLocalName,
  localName,
  parseXml,
  type XmlElement,
} from "./xml.js";

/** Reject response semantics that the authoring writer cannot reproduce faithfully. */
export function validateQti2ResponseFidelity(
  sourceXml: string,
  writtenXml: string,
  path: string,
  sourceFormat: QtiMigrationSourceFormat,
): QtiMigrationDiagnostic[] {
  const source = parseXml(sourceXml, path).documentElement;
  const target = parseXml(writtenXml, path).documentElement;
  const declarations = new Map(
    findAllDescendantsByLocalName(target, "qti-response-declaration").map((entry) => [
      attr(entry, "identifier"),
      entry,
    ]),
  );
  const diagnostics: QtiMigrationDiagnostic[] = [];
  for (const declaration of findAllDescendantsByLocalName(source, "responsedeclaration")) {
    const identifier = normalizeIdentifier(attr(declaration, "identifier"));
    const written = declarations.get(identifier);
    const sourceSections = responseSections(declaration);
    const targetSections = written ? responseSections(written) : undefined;
    for (const kind of ["defaultValue", "mapping", "areaMapping"] as const) {
      const original = sourceSections[kind];
      if (!original) continue;
      const emitted = targetSections?.[kind];
      const expected =
        kind === "defaultValue"
          ? defaultValues(original)
          : mapping(original, kind === "areaMapping");
      const actual =
        emitted &&
        (kind === "defaultValue"
          ? defaultValues(emitted)
          : mapping(emitted, kind === "areaMapping"));
      if (
        expected !== undefined &&
        actual !== undefined &&
        JSON.stringify(expected) === JSON.stringify(actual)
      )
        continue;
      diagnostics.push(
        diagnostic(
          kind === "defaultValue"
            ? "qti2_response_default_not_preserved"
            : "qti2_response_mapping_not_preserved",
          "error",
          `Response "${identifier}" ${kind === "defaultValue" ? "default value" : "mapping"} cannot be preserved by the QTI 3 authoring model.`,
          { path, sourceFormat },
        ),
      );
    }
  }
  return diagnostics;
}

function responseSections(declaration: XmlElement) {
  const children = childElements(declaration);
  return {
    defaultValue: children.find((child) =>
      ["defaultvalue", "qti-default-value"].includes(localName(child)),
    ),
    mapping: children.find((child) => ["mapping", "qti-mapping"].includes(localName(child))),
    areaMapping: children.find((child) =>
      ["areamapping", "qti-area-mapping"].includes(localName(child)),
    ),
  };
}

// This is a conservative migration gate, not a general XML equivalence checker.
// Unknown attributes or children must not disappear through the semantic projection.
function hasOnlyAttributes(element: XmlElement, names: readonly string[]): boolean {
  for (let index = 0; index < element.attributes.length; index++) {
    const attribute = element.attributes.item(index);
    if (attribute && !attribute.name.startsWith("xmlns") && !names.includes(attribute.name))
      return false;
  }
  return true;
}

function defaultValues(element: XmlElement) {
  if (!hasOnlyAttributes(element, ["interpretation"])) return undefined;
  const children = childElements(element);
  if (
    children.some(
      (child) =>
        !["value", "qti-value"].includes(localName(child)) ||
        !hasOnlyAttributes(child, [
          "fieldIdentifier",
          "field-identifier",
          "baseType",
          "base-type",
        ]) ||
        childElements(child).length > 0,
    )
  )
    return undefined;
  return children.map((child) => ({
    fieldIdentifier: attr(child, "fieldIdentifier") ?? attr(child, "field-identifier"),
    baseType: attr(child, "baseType") ?? attr(child, "base-type"),
    value: child.textContent,
  }));
}

function numericAttribute(element: XmlElement, legacy: string, current: string, fallback?: string) {
  const raw = attr(element, legacy) ?? attr(element, current) ?? fallback;
  if (raw === undefined) return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : raw;
}

function mapping(element: XmlElement, area: boolean) {
  if (
    !hasOnlyAttributes(element, [
      "defaultValue",
      "default-value",
      "lowerBound",
      "lower-bound",
      "upperBound",
      "upper-bound",
    ])
  )
    return undefined;
  const children = childElements(element);
  const names = area ? ["areamapentry", "qti-area-map-entry"] : ["mapentry", "qti-map-entry"];
  const attributes = area
    ? ["shape", "coords", "mappedValue", "mapped-value"]
    : ["mapKey", "map-key", "mappedValue", "mapped-value", "caseSensitive", "case-sensitive"];
  if (
    children.some(
      (child) =>
        !names.includes(localName(child)) ||
        !hasOnlyAttributes(child, attributes) ||
        childElements(child).length > 0,
    )
  )
    return undefined;
  return {
    defaultValue: numericAttribute(element, "defaultValue", "default-value", "0"),
    lowerBound: numericAttribute(element, "lowerBound", "lower-bound"),
    upperBound: numericAttribute(element, "upperBound", "upper-bound"),
    // Entry order preserves first-match precedence for overlapping areas and keys.
    entries: children.map((child) =>
      area
        ? {
            shape: attr(child, "shape"),
            coords: attr(child, "coords"),
            mappedValue: numericAttribute(child, "mappedValue", "mapped-value"),
          }
        : {
            mapKey: attr(child, "mapKey") ?? attr(child, "map-key"),
            mappedValue: numericAttribute(child, "mappedValue", "mapped-value"),
            caseSensitive: mapCaseSensitive(child),
          },
    ),
  };
}

function mapCaseSensitive(entry: XmlElement): boolean | string {
  // QTI 2 and QTI 3 both default map-entry case sensitivity to false.
  const raw = attr(entry, "caseSensitive") ?? attr(entry, "case-sensitive") ?? "false";
  if (raw === "false" || raw === "0") return false;
  if (raw === "true" || raw === "1") return true;
  return raw;
}
