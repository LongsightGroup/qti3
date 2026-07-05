import { unzipSync } from "fflate";
import { decodeUtf8 } from "@longsightgroup/qti3-core";
import { diagnostic } from "./diagnostics.js";
import type {
  QtiMigrationDetectionResult,
  QtiMigrationDiagnostic,
  QtiMigrationSourceInput,
} from "./types.js";
import { attr, findAllDescendantsByLocalName, localName, parseXml, textOf } from "./xml.js";

export interface MigrationEntry {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly text?: string | undefined;
}

export interface MigrationSource {
  readonly filename?: string | undefined;
  readonly isPackage: boolean;
  readonly entries: readonly MigrationEntry[];
  readonly xml?: string | undefined;
}

export function readMigrationSource(input: QtiMigrationSourceInput): MigrationSource {
  if (input.xml !== undefined) {
    return { filename: input.filename, isPackage: false, entries: [], xml: input.xml };
  }
  if (!input.bytes) {
    throw new Error("QTI migration input must include xml or bytes.");
  }
  if (isZip(input.bytes)) {
    const unzipped = unzipSync(input.bytes);
    const entries = Object.entries(unzipped)
      .filter(([path]) => !path.endsWith("/"))
      .map(([path, bytes]) => ({
        path: path.replaceAll("\\", "/"),
        bytes,
        text: isTextPath(path) ? decodeUtf8(bytes) : undefined,
      }));
    return { filename: input.filename, isPackage: true, entries };
  }
  return {
    filename: input.filename,
    isPackage: false,
    entries: [],
    xml: decodeUtf8(input.bytes),
  };
}

export function detectQtiMigrationSource(
  input: QtiMigrationSourceInput,
): QtiMigrationDetectionResult {
  try {
    const source = readMigrationSource(input);
    return detectMigrationSource(source);
  } catch (error) {
    return {
      supported: false,
      confidence: 0,
      reason: error instanceof Error ? error.message : "source-read-failed",
      isPackage: false,
    };
  }
}

export function detectMigrationSource(source: MigrationSource): QtiMigrationDetectionResult {
  if (source.isPackage) {
    const manifest = source.entries.find((entry) => entry.path.toLowerCase() === "imsmanifest.xml");
    if (!manifest?.text) {
      return {
        supported: false,
        confidence: 0.2,
        reason: "package-manifest-missing",
        isPackage: true,
      };
    }
    return detectManifest(manifest.text);
  }
  if (!source.xml) {
    return { supported: false, confidence: 0, reason: "xml-missing", isPackage: false };
  }
  return detectItemXml(source.xml);
}

export interface LegacyManifest {
  readonly title: string;
  readonly resources: readonly LegacyManifestResource[];
  readonly itemHrefs: readonly string[];
  readonly testHrefs: readonly string[];
  readonly diagnostics: readonly QtiMigrationDiagnostic[];
}

export interface LegacyManifestResource {
  readonly identifier: string;
  readonly type: string;
  readonly href?: string | undefined;
  readonly files: readonly string[];
}

export function parseLegacyManifest(xml: string): LegacyManifest {
  const diagnostics: QtiMigrationDiagnostic[] = [];
  const doc = parseXml(xml, "imsmanifest.xml");
  const root = doc.documentElement;
  const title =
    textOf(findAllDescendantsByLocalName(root, "title")[0]) ||
    attr(root, "identifier") ||
    "Imported QTI Package";
  const resourceNodes = findAllDescendantsByLocalName(root, "resource");
  const resources = resourceNodes.map((resource, index) => {
    const files = findAllDescendantsByLocalName(resource, "file")
      .map((file) => attr(file, "href"))
      .filter((href): href is string => Boolean(href));
    return {
      identifier: attr(resource, "identifier") ?? `RESOURCE_${index + 1}`,
      type: attr(resource, "type") ?? "",
      href: attr(resource, "href") ?? files.find((file) => file.toLowerCase().endsWith(".xml")),
      files,
    };
  });
  const itemHrefs = resources
    .filter((resource) => isLegacyItemResource(resource.type))
    .map((resource) => resource.href)
    .filter((href): href is string => Boolean(href));
  const testHrefs = resources
    .filter((resource) => isLegacyTestResource(resource.type))
    .map((resource) => resource.href)
    .filter((href): href is string => Boolean(href));
  if (!itemHrefs.length && !testHrefs.length) {
    diagnostics.push(
      diagnostic(
        "manifest_items_missing",
        "error",
        "Manifest does not contain supported QTI 1.2 or QTI 2.x item/test resources.",
        { path: "imsmanifest.xml" },
      ),
    );
  }
  return { title, resources, itemHrefs, testHrefs, diagnostics };
}

