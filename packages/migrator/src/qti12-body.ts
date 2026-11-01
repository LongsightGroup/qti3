import { DOMParser, onErrorStopParsing } from "@xmldom/xmldom";
import { escapeXmlAttribute, escapeXmlText } from "@longsightgroup/qti3-core";
import { diagnostic } from "./diagnostics.js";
import type { QtiMigrationDiagnostic } from "./types.js";
import {
  attr,
  childElements,
  findAllDescendantsByLocalName,
  localName,
  serializeChildren,
  type XmlElement,
} from "./xml.js";

/** Parsed material fragments shared by the item body and its choice mappers. */
export interface Qti12Content {
  readonly materialHtml: (root: XmlElement) => string;
}

/** Parse supported material once; refuse content that cannot be faithfully represented. */
export function prepareQti12Content(
  root: XmlElement,
  path: string,
):
  | { readonly ok: true; readonly content: Qti12Content }
  | { readonly ok: false; readonly diagnostics: readonly QtiMigrationDiagnostic[] } {
  const fragments = new Map<XmlElement, string>();
  for (const material of findAllDescendantsByLocalName(root, "material")) {
    const parts: string[] = [];
    for (const component of childElements(material)) {
      const name = localName(component);
      if (name === "mattext") {
        const type = attr(component, "texttype") ?? "text/plain";
        if (type === "text/plain") {
          parts.push(`<p>${escapeXmlText(component.textContent ?? "")}</p>`);
        } else if (type === "text/html") {
          // Canvas exports HTML fragments: decode HTML entities and normalize HTML void elements.
          // The enclosing QTI document remains strictly parsed as XML.
          const markup = childElements(component).length
            ? serializeChildren(component)
            : (component.textContent ?? "");
          try {
            const parsed = new DOMParser({ onError: onErrorStopParsing }).parseFromString(
              `<div xmlns="">${markup}</div>`,
              "text/html",
            );
            const htmlRoot = parsed.documentElement;
            if (!htmlRoot) throw new Error("HTML material has no root.");
            parts.push(`<div>${serializeChildren(htmlRoot)}</div>`);
          } catch {
            return refused(path, "HTML material could not be parsed safely.");
          }
        } else return refused(path, `Unsupported mattext content type "${type}".`);
      } else if (name === "matimage") {
        const src = attr(component, "uri");
        if (!src) return refused(path, "Image material requires a URI.");
        const alt = attr(component, "label") ?? "";
        parts.push(
          `<p><img src="${escapeXmlAttribute(src)}" alt="${escapeXmlAttribute(alt)}"/></p>`,
        );
      } else return refused(path, `Unsupported material component "${name}".`);
    }
    fragments.set(material, parts.join("\n") || "<p></p>");
  }
  return {
    ok: true,
    content: {
      materialHtml(element) {
        const direct = fragments.get(element);
        if (direct !== undefined) return direct;
        const materials = ownedMaterials(element);
        if (!materials.length)
          return localName(element) === "presentation"
            ? "<p></p>"
            : serializeChildren(element).trim() || "<p></p>";
        return materials
          .map((material) => {
            const fragment = fragments.get(material);
            if (fragment === undefined) throw new Error("Material was not prepared for this item.");
            return fragment;
          })
          .join("\n");
      },
    },
  };
}

function refused(path: string, message: string) {
  return {
    ok: false,
    diagnostics: [
      diagnostic("qti12_material_not_preserved", "error", message, { path, sourceFormat: "qti12" }),
    ],
  } as const;
}

/** Response interactions own their materials; presentation flow wrappers only own their stem. */
function ownedMaterials(root: XmlElement): XmlElement[] {
  const materials: XmlElement[] = [];
  for (const child of childElements(root)) {
    const name = localName(child);
    if (
      ["response_lid", "response_str", "response_num", "response_grp", "response_xy"].includes(name)
    )
      continue;
    if (name === "material") materials.push(child);
    else materials.push(...ownedMaterials(child));
  }
  return materials;
}
