import { StaxXmlParserSync, XmlEventType } from "stax-xml";

export interface XmlNode {
  name: string;
  localName: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  text: string;
  source: XmlSourceLocation;
  parent?: XmlNode;
}

export interface XmlSourceLocation {
  line: number;
  column: number;
  offset: number;
  path: string;
}

export function parseXmlTree(xml: string): { root: XmlNode | undefined; errors: Error[] } {
  const parser = new StaxXmlParserSync(xml, {
    autoDecodeEntities: true,
  });
  const stack: XmlNode[] = [];
  const errors: Error[] = [];
  let root: XmlNode | undefined;
  let searchOffset = 0;

  for (const event of parser) {
    if (event.type === XmlEventType.ERROR) {
      errors.push(event.error);
      continue;
    }

    if (event.type === XmlEventType.START_ELEMENT) {
      const parent = stack.at(-1);
      const offset = findStartElementOffset(xml, event.name, searchOffset);
      searchOffset = offset >= 0 ? offset + 1 : searchOffset;
      const node: XmlNode = {
        name: event.name,
        localName: event.localName ?? event.name,
        attributes: event.attributes,
        children: [],
        text: "",
        source: sourceLocation(xml, offset, nodePath(parent, event.localName ?? event.name)),
      };

      if (parent) {
        node.parent = parent;
        parent.children.push(node);
      } else {
        root = node;
      }
      stack.push(node);
      continue;
    }

    if (event.type === XmlEventType.END_ELEMENT) {
      stack.pop();
      continue;
    }

    if (event.type === XmlEventType.CHARACTERS || event.type === XmlEventType.CDATA) {
      const node = stack.at(-1);
      if (node) node.text += event.value;
    }
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
  const parts = [node.text];
  for (const child of node.children) parts.push(textContent(child));
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
      (afterName >= xml.length || /[\s/>]/.test(xml.charAt(afterName)))
    ) {
      return start;
    }
    offset = start + 1;
  }
  return -1;
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
