import {
  decodeUtf8,
  parseQtiPackageXmlTree,
  parseQtiXml,
  validateAssessmentItem,
  type QtiDiagnostic,
  type QtiPackageXmlNode,
} from "@longsightgroup/qti3-core";
import { uniqueDiagnostics } from "../diagnostics.js";
import { detectBasicItemFeatures } from "./basic-item-features.js";
import { PackageContentError } from "./package-content-error.js";
import { parseCliPackagePath } from "./package-path.js";
import { readPackageEntries, type PackageEntry } from "./package-reader.js";

interface PackageXmlFile {
  path: string;
  xml: string;
  root: QtiPackageXmlNode | undefined;
  errors: string[];
}

/** Package inspection policy selected by a CLI use case. */
export type PackageInspectionMode = "inspect" | "validate" | "basic-item-player";

/** Structured package inspection result emitted by package-related CLI commands. */
export interface PackageInspectionReport {
  file: string;
  strict: boolean;
  checked: number;
  failed: number;
  packageErrors: string[];
  xmlFiles: string[];
  assetFiles: string[];
  discoveredReferences: string[];
  assessmentTestFiles: string[];
  results: {
    file: string;
    source: "assessment-test" | "manifest" | "direct";
    ok: boolean;
    diagnostics: ReturnType<typeof parseQtiXml>["diagnostics"];
    interactions: string[];
    basicFeatures: string[];
  }[];
}

/** Inspect a package and convert authored package-content failures into a structured report. */
export async function inspectPackageWithContentErrorReport(
  file: string,
  mode: PackageInspectionMode,
): Promise<PackageInspectionReport> {
  try {
    return await inspectPackage(file, mode);
  } catch (cause) {
    if (!(cause instanceof PackageContentError)) throw cause;
    return {
      file,
      strict: mode !== "inspect",
      checked: 0,
      failed: 1,
      packageErrors: [cause.message],
      xmlFiles: [],
      assetFiles: [],
      discoveredReferences: [],
      assessmentTestFiles: [],
      results: [],
    };
  }
}

