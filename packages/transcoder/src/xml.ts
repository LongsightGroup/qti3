import { DOMParser } from "@xmldom/xmldom";

import { validateMoodleXmlDocument } from "./moodle-validation.js";
import type { QtiTranscodeDiagnostic, QtiTranscodeTarget } from "./types.js";

const parser = new DOMParser({
  errorHandler: {
    warning: () => undefined,
    error: () => undefined,
    fatalError: () => undefined,
  },
});

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function safePackagePath(path: string): boolean {
  if (!path || path.startsWith("/") || path.includes("\\")) return false;
  return path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

/** Dependency-free target sanity checks used at runtime; full XSD checks remain in CI. */
export function validateGeneratedTargetXml(
  xml: string,
  target: QtiTranscodeTarget,
): readonly QtiTranscodeDiagnostic[] {
  const document = parser.parseFromString(xml, "application/xml");
  const root = document.documentElement;
  if (localName(root) === "parsererror") {
    return [
      {
        code: "target.xml.malformed",
        severity: "error",
        message: "Generated target XML is not well formed.",
      },
    ];
  }

  if (target === "moodle-xml") {
    return validateMoodleXmlDocument(root);
  }

  if (target === "qti12") {
    return localName(root) === "questestinterop" &&
      root.namespaceURI === "http://www.imsglobal.org/xsd/ims_qtiasiv1p2" &&
      hasDescendant(root, "item") &&
      hasDescendant(root, "presentation")
      ? []
      : [
          {
            code: "target.qti12.semantic",
            severity: "error",
            message:
              "Generated QTI 1.2 XML lacks the required namespace, item, or presentation structure.",
          },
        ];
  }

  const expectedNamespace =
    target === "qti21"
      ? "http://www.imsglobal.org/xsd/imsqti_v2p1"
      : "http://www.imsglobal.org/xsd/imsqti_v2p2";
  return localName(root) === "assessmentItem" &&
    root.namespaceURI === expectedNamespace &&
    hasDescendant(root, "itemBody")
    ? []
    : [
        {
          code: `target.${target}.semantic`,
          severity: "error",
          message:
            "Generated QTI 2.x XML lacks the required namespace, assessment item, or item body.",
        },
      ];
}

function localName(node: Node): string {
  return node.nodeName.replace(/^.*:/, "");
}

function hasDescendant(node: Node, name: string): boolean {
  for (let index = 0; index < node.childNodes.length; index += 1) {
    const child = node.childNodes.item(index);
    if (child.nodeType !== 1) continue;
    if (localName(child) === name || hasDescendant(child, name)) return true;
  }
  return false;
}
