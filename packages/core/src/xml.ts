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
  /** String offset of `<` for this element's start tag in the source XML string. */
  startOffset: number;
  /** String offset of `>` closing the start tag (or `/>` for self-closing tags). */
  startTagEndOffset: number;
  /** String offset one past the element's closing `>` (or self-closing `/>`). */
  endOffset?: number | undefined;
}

export function parseXmlTree(xml: string): { root: XmlNode | undefined; errors: Error[] } {
  const parser = new StaxXmlParserSync(xml, {
    autoDecodeEntities: true,
  });
  const tagTokens = scanXmlTagTokens(xml);
  const stack: XmlNode[] = [];
  const errors: Error[] = [];
  let root: XmlNode | undefined;
  let tagTokenIndex = 0;

  try {
    for (const event of parser) {
      if (event.type === XmlEventType.ERROR) {
        errors.push(event.error);
        continue;
      }

      if (event.type === XmlEventType.START_ELEMENT) {
        const parent = stack.at(-1);
        const path = nodePath(parent, event.localName ?? event.name);
        const sourceRange: XmlSourceRange = { startOffset: -1, startTagEndOffset: -1 };
        const token = tagTokens[tagTokenIndex];
        if (token?.kind === "start" && token.name === event.name) {
          tagTokenIndex += 1;
          sourceRange.startOffset = token.startOffset;
          sourceRange.startTagEndOffset = token.startTagEndOffset;
          if (token.endOffset !== undefined) {
            sourceRange.endOffset = token.endOffset;
          }
        } else {
          errors.push(new Error(`XML source range alignment failed for <${event.name}>.`));
        }
        const node: XmlNode = {
          name: event.name,
          localName: event.localName ?? event.name,
          prefix: event.prefix,
          uri: event.uri,
          attributes: event.attributes,
          children: [],
          content: [],
          text: "",
          source: sourceLocation(xml, sourceRange.startOffset, path),
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
            const token = tagTokens[tagTokenIndex];
            if (token?.kind === "end" && token.name === event.name) {
              tagTokenIndex += 1;
              node.sourceRange.endOffset = token.endOffset;
              node.endSource = sourceLocation(xml, token.startOffset, node.source.path);
            } else {
              errors.push(new Error(`XML source range alignment failed for </${event.name}>.`));
            }
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

interface XmlTagToken {
  kind: "start" | "end";
  name: string;
  startOffset: number;
  startTagEndOffset: number;
  endOffset?: number | undefined;
  selfClosing: boolean;
}

function scanXmlTagTokens(xml: string): XmlTagToken[] {
  const tokens: XmlTagToken[] = [];
  let offset = 0;

  while (offset < xml.length) {
    const startOffset = xml.indexOf("<", offset);
    if (startOffset === -1 || startOffset + 1 >= xml.length) return tokens;

    if (xml.startsWith("<!--", startOffset)) {
      offset = skipPastSequence(xml, "-->", startOffset + 4);
      continue;
    }

    if (xml.startsWith("<![CDATA[", startOffset)) {
      offset = skipPastSequence(xml, "]]>", startOffset + 9);
      continue;
    }

    const next = xml.charAt(startOffset + 1);
    if (next === "?") {
      offset = skipPastSequence(xml, "?>", startOffset + 2);
      continue;
    }

    if (next === "!") {
      const declarationEndOffset = findMarkupDeclarationEndOffset(xml, startOffset + 2);
      offset = declarationEndOffset >= 0 ? declarationEndOffset + 1 : xml.length;
      continue;
    }

    if (next === "/") {
      const tagEndOffset = findTagEndOffset(xml, startOffset + 2);
      if (tagEndOffset < 0) return tokens;
      const name = readTagName(xml, startOffset + 2, tagEndOffset);
      if (name) {
        tokens.push({
          kind: "end",
          name,
          startOffset,
          startTagEndOffset: tagEndOffset,
          endOffset: tagEndOffset + 1,
          selfClosing: false,
        });
      }
      offset = tagEndOffset + 1;
      continue;
    }

    const tagEndOffset = findTagEndOffset(xml, startOffset + 1);
    if (tagEndOffset < 0) return tokens;
    const name = readTagName(xml, startOffset + 1, tagEndOffset);
    if (name) {
      const selfClosing = isSelfClosingStartTag(xml, tagEndOffset);
      tokens.push({
        kind: "start",
        name,
        startOffset,
        startTagEndOffset: tagEndOffset,
        endOffset: selfClosing ? tagEndOffset + 1 : undefined,
        selfClosing,
      });
    }
    offset = tagEndOffset + 1;
  }

  return tokens;
}

function skipPastSequence(xml: string, sequence: string, from: number): number {
  const endOffset = xml.indexOf(sequence, from);
  return endOffset >= 0 ? endOffset + sequence.length : xml.length;
}

function findMarkupDeclarationEndOffset(xml: string, from: number): number {
  let quote: string | null = null;
  let internalSubsetDepth = 0;
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
    if (char === "[") {
      internalSubsetDepth += 1;
      continue;
    }
    if (char === "]" && internalSubsetDepth > 0) {
      internalSubsetDepth -= 1;
      continue;
    }
    if (char === ">" && internalSubsetDepth === 0) return index;
  }
  return -1;
}

function readTagName(xml: string, from: number, to: number): string {
  let start = from;
  while (start < to && /\s/.test(xml.charAt(start))) start += 1;
  let end = start;
  while (end < to) {
    const char = xml.charAt(end);
    if (/\s/.test(char) || char === "/" || char === ">") break;
    end += 1;
  }
  return xml.slice(start, end);
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
