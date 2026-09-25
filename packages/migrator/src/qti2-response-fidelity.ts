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
    for (const kind of ["defaultvalue", "mapping", "areamapping"] as const) {
      const original = childElements(declaration).find((child) => normalizedName(child) === kind);
      if (!original) continue;
      const emitted =
        written && childElements(written).find((child) => normalizedName(child) === kind);
      if (emitted && canonicalSemantics(original) === canonicalSemantics(emitted)) continue;
      diagnostics.push(
        diagnostic(
          kind === "defaultvalue"
            ? "qti2_response_default_not_preserved"
            : "qti2_response_mapping_not_preserved",
          "error",
          `Response "${identifier}" ${kind === "defaultvalue" ? "default value" : "mapping"} cannot be preserved by the QTI 3 authoring model.`,
          { path, sourceFormat },
        ),
      );
    }
  }
  return diagnostics;
}

function normalizedName(element: XmlElement): string {
  return localName(element).replace(/^qti-/, "").replaceAll("-", "");
}

function canonicalSemantics(element: XmlElement): string {
  const name = normalizedName(element);
  const attributes = new Map<string, string>();
  for (let index = 0; index < element.attributes.length; index += 1) {
    const attribute = element.attributes.item(index);
    if (!attribute || attribute.name.startsWith("xmlns")) continue;
    const key = attribute.name.replaceAll("-", "").toLowerCase();
    if (key === "interpretation") continue;
    let value = attribute.value;
    if (["defaultvalue", "lowerbound", "upperbound", "mappedvalue"].includes(key)) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) value = String(numeric);
    }
    if (key === "casesensitive") value = value === "false" || value === "0" ? "false" : "true";
    attributes.set(key, value);
  }
  if (name === "mapentry" && !attributes.has("casesensitive"))
    attributes.set("casesensitive", "false");
  if ((name === "mapping" || name === "areamapping") && !attributes.has("defaultvalue"))
    attributes.set("defaultvalue", "0");
  const children = childElements(element);
  const canonicalChildren = children.map(canonicalSemantics);
  return JSON.stringify({
    name,
    attributes: [...attributes].toSorted(([a], [b]) => a.localeCompare(b)),
    // First-match priority matters for overlapping areas and case-insensitive map keys.
    children: canonicalChildren,
    value: children.length ? undefined : element.textContent,
  });
}
