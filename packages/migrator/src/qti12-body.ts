import { qti3TrustedXmlFragment } from "@longsightgroup/qti3-writer";

import { escapeText, normalizeIdentifier } from "./text.js";
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
      if (mattext) return `<p>${serializeChildren(mattext) || escapeText(textOf(mattext))}</p>`;
      const matimage = findDescendantByLocalName(material, "matimage");
      if (matimage) {
        const src = attr(matimage, "uri") ?? "";
        return `<p><img src="${escapeText(src)}"/></p>`;
      }
      return `<p>${escapeText(textOf(material))}</p>`;
    })
    .join("\n");
}

export function presentationBodyHtml(
  presentation: XmlElement | null,
): ReturnType<typeof qti3TrustedXmlFragment> {
  return qti3TrustedXmlFragment(presentation ? materialHtml(presentation) : "<p></p>");
}

export function correctEntries(item: XmlElement): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const condition of findAllDescendantsByLocalName(item, "respcondition")) {
    const varequal = findAllDescendantsByLocalName(condition, "varequal");
    for (const value of varequal) {
      const responseIdentifier = normalizeIdentifier(attr(value, "respident"), "RESPONSE");
      const values = out.get(responseIdentifier) ?? [];
      values.push(textOf(value));
      out.set(responseIdentifier, values);
    }
    for (const region of findAllDescendantsByLocalName(condition, "varinside")) {
      const responseIdentifier = normalizeIdentifier(attr(region, "respident"), "RESPONSE");
      const response = [
        ...findAllDescendantsByLocalName(item, "response_xy"),
        ...findAllDescendantsByLocalName(item, "response_lid"),
      ].find(
        (candidate) =>
          normalizeIdentifier(attr(candidate, "ident"), "RESPONSE") === responseIdentifier,
      );
      if (!response) continue;
      const coords = textOf(region).trim();
      const matchingLabels = findAllDescendantsByLocalName(response, "response_label").filter(
        (label) => (attr(label, "coords") ?? attr(label, "xy") ?? textOf(label).trim()) === coords,
      );
      if (matchingLabels.length !== 1) continue;
      const matchingLabel = matchingLabels.at(0);
      if (!matchingLabel) continue;
      const labelIdentifier = attr(matchingLabel, "ident");
      if (!labelIdentifier) continue;
      const values = out.get(responseIdentifier) ?? [];
      values.push(labelIdentifier);
      out.set(responseIdentifier, values);
    }
  }
  for (const response of [
    ...findAllDescendantsByLocalName(item, "response_lid"),
    ...findAllDescendantsByLocalName(item, "response_xy"),
  ]) {
    const responseIdentifier = normalizeIdentifier(attr(response, "ident"), "RESPONSE");
    if (out.has(responseIdentifier)) continue;
    const renderer =
      findDescendantByLocalName(response, "render_choice") ??
      findDescendantByLocalName(response, "render_hotspot") ??
      response;
    const labels = findAllDescendantsByLocalName(renderer, "response_label");
    const correct = labels.find((label) => attr(label, "rshuffle") === "No");
    if (correct) out.set(responseIdentifier, [attr(correct, "ident") ?? ""]);
  }
  return out;
}
