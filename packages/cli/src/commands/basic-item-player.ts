import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  basicItemPlayerProfile,
  runBasicItemPlayerReadiness,
  type QtiBasicItemPlayerPackageEvidence,
} from "@longsightgroup/qti3-conformance";
import type { QtiDiagnostic } from "@longsightgroup/qti3-core";
import {
  inspectPackageSafely,
  type PackageInspectionReport,
} from "../package/package-inspection.js";

/** Build the Basic item-player readiness report for package paths or package directories. */
export async function basicItemPlayerReport(targets: string[]): Promise<{
  target: string;
  packageTargets: string[];
  certificationContext: ReturnType<typeof runBasicItemPlayerReadiness>["certificationContext"];
  checked: number;
  failed: number;
  ok: boolean;
  packageItemCount: number;
  referencedItemResources: string[];
  missingPackageFeatures: { featureId: string; label: string }[];
  toleranceChecked: number;
  toleranceFailed: number;
  tolerance: ReturnType<typeof runBasicItemPlayerReadiness>["tolerance"];
  basicFeatures: {
    featureId: string;
    label: string;
    status: string;
    fixtureIds: string[];
    packageEvidence: boolean;
  }[];
  validatorEvidence: ReturnType<typeof runBasicItemPlayerReadiness>["validatorEvidence"];
  readiness: ReturnType<typeof runBasicItemPlayerReadiness>;
  packages: PackageInspectionReport[];
}> {
  const packageTargets = await expandBasicPackageTargets(targets);
  const packages = await Promise.all(
    packageTargets.map((target) => inspectPackageSafely(target, { strict: true, itemOnly: true })),
  );
  const packageEvidence = packages.map(toBasicPackageEvidence);
  const readiness = runBasicItemPlayerReadiness({ packageEvidence });
  const packageFeatureIds = aggregateBasicFeatures(packages);
  const packageFailures = packages.filter((report) => report.failed > 0).length;
  const missingPackageFeatures = basicItemPlayerProfile.features.filter((feature) => {
    if (feature.packageEvidenceRequired) {
      return !packageEvidence.some((entry) => entry.ok && entry.itemCount > 0);
    }
    return !packageFeatureIds.has(feature.featureId);
  });
  const failed = readiness.failed + packageFailures + missingPackageFeatures.length;

  return {
    target: "QTI 3 Basic Item Player Readiness",
    packageTargets,
    certificationContext: readiness.certificationContext,
    checked: readiness.checked,
    failed,
    ok: failed === 0,
    packageItemCount: packages.reduce((sum, report) => sum + report.checked, 0),
    referencedItemResources: [
      ...new Set(packages.flatMap((report) => report.discoveredReferences)),
    ],
    missingPackageFeatures: missingPackageFeatures.map((feature) => ({
      featureId: feature.featureId,
      label: feature.label,
    })),
    toleranceChecked: readiness.toleranceChecked,
    toleranceFailed: readiness.toleranceFailed,
    tolerance: readiness.tolerance,
    basicFeatures: basicItemPlayerProfile.features.map((feature) => {
      const result = readiness.features.find((row) => row.featureId === feature.featureId);
      return {
        featureId: feature.featureId,
        label: feature.label,
        status: result?.status ?? "missing",
        fixtureIds: feature.fixtureIds,
        packageEvidence: feature.packageEvidenceRequired
          ? packageEvidence.some((entry) => entry.ok && entry.itemCount > 0)
          : packageFeatureIds.has(feature.featureId),
      };
    }),
    validatorEvidence: readiness.validatorEvidence,
    readiness,
    packages,
  };
}

function toBasicPackageEvidence(
  report: PackageInspectionReport,
): QtiBasicItemPlayerPackageEvidence {
  const diagnostics: QtiDiagnostic[] = [
    ...report.packageErrors.map((message): QtiDiagnostic => {
      return {
        code: "package.error",
        severity: "error",
        message,
      };
    }),
    ...report.results.flatMap((result) =>
      result.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        path: diagnostic.path ? `${result.file}${diagnostic.path}` : result.file,
      })),
    ),
  ];
  return {
    source: report.file,
    ok: report.failed === 0 && report.checked > 0,
    itemCount: report.checked,
    diagnostics,
  };
}

async function expandBasicPackageTargets(targets: string[]): Promise<string[]> {
  const requested = targets.length > 0 ? targets : ["packages/fixtures/packages/basic-item-player"];
  const expanded: string[] = [];

  for (const target of requested) {
    const targetStat = await stat(target);
    if (!targetStat.isDirectory()) {
      expanded.push(target);
      continue;
    }

    if (await hasPackageManifest(target)) {
      expanded.push(target);
      continue;
    }

    const entries = await readdir(target, { withFileTypes: true });
    const packageDirectories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(target, entry.name))
      .toSorted();
    const before = expanded.length;
    for (const directory of packageDirectories) {
      if (await hasPackageManifest(directory)) expanded.push(directory);
    }
    if (expanded.length === before) expanded.push(target);
  }

  return expanded;
}

async function hasPackageManifest(directory: string): Promise<boolean> {
  try {
    return (await stat(join(directory, "imsmanifest.xml"))).isFile();
  } catch {
    return false;
  }
}

function aggregateBasicFeatures(packages: PackageInspectionReport[]): Set<string> {
  return new Set(
    packages.flatMap((report) => report.results.flatMap((result) => result.basicFeatures)),
  );
}
