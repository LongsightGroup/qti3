import { DOMParser, onErrorStopParsing } from "@xmldom/xmldom";
import { escapeXmlAttribute, escapeXmlText } from "@longsightgroup/qti3-core";
import { attr, childElements, localName, serializeChildren, type XmlElement } from "../xml.js";
import type { LmsIssue } from "./types.js";

export function field(parent: XmlElement, name: string): XmlElement | undefined {
  return childElements(parent).find((child) => localName(child) === name);
}
export function text(element: XmlElement | null | undefined): string {
  if (!element) return "";
  return (field(element, "text")?.textContent ?? element.textContent ?? "").trim();
}
export function fieldText(parent: XmlElement, name: string): string {
  return text(field(parent, name));
}
/** Parse source HTML as data; writer validation remains the final QTI content boundary. */
export function html(raw: string, format: string, issues: LmsIssue[]): string {
  if (format !== "html" && format !== "") {
    if (format !== "plain" && format !== "plain_text")
      issues.push({
        code: "LMS_CONTENT_REVIEW",
        message: `Source ${format} formatting is retained as literal text; reapply formatting when required.`,
      });
    return `<p>${escapeXmlText(raw).replace(/\r?\n/g, "<br/>")}</p>`;
  }
  try {
    const root = new DOMParser({ onError: onErrorStopParsing }).parseFromString(
      `<div xmlns="">${raw}</div>`,
      "text/html",
    ).documentElement;
    if (!root) {
      issues.push({ code: "LMS_CONTENT_INVALID", message: "Source HTML has no content root." });
      return "<p/>";
    }
    const pending = [root];
    for (let index = 0; index < pending.length; index++) {
      const element = pending[index];
      if (!element) continue;
      checkElement(element, issues);
      pending.push(...childElements(element));
    }
    return serializeChildren(root) || "<p/>";
  } catch {
    issues.push({
      code: "LMS_CONTENT_INVALID",
      message: "Source HTML could not be normalized safely.",
    });
    return "<p/>";
  }
}
function checkElement(element: XmlElement, issues: LmsIssue[]): void {
  if (localName(element) === "img" && attr(element, "alt") === null)
    issues.push({
      code: "LMS_IMAGE_ALT_REQUIRED",
      message:
        "A source image needs an explicit alt attribute. Supply a description, or an empty alt for a decorative image, and import again.",
    });
  if (["script", "iframe", "object"].includes(localName(element)))
    issues.push({
      code: "LMS_CONTENT_INVALID",
      message: `Executable source element ${localName(element)} cannot be migrated.`,
    });
  for (let index = 0; index < element.attributes.length; index++) {
    const attribute = element.attributes.item(index);
    if (attribute && (/^on/i.test(attribute.name) || /^\s*javascript:/i.test(attribute.value)))
      issues.push({
        code: "LMS_CONTENT_INVALID",
        message: "Executable source attributes cannot be migrated.",
      });
  }
}
export function literalHtmlText(raw: string): string {
  return (
    new DOMParser({ onError: onErrorStopParsing }).parseFromString(`<div>${raw}</div>`, "text/html")
      .documentElement?.textContent ?? ""
  );
}
export function metadata(parent: XmlElement): { tags: string[]; settings: Record<string, string> } {
  const tagsNode = field(parent, "tags");
  const tags = tagsNode
    ? childElements(tagsNode)
        .filter((node) => localName(node) === "tag")
        .map(text)
    : [];
  const settings: Record<string, string> = {};
  for (const node of childElements(parent))
    if (
      ![
        "name",
        "questiontext",
        "answer",
        "subquestion",
        "dragbox",
        "feedback",
        "generalfeedback",
        "correctfeedback",
        "incorrectfeedback",
        "partiallycorrectfeedback",
        "hint",
        "tags",
        "file",
        "graderinfo",
      ].includes(localName(node))
    )
      settings[localName(node)] = text(node);
  return { tags, settings };
}
export function textMarker({ id }: { id: string }): string {
  return `<qti-text-entry-interaction response-identifier="${escapeXmlAttribute(id)}"/>`;
}
export function inlineMarker({ id }: { id: string }): string {
  return `<qti-inline-choice-interaction response-identifier="${escapeXmlAttribute(id)}"/>`;
}
export function sourceFormat(element: XmlElement): string {
  return attr(element, "format") ?? "html";
}
