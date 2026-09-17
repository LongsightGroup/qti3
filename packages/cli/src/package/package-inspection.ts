import {
  decodeUtf8,
  diagnosticKey,
  uniqueDiagnostics,
  parseQtiXml,
  parseQtiPackageFromEntries,
  isQtiItemResource,
  QTI_ASI_NAMESPACE,
  type QtiParseResult,
  type QtiDiagnostic,
} from "@longsightgroup/qti3-core";
import { detectBasicItemFeatures } from "./basic-item-features.js";
import { PackageContentError } from "./package-content-error.js";
import { readPackageEntries } from "./package-reader.js";

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
  const entriesByPath = new Map(entries.map((entry) => [entry.path, entry]));
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
    inspectionItem(item.href, item.source, item.xml, {
      ok:
        item.document !== undefined &&
        item.diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
      document: item.document,
      diagnostics: [...item.diagnostics],
    }),
  );
  const assessmentTestFiles: string[] = [];
  for (const xmlFile of imported.xmlFiles) {
    if (!selectedPaths.has(xmlFile.path)) {
      packageDiagnostics.push(...xmlFile.diagnostics);
    }
    if (xmlFile.rootNamespaceUri !== QTI_ASI_NAMESPACE) continue;
    if (xmlFile.rootLocalName === "qti-assessment-test") assessmentTestFiles.push(xmlFile.path);
    if (xmlFile.rootLocalName !== "qti-assessment-item" || selectedPaths.has(xmlFile.path))
      continue;
    if (strict) {
      packageDiagnostics.push({
        code: "package.inspection.item.unreferenced",
        severity: "error",
        path: xmlFile.path,
        message: `qti-assessment-item ${xmlFile.path} is not referenced by the package manifest or assessment test.`,
      });
    } else {
      const entry = entriesByPath.get(xmlFile.path);
      if (!entry) throw new Error(`Core XML inventory references missing entry ${xmlFile.path}.`);
      const xml = decodeUtf8(entry.bytes);
      results.push(inspectionItem(xmlFile.path, "direct", xml, parseQtiXml(xml)));
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
    xmlFiles: imported.xmlFiles.map((entry) => entry.path),
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
): PackageInspectionReport["results"][number] {
  const diagnostics = uniqueDiagnostics(parsed.diagnostics);
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
