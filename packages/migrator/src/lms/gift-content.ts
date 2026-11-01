import { childElements, localName, parseXml, serializeChildren } from "../xml.js";
import { html } from "./content.js";
import { unescapeGift } from "./gift-tokens.js";
import type { LmsIssue } from "./types.js";
export function readGiftFormat(
  input: string,
  defaultFormat = "moodle_auto_format",
): { content: string; format: string } {
  const marker = /^\[(html|plain|markdown|moodle)\]/i.exec(input);
  const label = marker?.[1]?.toLowerCase();
  return marker
    ? {
        content: input.slice(marker[0].length),
        format: label === "moodle" ? "moodle_auto_format" : (label ?? defaultFormat),
      }
    : { content: input, format: defaultFormat };
}
export function giftBody(source: string, format: string, issues: LmsIssue[]): string {
  return html(unescapeGift(source.trim()), format, issues);
}
export function giftAnswer(decoded: string, format: string, issues: LmsIssue[]): string {
  const field = readGiftFormat(decoded, format);
  return html(field.content, field.format, issues);
}

/** Inline choices require phrasing content; retain paragraph boundaries as line breaks. */
export function giftInlineAnswer(decoded: string, format: string, issues: LmsIssue[]): string {
  const normalized = giftAnswer(decoded, format, issues);
  const document = parseXml(`<div>${normalized}</div>`, "GIFT inline answer");
  const root = document.documentElement;
  const pending = [root];
  for (let index = 0; index < pending.length; index++) {
    const node = pending[index];
    if (!node) continue;
    for (const child of childElements(node)) {
      const name = localName(child);
      if (name === "p" || name === "div") {
        const span = document.createElement("span");
        for (let attribute = 0; attribute < child.attributes.length; attribute++) {
          const value = child.attributes.item(attribute);
          if (value) span.setAttribute(value.name, value.value);
        }
        while (child.firstChild) span.appendChild(child.firstChild);
        node.replaceChild(span, child);
        if (span.nextSibling) node.insertBefore(document.createElement("br"), span.nextSibling);
        pending.push(span);
      } else {
        if (["ul", "ol", "li", "table", "pre", "blockquote", "h1", "h2", "h3"].includes(name))
          issues.push({
            code: "LMS_CONTENT_INVALID",
            message: `Block content ${name} cannot be represented inside a GIFT dropdown option.`,
          });
        pending.push(child);
      }
    }
  }
  return serializeChildren(root);
}
