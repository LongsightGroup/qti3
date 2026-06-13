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

interface ParserState {
  xml: string;
  lineStarts: number[];
  errors: Error[];
  root: XmlNode | undefined;
  stack: XmlNode[];
  namespaceStack: NamespaceFrame[];
}

interface ParsedAttribute {
  name: string;
  value: string;
}

interface NamespaceFrame {
  namespaces: Record<string, string>;
}

/**
 * Minimal XML parser for QTI item/package XML.
 *
 * The parser intentionally does not process DTD entity declarations, resolve external entities,
 * read from the network/filesystem, or expand custom entities. That keeps QTI parsing structurally
 * immune to XXE and billion-laughs style expansion: numeric references decode to at most one code
 * point, predefined entities decode once, and every other entity reference remains verbatim.
 */
export function parseXmlTree(xml: string): { root: XmlNode | undefined; errors: Error[] } {
  if (xml.charCodeAt(0) === 0xfeff) xml = xml.slice(1);

  const state: ParserState = {
    xml,
    lineStarts: buildLineStarts(xml),
    errors: [],
    root: undefined,
    stack: [],
    namespaceStack: [],
  };
  let offset = 0;

  while (offset < xml.length) {
    const markupOffset = xml.indexOf("<", offset);
    if (markupOffset < 0) {
      appendText(xml.slice(offset), state);
      break;
    }

    if (markupOffset > offset) {
      appendText(xml.slice(offset, markupOffset), state);
    }

    if (markupOffset + 1 >= xml.length) {
      state.errors.push(new Error("Malformed XML tag at end of document."));
      break;
    }

    if (xml.startsWith("<!--", markupOffset)) {
      const endOffset = xml.indexOf("-->", markupOffset + 4);
      if (endOffset < 0) {
        state.errors.push(new Error("Unterminated XML comment."));
        break;
      }
      offset = endOffset + 3;
      continue;
    }

    if (xml.startsWith("<![CDATA[", markupOffset)) {
      const endOffset = xml.indexOf("]]>", markupOffset + 9);
      if (endOffset < 0) {
        state.errors.push(new Error("Unterminated CDATA section."));
        break;
      }
      appendCharacterData(xml.slice(markupOffset + 9, endOffset), state);
      offset = endOffset + 3;
      continue;
    }

    const next = xml.charAt(markupOffset + 1);
    if (next === "?") {
      const endOffset = xml.indexOf("?>", markupOffset + 2);
      if (endOffset < 0) {
        state.errors.push(new Error("Unterminated XML processing instruction."));
        break;
      }
      offset = endOffset + 2;
      continue;
    }

    if (next === "!") {
      const endOffset = findMarkupDeclarationEndOffset(xml, markupOffset + 2);
      if (endOffset < 0) {
        state.errors.push(new Error("Unterminated XML markup declaration."));
        break;
      }
      offset = endOffset + 1;
      continue;
    }

    if (next === "/") {
      const endOffset = findTagEndOffset(xml, markupOffset + 2);
      if (endOffset < 0) {
        state.errors.push(new Error("Unterminated XML closing tag."));
        break;
      }
      const name = readTagName(xml, markupOffset + 2, endOffset);
      if (!name) {
        state.errors.push(new Error("Malformed XML closing tag."));
      } else {
        closeElement(name, markupOffset, endOffset, state);
      }
      offset = endOffset + 1;
      continue;
    }

    const endOffset = findTagEndOffset(xml, markupOffset + 1);
    if (endOffset < 0) {
      state.errors.push(new Error("Unterminated XML start tag."));
      break;
    }
    const name = readTagName(xml, markupOffset + 1, endOffset);
    if (!name) {
      state.errors.push(new Error("Malformed XML start tag."));
      offset = endOffset + 1;
      continue;
    }

    const selfClosing = isSelfClosingStartTag(xml, endOffset);
    const attributes = parseAttributes(
      xml,
      markupOffset + 1 + name.length,
      selfClosing ? trailingSlashOffset(xml, endOffset) : endOffset,
      state,
    );
    openElement(name, attributes, markupOffset, endOffset, selfClosing, state);
    offset = endOffset + 1;
  }

  for (const node of [...state.stack].reverse()) {
    state.errors.push(
      new Error(`Unexpected end of document. Missing closing tag for <${node.name}>.`),
    );
  }

  if (!state.root) state.errors.push(new Error("XML document does not contain a root element."));

  return { root: state.root, errors: state.errors };
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

function openElement(
  name: string,
  parsedAttributes: ParsedAttribute[],
  startOffset: number,
  startTagEndOffset: number,
  selfClosing: boolean,
  state: ParserState,
): void {
  const parent = state.stack.at(-1);
  if (!parent && state.root) {
    state.errors.push(new Error(`XML document contains multiple root elements; found <${name}>.`));
  }

  const attributes: Record<string, string> = {};
  const inheritedNamespaces = state.namespaceStack.at(-1)?.namespaces ?? {};
  const namespaces: Record<string, string> = { ...inheritedNamespaces };
  for (const attribute of parsedAttributes) {
    attributes[attribute.name] = attribute.value;
    if (attribute.name === "xmlns") namespaces[""] = attribute.value;
    else if (attribute.name.startsWith("xmlns:"))
      namespaces[attribute.name.slice(6)] = attribute.value;
  }

  const { prefix, localName } = splitQualifiedName(name);
  const path = nodePath(parent, localName);
  const sourceRange: XmlSourceRange = {
    startOffset,
    startTagEndOffset,
    endOffset: selfClosing ? startTagEndOffset + 1 : undefined,
  };
  const node: XmlNode = {
    name,
    localName,
    prefix,
    uri: namespaces[prefix ?? ""],
    attributes,
    children: [],
    content: [],
    text: "",
    source: sourceLocation(state, startOffset, path),
    sourceRange,
  };

  if (parent) {
    node.parent = parent;
    parent.children.push(node);
    parent.content.push(node);
  } else if (!state.root) {
    state.root = node;
  }

  if (!selfClosing) {
    state.stack.push(node);
    state.namespaceStack.push({ namespaces });
  }
}

function closeElement(
  name: string,
  startOffset: number,
  tagEndOffset: number,
  state: ParserState,
): void {
  const top = state.stack.at(-1);
  if (!top) {
    state.errors.push(new Error(`Unexpected closing tag </${name}>.`));
    return;
  }

  let matchIndex = -1;
  for (let index = state.stack.length - 1; index >= 0; index -= 1) {
    if (state.stack[index]?.name === name) {
      matchIndex = index;
      break;
    }
  }

  if (matchIndex < 0) {
    state.errors.push(new Error(`Unexpected closing tag </${name}>; expected </${top.name}>.`));
    return;
  }

  if (matchIndex !== state.stack.length - 1) {
    state.errors.push(new Error(`Mismatched closing tag </${name}>; expected </${top.name}>.`));
    while (state.stack.length - 1 > matchIndex) {
      const unclosed = state.stack.pop();
      state.namespaceStack.pop();
      if (unclosed) {
        state.errors.push(
          new Error(`Implicitly closed <${unclosed.name}> due to mismatched tag </${name}>.`),
        );
      }
    }
  }

  const node = state.stack.pop();
  state.namespaceStack.pop();
  if (!node) return;
  node.sourceRange.endOffset = tagEndOffset + 1;
  node.endSource = sourceLocation(state, startOffset, node.source.path);
}

function appendText(raw: string, state: ParserState): void {
  appendCharacterData(decodeXmlCharacterData(raw, state), state);
}

function appendCharacterData(text: string, state: ParserState): void {
  if (text.length === 0) return;
  const parent = state.stack.at(-1);
  if (parent) {
    parent.text += text;
    parent.content.push(text);
    return;
  }
  if (text.trim().length === 0) return;
  if (state.root)
    state.errors.push(new Error("XML document contains content after the root element."));
  else state.errors.push(new Error("XML document contains content before the root element."));
}

function parseAttributes(
  xml: string,
  from: number,
  to: number,
  state: ParserState,
): ParsedAttribute[] {
  const attributes: ParsedAttribute[] = [];
  let offset = from;

  while (offset < to) {
    while (offset < to && /\s/.test(xml.charAt(offset))) offset += 1;
    if (offset >= to) break;

    const nameStart = offset;
    while (offset < to) {
      const char = xml.charAt(offset);
      if (/\s/.test(char) || char === "=" || char === "/" || char === ">") break;
      offset += 1;
    }

    const name = xml.slice(nameStart, offset);
    if (!name) {
      state.errors.push(new Error("Malformed XML attribute."));
      offset += 1;
      continue;
    }

    while (offset < to && /\s/.test(xml.charAt(offset))) offset += 1;
    if (xml.charAt(offset) !== "=") {
      state.errors.push(new Error(`Malformed XML attribute ${name}; expected =.`));
      while (offset < to && !/\s/.test(xml.charAt(offset))) offset += 1;
      continue;
    }
    offset += 1;
    while (offset < to && /\s/.test(xml.charAt(offset))) offset += 1;

    const quote = xml.charAt(offset);
    if (quote !== '"' && quote !== "'") {
      state.errors.push(new Error(`Malformed XML attribute ${name}; expected quoted value.`));
      while (offset < to && !/\s/.test(xml.charAt(offset))) offset += 1;
      continue;
    }
    offset += 1;

    const valueStart = offset;
    const valueEnd = xml.indexOf(quote, valueStart);
    if (valueEnd < 0 || valueEnd > to) {
      state.errors.push(new Error(`Unterminated XML attribute ${name}.`));
      break;
    }

    attributes.push({
      name,
      value: decodeXmlCharacterData(xml.slice(valueStart, valueEnd), state),
    });
    offset = valueEnd + 1;
  }

  return attributes;
}

const predefinedXmlEntities: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  quot: '"',
};

