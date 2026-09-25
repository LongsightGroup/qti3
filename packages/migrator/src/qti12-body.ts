import { escapeXmlAttribute, escapeXmlText } from "@longsightgroup/qti3-core";
import { qti3TrustedXmlFragment } from "@longsightgroup/qti3-writer";

import {
  attr,
  findAllDescendantsByLocalName,
  findDescendantByLocalName,
  serializeChildren,
  textOf,
  type XmlElement,
} from "./xml.js";

export function materialHtml(root: XmlElement): string {
  const materials = findAllDescendantsByLocalName(root, "material");
  if (!materials.length) return serializeChildren(root).trim() || "<p></p>";
  return materials
    .map((material) => {
      const mattext = findDescendantByLocalName(material, "mattext");
      if (mattext) return `<p>${serializeChildren(mattext) || escapeXmlText(textOf(mattext))}</p>`;
      const matimage = findDescendantByLocalName(material, "matimage");
      if (matimage) {
        const src = attr(matimage, "uri") ?? "";
        return `<p><img src="${escapeXmlAttribute(src)}"/></p>`;
      }
      return `<p>${escapeXmlText(textOf(material))}</p>`;
    })
    .join("\n");
}

export function presentationBodyHtml(
  presentation: XmlElement | null,
): ReturnType<typeof qti3TrustedXmlFragment> {
  return qti3TrustedXmlFragment(presentation ? materialHtml(presentation) : "<p></p>");
}
