// Threat model: serialized responses always pass through the allowlist sanitizer.
// Live editor DOM is rewritten when disallowed structure or attributes are detected,
// and on paste/blur. Typing uses engine-native markup until blur unless unsafe content appears.
const richTextElementNames = new Set(["p", "br", "strong", "em", "u", "ul", "ol", "li"]);
const richTextElementAliases: Record<string, string> = {
  b: "strong",
  div: "p",
  i: "em",
};
const richTextDroppedElementNames = new Set(["script", "style"]);

function richTextAllowedLocalName(localName: string): boolean {
  return (
    !richTextDroppedElementNames.has(localName) &&
    (richTextElementNames.has(localName) || localName in richTextElementAliases)
  );
}

function richTextOutputName(element: Element): string | undefined {
  const localName = element.localName.toLowerCase();
  return (
    richTextElementAliases[localName] ??
    (richTextElementNames.has(localName) ? localName : undefined)
  );
}

function sanitizedRichTextNode(
  node: Node,
  documentRef: Document,
): Node | DocumentFragment | undefined {
  if (node.nodeType === Node.TEXT_NODE) {
    return documentRef.createTextNode(node.textContent ?? "");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return undefined;

  if (!(node instanceof Element)) return undefined;
  const element = node;
  const localName = element.localName.toLowerCase();
  if (richTextDroppedElementNames.has(localName)) return undefined;

  const outputName = richTextOutputName(element);
  const output =
    outputName === undefined
      ? documentRef.createDocumentFragment()
      : documentRef.createElement(outputName);

  if (outputName === "br") return output;

  for (const child of Array.from(element.childNodes)) {
    const sanitized = sanitizedRichTextNode(child, documentRef);
    if (sanitized) output.append(sanitized);
  }
  return output;
}

function escapeRichTextText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function serializeRichTextNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeRichTextText(node.textContent ?? "");
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  if (!(node instanceof Element)) return "";
  const element = node;
  const name = element.localName.toLowerCase();
  if (name === "br") return "<br/>";

  const children = Array.from(element.childNodes).map(serializeRichTextNode).join("");
  return `<${name}>${children}</${name}>`;
}

export function sanitizeRichTextXhtml(value: string, documentRef: Document = document): string {
  const template = documentRef.createElement("template");
  template.innerHTML = value;
  const fragment = documentRef.createDocumentFragment();
  for (const child of Array.from(template.content.childNodes)) {
    const sanitized = sanitizedRichTextNode(child, documentRef);
    if (sanitized) fragment.append(sanitized);
  }
  return Array.from(fragment.childNodes).map(serializeRichTextNode).join("");
}

export function richTextLiveDomNeedsNormalization(editor: HTMLElement): boolean {
  for (const element of editor.querySelectorAll("*")) {
    const localName = element.localName.toLowerCase();
    if (!richTextAllowedLocalName(localName)) return true;
    if (element.attributes.length > 0) return true;
  }
  return false;
}