function detectManifest(xml: string): QtiMigrationDetectionResult {
  const manifest = parseLegacyManifest(xml);
  const typeText = manifest.resources.map((resource) => resource.type.toLowerCase()).join(" ");
  if (typeText.includes("v2p2")) {
    return {
      supported: true,
      sourceFormat: "qti22",
      confidence: 0.9,
      reason: "manifest-qti22",
      isPackage: true,
    };
  }
  if (typeText.includes("v2p1") || typeText.includes("imsqti_item_xmlv2")) {
    return {
      supported: true,
      sourceFormat: "qti21",
      confidence: 0.85,
      reason: "manifest-qti2x",
      isPackage: true,
    };
  }
  if (typeText.includes("qti_xmlv1p2") || typeText.includes("imsqti_xmlv1p2")) {
    return {
      supported: true,
      sourceFormat: "qti12",
      confidence: 0.85,
      reason: "manifest-qti12",
      isPackage: true,
    };
  }
  return {
    supported: manifest.itemHrefs.length > 0,
    sourceFormat: manifest.itemHrefs.length > 0 ? "qti21" : undefined,
    confidence: manifest.itemHrefs.length > 0 ? 0.45 : 0.1,
    reason:
      manifest.itemHrefs.length > 0 ? "manifest-legacy-item-resource" : "manifest-unsupported",
    isPackage: true,
  };
}

function detectItemXml(xml: string): QtiMigrationDetectionResult {
  const doc = parseXml(xml, "item");
  const root = doc.documentElement;
  const rootName = localName(root);
  const serializedRoot = root.nodeName.toLowerCase();
  const namespaceText = [
    attr(root, "xmlns"),
    attr(root, "xmlns:qti"),
    attr(root, "xsi:schemaLocation"),
    attr(root, "schemaLocation"),
    serializedRoot,
  ]
    .join(" ")
    .toLowerCase();
  if (rootName === "assessmentitem") {
    if (namespaceText.includes("v2p2")) {
      return {
        supported: true,
        sourceFormat: "qti22",
        confidence: 0.9,
        reason: "assessmentitem-qti22",
        isPackage: false,
      };
    }
    return {
      supported: true,
      sourceFormat: "qti21",
      confidence: 0.85,
      reason: "assessmentitem-qti2x",
      isPackage: false,
    };
  }
  if (rootName === "questestinterop" || rootName === "item") {
    return {
      supported: true,
      sourceFormat: "qti12",
      confidence: 0.75,
      reason: "qti12-root",
      isPackage: false,
    };
  }
  return {
    supported: false,
    confidence: 0,
    reason: `unsupported-root-${rootName}`,
    isPackage: false,
  };
}

function isLegacyItemResource(type: string): boolean {
  const value = type.toLowerCase();
  return (
    value.includes("imsqti_item_xmlv2") ||
    value.includes("imsqti_item_xmlv1p2") ||
    value.includes("imsqti_xmlv1p2") ||
    value.includes("qti_xmlv1p2")
  );
}

function isLegacyTestResource(type: string): boolean {
  const value = type.toLowerCase();
  return value.includes("imsqti_test_xmlv2");
}

function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function isTextPath(path: string): boolean {
  return /\.(xml|html?|txt|json|css|js)$/i.test(path);
}
