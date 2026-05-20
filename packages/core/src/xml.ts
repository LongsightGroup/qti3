import { StaxXmlParserSync, XmlEventType } from "stax-xml";

export interface XmlNode {
  name: string;
  localName: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  text: string;
  parent?: XmlNode;
}

export function parseXmlTree(xml: string): { root: XmlNode | undefined; errors: Error[] } {
  const parser = new StaxXmlParserSync(xml, {
    autoDecodeEntities: true,
  });
  const stack: XmlNode[] = [];
  const errors: Error[] = [];
  let root: XmlNode | undefined;

  for (const event of parser) {
    if (event.type === XmlEventType.ERROR) {
      errors.push(event.error);
      continue;
    }

    if (event.type === XmlEventType.START_ELEMENT) {
      const node: XmlNode = {
        name: event.name,
        localName: event.localName ?? event.name,
        attributes: event.attributes,
        children: [],
        text: "",
      };

      const parent = stack.at(-1);
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
