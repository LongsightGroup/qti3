import { diagnostic } from "./diagnostics.js";
import { normalizeIdentifier } from "./text.js";
import type { QtiMigrationDiagnostic, QtiMigrationSourceFormat } from "./types.js";
import {
  attr,
  childElements,
  findAllDescendantsByLocalName,
  findDescendantByLocalName,
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
  const processing = findDescendantByLocalName(source, "responseprocessing");
  const writtenProcessing = findDescendantByLocalName(target, "qti-response-processing");
  if (processing && !preservesProcessing(processing, writtenProcessing)) {
    diagnostics.push(
      diagnostic(
        "qti2_response_processing_not_preserved",
        "error",
        "Authored QTI 2 response processing cannot be reproduced by the QTI 3 authoring model.",
        { path, sourceFormat },
      ),
    );
  }
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

// Internal rules override an external template (QTI 2.1 §8.2). Never infer a
// scoring program from correctResponse or mapping when one was actually authored.
function preservesProcessing(source: XmlElement, target: XmlElement | null): boolean {
  if (!hasOnlyAttributes(source, ["template", "templateLocation"]) || !target) return false;
  const rules = childElements(source);
  if (rules.length > 0) {
    return equalProcessingNodes(
      rules.map(processingNode),
      childElements(target).map(processingNode),
    );
  }
  const template = attr(source, "template");
  if (!template || childElements(target).length > 0) return false;
  const match =
    /^https?:\/\/www\.imsglobal\.org\/question\/qti_v2p[12]\/rptemplates\/(match_correct|map_response|map_response_point)(?:\.xml)?$/.exec(
      template,
    );
  if (!match) return false;
  return (
    attr(target, "template")?.replace(/\.xml$/, "") ===
    `https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/${match[1]}`
  );
}

// Conservative structural equivalence for the writer's existing inline programs.
// Naming changes between QTI versions do not change the expression tree; values,
// attributes, child order, and all operators must otherwise agree exactly.
interface CanonicalProcessingNode {
  readonly namespace: string | null;
  readonly name: string;
  readonly attributes: readonly (readonly [string, string])[];
  readonly text: string | null | undefined;
  readonly children: readonly CanonicalProcessingNode[];
}

function normalizedProcessingName(name: string): string {
  return name.replace(/^qti-/, "").replaceAll("-", "").toLowerCase();
}

function processingNode(node: XmlElement): CanonicalProcessingNode {
  const attributes: Array<[string, string]> = [];
  for (let index = 0; index < node.attributes.length; index++) {
    const attribute = node.attributes.item(index);
    if (attribute && !attribute.name.startsWith("xmlns")) {
      attributes.push([attribute.name.replaceAll("-", "").toLowerCase(), attribute.value]);
    }
  }
  const children = childElements(node);
  return {
    namespace: [
      "http://www.imsglobal.org/xsd/imsqti_v2p1",
      "http://www.imsglobal.org/xsd/imsqti_v2p2",
      "http://www.imsglobal.org/xsd/imsqtiasi_v3p0",
    ].includes(node.namespaceURI ?? "")
      ? "qti"
      : node.namespaceURI,
    name: normalizedProcessingName(localName(node)),
    attributes: attributes.toSorted(([left], [right]) => left.localeCompare(right)),
    text: children.length ? undefined : node.textContent,
    children: children.map(processingNode),
  };
}

function equalProcessingNodes(
  left: readonly CanonicalProcessingNode[],
  right: readonly CanonicalProcessingNode[],
): boolean {
  return (
    left.length === right.length &&
    left.every((node, index) => {
      const other = right[index];
      return (
        other !== undefined &&
        node.namespace === other.namespace &&
        node.name === other.name &&
        node.text === other.text &&
        node.attributes.length === other.attributes.length &&
        node.attributes.every(([name, value], attributeIndex) => {
          const attribute = other.attributes[attributeIndex];
          return attribute !== undefined && name === attribute[0] && value === attribute[1];
        }) &&
        equalProcessingNodes(node.children, other.children)
      );
    })
  );
}
