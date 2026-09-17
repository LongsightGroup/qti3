import {
  decodeUtf8,
  parseQtiPackageXmlTree,
  parseQtiXml,
  parseQtiPackageFromEntries,
  isQtiItemResource,
  QTI_ASI_NAMESPACE,
  type QtiParseResult,
  type QtiDiagnostic,
  type QtiPackageXmlNode,
} from "@longsightgroup/qti3-core";
import { diagnosticKey, uniqueDiagnostics } from "../diagnostics.js";
import { detectBasicItemFeatures } from "./basic-item-features.js";
import { PackageContentError } from "./package-content-error.js";
import { readPackageEntries } from "./package-reader.js";

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
  packageDiagnostics: readonly QtiDiagnostic[];
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
      packageDiagnostics: cause.diagnostics,
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
  const entries = await readPackageEntries(file);
  const imported = parseQtiPackageFromEntries(entries);
  // Root classification serves CLI discovery only; core owns the manifest and test graph.
  const xmlFiles: PackageXmlFile[] = entries
    .filter((entry) => entry.path.toLowerCase().endsWith(".xml"))
    .map((entry) => {
      const xml = decodeUtf8(entry.bytes);
      const parsed = parseQtiPackageXmlTree(xml);
      return { path: entry.path, xml, root: parsed.root, errors: parsed.errors };
    });
  const byPath = new Map(xmlFiles.map((entry) => [entry.path, entry]));
  const selectedPaths = new Set(imported.items.map((item) => item.href));
  const itemDiagnosticKeys = new Set(
    imported.items.flatMap((item) => item.diagnostics.map(diagnosticKey)),
  );
  const packageDiagnostics: QtiDiagnostic[] = imported.diagnostics
    .filter((diagnostic) => !itemDiagnosticKeys.has(diagnosticKey(diagnostic)))
    .map((diagnostic) =>
      !strict &&
      (diagnostic.code === "package.manifest.missing" ||
        diagnostic.code === "package.shape.unsupported")
        ? { ...diagnostic, severity: "warning" }
        : diagnostic,
    );
  const results = imported.items.map((item) =>
    inspectionItem(
      item.href,
      item.source,
      item.xml,
      {
        ok:
          item.document !== undefined &&
          item.diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
        document: item.document,
        diagnostics: [...item.diagnostics],
      },
      strict ? byPath.get(item.href) : undefined,
    ),
  );
  const assessmentTestFiles: string[] = [];
  for (const xmlFile of xmlFiles) {
    if (!selectedPaths.has(xmlFile.path)) {
      for (const message of xmlFile.errors) {
        packageDiagnostics.push({
          code: "xml.parse",
          severity: "error",
          message,
          path: xmlFile.path,
        });
      }
    }
    if (xmlFile.root?.uri !== QTI_ASI_NAMESPACE) continue;
    if (xmlFile.root.localName === "qti-assessment-test") assessmentTestFiles.push(xmlFile.path);
    if (xmlFile.root.localName !== "qti-assessment-item" || selectedPaths.has(xmlFile.path))
      continue;
    if (strict) {
      packageDiagnostics.push({
        code: "package.inspection.item.unreferenced",
        severity: "error",
        path: xmlFile.path,
        message: `qti-assessment-item ${xmlFile.path} is not referenced by the package manifest or assessment test.`,
      });
    } else {
      results.push(inspectionItem(xmlFile.path, "direct", xmlFile.xml, parseQtiXml(xmlFile.xml)));
    }
  }
  const discoveredReferences = imported.assessmentTest
    ? imported.assessmentTest.itemRefs.map((reference) => reference.href)
    : imported.manifestResources
        .filter((resource) => isQtiItemResource(resource.type))
        .flatMap((resource) => (resource.href ? [resource.href] : []));
  if (strict && discoveredReferences.length === 0) {
    packageDiagnostics.push({
      code: "package.inspection.references.required",
      severity: "error",
      message: "strict package validation requires manifest or assessment-test item references.",
    });
  }
  if (mode === "basic-item-player" && assessmentTestFiles.length > 0) {
    packageDiagnostics.push({
      code: "package.inspection.assessmentTest.outOfScope",
      severity: "error",
      message: `assessment-test packages are out of scope for Basic item-player readiness: ${assessmentTestFiles.join(", ")}.`,
    });
  }
  const diagnostics = uniqueDiagnostics(packageDiagnostics);
  const packageErrors = diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => diagnostic.message);
  return {
    file,
    strict,
    checked: results.length,
    failed: results.filter((result) => !result.ok).length + packageErrors.length,
    packageErrors,
    packageDiagnostics: diagnostics,
    xmlFiles: xmlFiles.map((entry) => entry.path),
    assetFiles: entries
      .filter((entry) => !entry.path.toLowerCase().endsWith(".xml"))
      .map((entry) => entry.path),
    discoveredReferences,
    assessmentTestFiles,
    results,
  };
}

function inspectionItem(
  file: string,
  source: PackageInspectionReport["results"][number]["source"],
  xml: string,
  parsed: QtiParseResult,
  strictXml?: PackageXmlFile,
): PackageInspectionReport["results"][number] {
  const diagnostics = uniqueDiagnostics([
    ...parsed.diagnostics,
    ...(strictXml ? packageXmlDiagnostics(strictXml) : []),
  ]);
  return {
    file,
    source,
    ok: parsed.ok && diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
    interactions:
      parsed.document?.item.interactions.map((interaction) => interaction.qtiName) ?? [],
    basicFeatures: detectBasicItemFeatures(xml, parsed),
  };
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
