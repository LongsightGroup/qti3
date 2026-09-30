import { escapeXmlAttribute, escapeXmlText } from "@longsightgroup/qti3-core";
import { diagnostic } from "./diagnostics.js";
import type { QtiMigrationDiagnostic } from "./types.js";
import {
  attr,
  childElements,
  findAllDescendantsByLocalName,
  localName,
  parseXml,
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
          // Support well-formed XHTML fragments. Do not guess missing tags or decode twice.
          const markup = childElements(component).length
            ? serializeChildren(component)
            : (component.textContent ?? "");
          try {
            const parsed = parseXml(`<div>${markup}</div>`, "QTI 1.2 HTML material");
            parts.push(`<div>${serializeChildren(parsed.documentElement)}</div>`);
          } catch {
            return refused(path, "HTML material must be a well-formed XHTML fragment.");
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
        const materials = findAllDescendantsByLocalName(element, "material");
        if (!materials.length) return serializeChildren(element).trim() || "<p></p>";
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
