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

export function buildMigrationEntry(path: string, bytes: Uint8Array): MigrationEntry {
  return {
    path,
    bytes,
    text: isMigrationTextPath(path) ? decodeUtf8(bytes) : undefined,
  };
}

export function migrationEntriesFromFileMap(
  files: Readonly<Record<string, Uint8Array>>,
  normalizePath: (path: string) => string | undefined,
): {
  readonly entries: readonly MigrationEntry[];
  readonly diagnostics: readonly QtiMigrationDiagnostic[];
} {
  const diagnostics: QtiMigrationDiagnostic[] = [];
  const entries: MigrationEntry[] = [];
  const seenPaths = new Set<string>();
  for (const [path, bytes] of Object.entries(files)) {
    const normalizedPath = normalizePath(path);
    if (!normalizedPath) continue;
    if (seenPaths.has(normalizedPath)) {
      diagnostics.push(
        diagnostic(
          "resource_file_duplicate",
          "error",
          `Resource file path ${normalizedPath} is duplicated after normalization.`,
          { path: normalizedPath },
        ),
      );
      continue;
    }
    seenPaths.add(normalizedPath);
    entries.push(buildMigrationEntry(normalizedPath, bytes));
  }
  return { entries, diagnostics };
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
      .map(([path, bytes]) => buildMigrationEntry(path.replaceAll("\\", "/"), bytes));
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

export interface MigratableManifest {
  readonly title: string;
  readonly resources: readonly MigratableManifestResource[];
  readonly diagnostics: readonly QtiMigrationDiagnostic[];
}

export type MigratableManifestResourceKind = "item" | "test" | "qti12-container" | "other";

export interface MigratableManifestResource {
  readonly identifier: string;
  readonly type: string;
  readonly kind: MigratableManifestResourceKind;
  readonly href?: string | undefined;
  readonly files: readonly string[];
}

export function parseMigratableManifest(xml: string): MigratableManifest {
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
    const type = attr(resource, "type") ?? "";
    return {
      identifier: attr(resource, "identifier") ?? `RESOURCE_${index + 1}`,
      type,
      kind: classifyMigratableResource(type),
      href: attr(resource, "href") ?? files.find((file) => file.toLowerCase().endsWith(".xml")),
      files,
    };
  });
  if (!resources.some((resource) => resource.kind !== "other")) {
    diagnostics.push(
      diagnostic(
        "manifest_items_missing",
        "error",
        "Manifest does not contain supported QTI 1.2 or QTI 2.x item/test resources.",
        { path: "imsmanifest.xml" },
      ),
    );
  }
  return { title, resources, diagnostics };
}

function detectManifest(xml: string): QtiMigrationDetectionResult {
  const manifest = parseMigratableManifest(xml);
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
    supported: manifest.resources.some((resource) => resource.kind === "item"),
    sourceFormat: manifest.resources.some((resource) => resource.kind === "item")
      ? "qti21"
      : undefined,
    confidence: manifest.resources.some((resource) => resource.kind === "item") ? 0.45 : 0.1,
    reason: manifest.resources.some((resource) => resource.kind === "item")
      ? "manifest-migratable-item-resource"
      : "manifest-unsupported",
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

function classifyMigratableResource(type: string): MigratableManifestResourceKind {
  const value = type.toLowerCase();
  if (value.includes("imsqti_item_xmlv2") || value.includes("imsqti_item_xmlv1p2")) {
    return "item";
  }
  if (value.includes("imsqti_test_xmlv2")) return "test";
  if (value.includes("imsqti_xmlv1p2") || value.includes("qti_xmlv1p2")) {
    return "qti12-container";
  }
  return "other";
}

function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function isMigrationTextPath(path: string): boolean {
  return /\.(xml|html?|txt|json|css|js)$/i.test(path);
}
