import { StaxXmlParserSync, XmlEventType } from "stax-xml";

export interface XmlNode {
  name: string;
  localName: string;
  prefix?: string | undefined;
  uri?: string | undefined;
  attributes: Record<string, string>;
  children: XmlNode[];
  content: Array<string | XmlNode>;
  text: string;
  source: XmlSourceLocation;
  endSource?: XmlSourceLocation | undefined;
  sourceRange: XmlSourceRange;
  parent?: XmlNode;
}

export interface XmlSourceLocation {
  line: number;
  column: number;
  offset: number;
  path: string;
}

export interface XmlSourceRange {
  /** Byte offset of `<` for this element's start tag in the source XML string. */
  startOffset: number;
  /** Byte offset of `>` closing the start tag (or `/>` for self-closing tags). */
  startTagEndOffset: number;
  /** Byte offset one past the element's closing `>` (or self-closing `/>`). */
  endOffset?: number | undefined;
}

export function parseXmlTree(xml: string): { root: XmlNode | undefined; errors: Error[] } {
  const parser = new StaxXmlParserSync(xml, {
    autoDecodeEntities: true,
  });
  const stack: XmlNode[] = [];
  const errors: Error[] = [];
  let root: XmlNode | undefined;
  let searchOffset = 0;
  let endSearchOffset = 0;

  try {
    for (const event of parser) {
      if (event.type === XmlEventType.ERROR) {
        errors.push(event.error);
        continue;
      }

      if (event.type === XmlEventType.START_ELEMENT) {
        const parent = stack.at(-1);
        const offset = findStartElementOffset(xml, event.name, searchOffset);
        const startTagEndOffset = offset >= 0 ? findTagEndOffset(xml, offset + 1) : -1;
        const path = nodePath(parent, event.localName ?? event.name);
        const sourceRange: XmlSourceRange = { startOffset: offset, startTagEndOffset };
        if (startTagEndOffset >= 0 && isSelfClosingStartTag(xml, startTagEndOffset)) {
          sourceRange.endOffset = startTagEndOffset + 1;
        }
        searchOffset = startTagEndOffset >= 0 ? startTagEndOffset + 1 : offset + 1;
        const node: XmlNode = {
          name: event.name,
          localName: event.localName ?? event.name,
          prefix: event.prefix,
          uri: event.uri,
          attributes: event.attributes,
          children: [],
          content: [],
          text: "",
          source: sourceLocation(xml, offset, path),
          sourceRange,
        };

        if (parent) {
          node.parent = parent;
          parent.children.push(node);
          parent.content.push(node);
        } else {
          root = node;
        }
        stack.push(node);
        continue;
      }

      if (event.type === XmlEventType.END_ELEMENT) {
        const node = stack.pop();
        if (node) {
          if (node.sourceRange.endOffset === undefined) {
            const endTagOffset = findEndElementOffset(
              xml,
              event.name,
              Math.max(endSearchOffset, node.sourceRange.startTagEndOffset + 1),
            );
            const endTagEndOffset =
              endTagOffset >= 0 ? findTagEndOffset(xml, endTagOffset + 2) : -1;
            if (endTagOffset >= 0 && endTagEndOffset >= 0) {
              node.sourceRange.endOffset = endTagEndOffset + 1;
              node.endSource = sourceLocation(xml, endTagOffset, node.source.path);
            } else {
              errors.push(new Error(`Missing closing tag for <${node.name}>.`));
            }
          }
          if (node.sourceRange.endOffset !== undefined) {
            endSearchOffset = Math.max(endSearchOffset, node.sourceRange.endOffset);
          }
        }
        continue;
      }

      if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
        const node = stack.at(-1);
        if (node) {
          node.text += event.value;
          node.content.push(event.value);
        }
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error : new Error(String(error)));
  }

  for (const node of [...stack].reverse()) {
    errors.push(new Error(`Unexpected end of document. Missing closing tag for <${node.name}>.`));
  }

  return { root, errors };
}

export function childElements(node: XmlNode, localName?: string): XmlNode[] {
  return node.children.filter((child) => !localName || child.localName === localName);
}

export function descendants(node: XmlNode, predicate: (node: XmlNode) => boolean): XmlNode[] {
  const found: XmlNode[] = [];
  for (const child of node.children) {
    if (predicate(child)) found.push(child);
    found.push(...descendants(child, predicate));
  }
  return found;
}

export function textContent(node: XmlNode): string {
  const parts = node.content.map((entry) =>
    typeof entry === "string" ? entry : textContent(entry),
  );
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function findStartElementOffset(xml: string, name: string, from: number): number {
  let offset = from;
  while (offset < xml.length) {
    const start = xml.indexOf("<", offset);
    if (start === -1) return -1;
    const next = xml.charAt(start + 1);
    if (next === "/" || next === "!" || next === "?") {
      offset = start + 1;
      continue;
    }
    const afterName = start + 1 + name.length;
    if (
      xml.slice(start + 1, afterName) === name &&
      (afterName >= xml.length || /[\s/>]/.test(xml.charAt(afterName))) &&
      !isInsideCommentOrCdata(xml, start)
    ) {
      return start;
    }
    offset = start + 1;
  }
  return -1;
}

function findEndElementOffset(xml: string, name: string, from: number): number {
  let offset = from;
  while (offset < xml.length) {
    const start = xml.indexOf("</", offset);
    if (start === -1) return -1;
    if (isInsideCommentOrCdata(xml, start)) {
      offset = start + 2;
      continue;
    }
    const afterName = start + 2 + name.length;
    if (
      xml.slice(start + 2, afterName) === name &&
      (afterName >= xml.length || /[\s>]/.test(xml.charAt(afterName)))
    ) {
      return start;
    }
    offset = start + 2;
  }
  return -1;
}

function isInsideCommentOrCdata(xml: string, offset: number): boolean {
  let inComment = false;
  let inCdata = false;
  for (let index = 0; index < offset && index < xml.length; ) {
    if (!inComment && !inCdata && xml.startsWith("<!--", index)) {
      inComment = true;
      index += 4;
      continue;
    }
    if (inComment && xml.startsWith("-->", index)) {
      inComment = false;
      index += 3;
      continue;
    }
    if (!inComment && !inCdata && xml.startsWith("<![CDATA[", index)) {
      inCdata = true;
      index += 9;
      continue;
    }
    if (inCdata && xml.startsWith("]]>", index)) {
      inCdata = false;
      index += 3;
      continue;
    }
    index += 1;
  }
  return inComment || inCdata;
}

function findTagEndOffset(xml: string, from: number): number {
  let quote: string | null = null;
  for (let index = from; index < xml.length; index += 1) {
    const char = xml.charAt(index);
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === ">") return index;
  }
  return -1;
}

function isSelfClosingStartTag(xml: string, tagEndOffset: number): boolean {
  for (let index = tagEndOffset - 1; index >= 0; index -= 1) {
    const char = xml.charAt(index);
    if (/\s/.test(char)) continue;
    return char === "/";
  }
  return false;
}

function sourceLocation(xml: string, offset: number, path: string): XmlSourceLocation {
  if (offset < 0) return { line: 1, column: 1, offset: 0, path };
  let line = 1;
  let column = 1;
  for (let index = 0; index < offset; index += 1) {
    if (xml.charAt(index) === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column, offset, path };
}

function nodePath(parent: XmlNode | undefined, localName: string): string {
  if (!parent) return `/${localName}`;
  const index = parent.children.filter((child) => child.localName === localName).length + 1;
  return `${parent.source.path}/${localName}[${index}]`;
}
