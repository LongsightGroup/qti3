import { parseXmlTree, type XmlNode } from "./xml.js";

export interface QtiPackageXmlNode {
  localName: string;
  uri?: string | undefined;
  attributes: Record<string, string>;
  children: QtiPackageXmlNode[];
  text: string;
}

export interface QtiPackageXmlTree {
  root: QtiPackageXmlNode | undefined;
  errors: string[];
}

export function parseQtiPackageXmlTree(xml: string): QtiPackageXmlTree {
  const parsed = parseXmlTree(xml);
  return {
    root: parsed.root ? packageXmlNode(parsed.root) : undefined,
    errors: parsed.errors.map((error) => error.message),
  };
}

function packageXmlNode(node: XmlNode): QtiPackageXmlNode {
  return {
    localName: node.localName,
    uri: node.uri,
    attributes: node.attributes,
    children: node.children.map(packageXmlNode),
    text: node.text,
  };
}