async function inspectPackage(
  file: string,
  mode: PackageInspectionMode,
): Promise<PackageInspectionReport> {
  const strict = mode !== "inspect";
  const itemOnly = mode === "basic-item-player";
  const entries = await readPackageEntries(file);
  const xmlFiles = entries
    .filter((entry) => entry.name.toLowerCase().endsWith(".xml"))
    .map((entry) => parsePackageXml(entry));
  const byPath = new Map(xmlFiles.map((entry) => [entry.path, entry]));
  const entryNames = new Set(entries.map((entry) => entry.name));
  const itemSources = new Map<string, "assessment-test" | "manifest" | "direct">();
  const discoveredReferences: string[] = [];
  const directItemPaths: string[] = [];
  const assessmentTestFiles: string[] = [];
  const packageErrors = xmlFiles.flatMap((xmlFile) => {
    return xmlFile.errors.map((error) => `${xmlFile.path}: ${error}`);
  });
  const manifestFiles = xmlFiles.filter((xmlFile) => xmlFile.root?.localName === "manifest");

  if (strict) {
    if (!manifestFiles.some((xmlFile) => xmlFile.path === "imsmanifest.xml")) {
      packageErrors.push("strict package validation requires imsmanifest.xml.");
    }
    for (const manifestFile of manifestFiles) {
      for (const ref of manifestFileReferences(manifestFile)) {
        if (!entryNames.has(ref)) {
          packageErrors.push(`manifest file reference ${ref} was not found.`);
        }
      }
    }
  }

  for (const xmlFile of xmlFiles) {
    const rootName = xmlFile.root?.localName;
    if (rootName === "qti-assessment-test") {
      assessmentTestFiles.push(xmlFile.path);
    }
    const refs =
      rootName === "qti-assessment-test" && !itemOnly
        ? assessmentItemRefs(xmlFile)
        : rootName === "manifest"
          ? manifestItemResources(xmlFile)
          : [];
    for (const ref of refs) {
      discoveredReferences.push(ref);
      if (byPath.has(ref) && !itemSources.has(ref)) {
        itemSources.set(ref, rootName === "manifest" ? "manifest" : "assessment-test");
      } else if (!byPath.has(ref)) {
        packageErrors.push(`package reference ${ref} was not found.`);
      }
    }
    if (strict) {
      for (const ref of packageDependencyReferences(xmlFile)) {
        if (!entryNames.has(ref)) {
          packageErrors.push(
            `package dependency ${ref} referenced from ${xmlFile.path} was not found.`,
          );
        }
      }
    }
    if (rootName === "qti-assessment-item") {
      directItemPaths.push(xmlFile.path);
    }
  }

  if (itemOnly && assessmentTestFiles.length > 0) {
    packageErrors.push(
      `assessment-test packages are out of scope for Basic item-player readiness: ${assessmentTestFiles.join(", ")}.`,
    );
  }

  if (strict && discoveredReferences.length === 0) {
    packageErrors.push(
      "strict package validation requires manifest or assessment-test item references.",
    );
  }

  for (const path of directItemPaths) {
    if (itemSources.has(path)) continue;
    if (strict) {
      packageErrors.push(
        `qti-assessment-item ${path} is not referenced by the package manifest or assessment test.`,
      );
      continue;
    }
    itemSources.set(path, "direct");
  }

  const results = [...itemSources.entries()].map(([path, source]) => {
    const xmlFile = byPath.get(path);
    if (!xmlFile) {
      return {
        file: path,
        source,
        ok: false,
        diagnostics: [],
        interactions: [],
        basicFeatures: [],
      };
    }
    const result = parseQtiXml(xmlFile.xml);
    const validation = result.document
      ? validateAssessmentItem(result.document)
      : { diagnostics: [] };
    const diagnostics = uniqueDiagnostics([
      ...result.diagnostics,
      ...validation.diagnostics,
      ...(strict ? packageXmlDiagnostics(xmlFile) : []),
    ]);
    return {
      file: path,
      source,
      ok: result.ok && diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
      diagnostics,
      interactions:
        result.document?.item.interactions.map((interaction) => interaction.qtiName) ?? [],
      basicFeatures: detectBasicItemFeatures(xmlFile.xml, result),
    };
  });

  return {
    file,
    strict,
    checked: results.length,
    failed: results.filter((result) => !result.ok).length + packageErrors.length,
    packageErrors,
    xmlFiles: xmlFiles.map((entry) => entry.path),
    assetFiles: entries
      .filter((entry) => !entry.name.toLowerCase().endsWith(".xml"))
      .map((entry) => entry.name),
    discoveredReferences,
    assessmentTestFiles,
    results,
  };
}

function parsePackageXml(entry: PackageEntry): PackageXmlFile {
  const xml = decodeUtf8(entry.bytes);
  const parsed = parseQtiPackageXmlTree(xml);
  return { path: entry.name, xml, root: parsed.root, errors: parsed.errors };
}

function assessmentItemRefs(xmlFile: PackageXmlFile): string[] {
  return packageDescendants(xmlFile.root, "qti-assessment-item-ref")
    .map((node) => node.attributes.href ?? "")
    .filter(Boolean)
    .map((href) => resolvePackageHref(xmlFile.path, href));
}

function manifestItemResources(xmlFile: PackageXmlFile): string[] {
  return packageDescendants(xmlFile.root, "resource")
    .filter((node) => isQtiItemResource(node.attributes.type ?? ""))
    .map((node) => resourceHref(node))
    .filter(Boolean)
    .map((href) => resolvePackageHref(xmlFile.path, href));
}

function manifestFileReferences(xmlFile: PackageXmlFile): string[] {
  return packageDescendants(xmlFile.root, "file")
    .map((node) => node.attributes.href ?? "")
    .filter(Boolean)
    .map((href) => resolvePackageHref(xmlFile.path, href));
}

function packageDependencyReferences(xmlFile: PackageXmlFile): string[] {
  const refs: string[] = [];
  collectPackageRelativeAttributeRefs(refs, xmlFile, "qti-stylesheet", "href");
  collectPackageRelativeAttributeRefs(refs, xmlFile, "qti-assessment-stimulus-ref", "href");
  collectPackageRelativeAttributeRefs(refs, xmlFile, "img", "src");
  collectPackageRelativeAttributeRefs(refs, xmlFile, "object", "data");
  collectPackageRelativeAttributeRefs(refs, xmlFile, "audio", "src");
  collectPackageRelativeAttributeRefs(refs, xmlFile, "video", "src");
  collectPackageRelativeAttributeRefs(refs, xmlFile, "source", "src");
  collectPackageRelativeAttributeRefs(refs, xmlFile, "track", "src");
  collectPackageRelativeTextRefs(refs, xmlFile, "qti-file-href");
  collectPackageRelativeTextRefs(refs, xmlFile, "qti-resource-icon");
  return [...new Set(refs)];
}