function decodeXmlCharacterData(value: string, state: ParserState): string {
  return value.replace(
    /&(#x[0-9a-fA-F]+|#X[0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9._:-]*);/g,
    (entity, body: string) => {
      if (body.startsWith("#x") || body.startsWith("#X")) {
        return decodeNumericEntity(entity, Number.parseInt(body.slice(2), 16), state);
      }
      if (body.startsWith("#")) {
        return decodeNumericEntity(entity, Number.parseInt(body.slice(1), 10), state);
      }
      return predefinedXmlEntities[body] ?? entity;
    },
  );
}

function decodeNumericEntity(entity: string, codePoint: number, state: ParserState): string {
  if (!Number.isFinite(codePoint) || !isXmlChar(codePoint)) {
    state.errors.push(new Error(`Invalid XML character reference ${entity}.`));
    return entity;
  }
  return String.fromCodePoint(codePoint);
}

function isXmlChar(codePoint: number): boolean {
  return (
    codePoint === 0x9 ||
    codePoint === 0xa ||
    codePoint === 0xd ||
    (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
    (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
    (codePoint >= 0x10000 && codePoint <= 0x10ffff)
  );
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
  return xml.charAt(trailingSlashOffset(xml, tagEndOffset)) === "/";
}

function trailingSlashOffset(xml: string, tagEndOffset: number): number {
  for (let index = tagEndOffset - 1; index >= 0; index -= 1) {
    if (/\s/.test(xml.charAt(index))) continue;
    return index;
  }
  return tagEndOffset;
}

function splitQualifiedName(name: string): {
  prefix: string | undefined;
  localName: string;
} {
  const separator = name.indexOf(":");
  if (separator < 0) return { prefix: undefined, localName: name };
  return {
    prefix: name.slice(0, separator),
    localName: name.slice(separator + 1),
  };
}

function buildLineStarts(xml: string): number[] {
  const lineStarts = [0];
  for (let index = 0; index < xml.length; index += 1) {
    if (xml.charAt(index) === "\n") lineStarts.push(index + 1);
  }
  return lineStarts;
}

function sourceLocation(state: ParserState, offset: number, path: string): XmlSourceLocation {
  const normalizedOffset = Math.max(0, offset);
  let low = 0;
  let high = state.lineStarts.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const lineStart = state.lineStarts[middle] ?? 0;
    if (lineStart <= normalizedOffset) low = middle + 1;
    else high = middle - 1;
  }
  const lineIndex = Math.max(0, high);
  const lineStart = state.lineStarts[lineIndex] ?? 0;
  return {
    line: lineIndex + 1,
    column: normalizedOffset - lineStart + 1,
    offset: normalizedOffset,
    path,
  };
}

function nodePath(parent: XmlNode | undefined, localName: string): string {
  if (!parent) return `/${localName}`;
  const index = parent.children.filter((child) => child.localName === localName).length + 1;
  return `${parent.source.path}/${localName}[${index}]`;
}

export function escapeXmlText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function escapeXmlAttribute(value: string): string {
  return escapeXmlText(value).replaceAll('"', "&quot;");
}