function collectPackageRelativeAttributeRefs(
  refs: string[],
  xmlFile: PackageXmlFile,
  localName: string,
  attribute: string,
): void {
  for (const node of packageDescendants(xmlFile.root, localName)) {
    const href = node.attributes[attribute];
    if (isPackageRelativeHref(href)) refs.push(resolvePackageHref(xmlFile.path, href.trim()));
  }
}

function collectPackageRelativeTextRefs(
  refs: string[],
  xmlFile: PackageXmlFile,
  localName: string,
): void {
  for (const node of packageDescendants(xmlFile.root, localName)) {
    const href = node.text.trim();
    if (isPackageRelativeHref(href)) refs.push(resolvePackageHref(xmlFile.path, href));
  }
}

function isPackageRelativeHref(href: string | undefined): href is string {
  const trimmed = href?.trim() ?? "";
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return false;
  return !/^[a-z][a-z0-9+.-]*:/i.test(trimmed);
}

function assessmentItemChildOrder(localName: string): number | undefined {
  switch (localName) {
    case "qti-context-declaration":
      return 1;
    case "qti-response-declaration":
      return 2;
    case "qti-outcome-declaration":
      return 3;
    case "qti-template-declaration":
      return 4;
    case "qti-template-processing":
      return 5;
    case "qti-assessment-stimulus-ref":
      return 6;
    case "qti-companion-materials-info":
      return 7;
    case "qti-stylesheet":
      return 8;
    case "qti-item-body":
      return 9;
    case "qti-catalog-info":
      return 10;
    case "qti-response-processing":
      return 11;
    case "qti-modal-feedback":
      return 12;
    default:
      return undefined;
  }
}

function packageXmlDiagnostics(xmlFile: PackageXmlFile): QtiDiagnostic[] {
  if (xmlFile.root?.localName !== "qti-assessment-item") return [];
  const diagnostics: QtiDiagnostic[] = [];
  let lastOrder = 0;

  for (const child of xmlFile.root.children) {
    const order = assessmentItemChildOrder(child.localName);
    if (!order) {
      diagnostics.push({
        code: "package.itemChild.unsupported",
        severity: "error",
        message: `qti-assessment-item contains unsupported child ${child.localName}.`,
        path: xmlFile.path,
      });
      continue;
    }
    if (order < lastOrder) {
      diagnostics.push({
        code: "package.itemChild.order",
        severity: "error",
        message: `${child.localName} appears out of QTI 3 qti-assessment-item child order.`,
        path: xmlFile.path,
      });
      continue;
    }
    lastOrder = order;
  }

  return diagnostics;
}

function isQtiItemResource(type: string): boolean {
  return type.toLowerCase().startsWith("imsqti_item_xmlv3p0");
}

function resourceHref(resource: QtiPackageXmlNode): string {
  const href = resource.attributes.href;
  if (href) return href;
  const file = packageDescendants(resource, "file").find((node) => {
    return (node.attributes.href ?? "").toLowerCase().endsWith(".xml");
  });
  return file?.attributes.href ?? "";
}

function resolvePackageHref(from: string, href: string): string {
  const path = href.split(/[?#]/, 1)[0] ?? "";
  return resolveRelativePath(from, path);
}

function packageDescendants(
  node: QtiPackageXmlNode | undefined,
  localName: string,
): QtiPackageXmlNode[] {
  if (!node) return [];
  const found: QtiPackageXmlNode[] = [];
  for (const child of node.children) {
    if (child.localName === localName) found.push(child);
    found.push(...packageDescendants(child, localName));
  }
  return found;
}

function resolveRelativePath(from: string, href: string): string {
  const base = from.includes("/") ? from.slice(0, from.lastIndexOf("/") + 1) : "";
  return parseCliPackagePath(`${base}${href}`, "package reference");
}
