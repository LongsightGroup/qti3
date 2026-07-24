import { strToU8, zipSync } from "fflate";

import { aggregateFidelity, transcodeQti3Item } from "./item.js";
import { serializeCanvasClassicPackage } from "./package-canvas.js";
import { loadPackage } from "./package-load.js";
import {
  findCollision,
  generatedAssetPath,
  packageManifest,
  validatePaths,
} from "./package-manifest.js";
import { serializeTargetAssessmentTest } from "./package-assessment-test.js";
import { qtiTranscodeProfile } from "./profiles.js";
import type {
  Qti3TranscodePackageSource,
  QtiTranscodeDiagnostic,
  QtiTranscodeFile,
  QtiTranscodeOptions,
  QtiTranscodePackageResult,
} from "./types.js";

const ZIP_EPOCH = new Date("1980-01-02T12:00:00.000Z");

/** Transcode a typed or ZIP QTI 3 package and emit deterministic target files and ZIP bytes. */
export async function transcodeQti3Package(
  source: Qti3TranscodePackageSource,
  options: QtiTranscodeOptions,
): Promise<QtiTranscodePackageResult> {
  const loaded = loadPackage(source);
  if (!loaded.ok) {
    return {
      ok: false,
      profile: options.profile,
      code: loaded.code,
      diagnostics: loaded.diagnostics,
    };
  }
  const profile = qtiTranscodeProfile(options.profile);
  const diagnostics: QtiTranscodeDiagnostic[] = [...loaded.package.diagnostics];
  const itemFiles: QtiTranscodeFile[] = [];
  const reports = [];
  for (const item of loaded.package.itemFiles) {
    const result = transcodeQti3Item(
      { kind: "xml", xml: item.xml, sourcePath: item.path },
      options,
    );
    diagnostics.push(...result.diagnostics);
    if (!result.ok) {
      return {
        ok: false,
        profile: options.profile,
        code: result.code,
        diagnostics,
      };
    }
    itemFiles.push({ path: item.path, data: result.xml });
    reports.push(result.report);
  }
  let canvasPackage;
  if (profile.packageDialect === "canvas-classic-quiz") {
    try {
      canvasPackage = serializeCanvasClassicPackage(
        loaded.package.identifier,
        loaded.package.title,
        itemFiles,
        loaded.package.assets,
        loaded.package.assetOwners,
      );
    } catch {
      return {
        ok: false,
        profile: options.profile,
        code: "target_generation_failed",
        diagnostics: [
          ...diagnostics,
          {
            code: "target.canvas_classic.package_generation",
            severity: "error",
            message: "Canvas Classic package assembly failed after item transcoding.",
          },
        ],
      };
    }
  }
  const assessmentTestFile =
    !canvasPackage && loaded.package.assessmentTest
      ? {
          path: loaded.package.assessmentTest.href,
          data: serializeTargetAssessmentTest(loaded.package.assessmentTest, profile.target),
        }
      : undefined;

  const targetItemFiles = canvasPackage ? [canvasPackage.assessment] : itemFiles;
  const supplementalFiles = canvasPackage
    ? [canvasPackage.metadata]
    : assessmentTestFile
      ? [assessmentTestFile]
      : [];
  const primaryFiles = [...targetItemFiles, ...supplementalFiles];
  const pathFailure = validatePaths([...primaryFiles, ...loaded.package.assets]);
  if (pathFailure) {
    return {
      ok: false,
      profile: options.profile,
      code: "unsafe_path",
      diagnostics: [...diagnostics, pathFailure],
    };
  }
  const collision = findCollision([...primaryFiles, ...loaded.package.assets]);
  if (collision) {
    return {
      ok: false,
      profile: options.profile,
      code: "unsafe_path",
      diagnostics: [
        ...diagnostics,
        {
          code: "package.path.collision",
          severity: "error",
          message: `Package contains conflicting data at ${collision}.`,
          path: collision,
        },
      ],
    };
  }

  const reportData = JSON.stringify(
    {
      schema: "qti3.transcode-report.v1",
      profile: options.profile,
      target: profile.target,
      fidelity: aggregateFidelity(
        reports.map((report) => report.fidelity),
        diagnostics,
      ),
      items: reports,
      diagnostics,
    },
    undefined,
    2,
  );
  const reportPath = await generatedAssetPath(reportData, "json");
  const generatedCollision = findCollision([
    ...primaryFiles,
    ...loaded.package.assets,
    { path: reportPath, data: reportData },
  ]);
  if (generatedCollision) {
    return {
      ok: false,
      profile: options.profile,
      code: "unsafe_path",
      diagnostics: [
        ...diagnostics,
        {
          code: "package.generated_path.collision",
          severity: "error",
          message: `Generated content conflicts with source content at ${generatedCollision}.`,
          path: generatedCollision,
        },
      ],
    };
  }
  const files: QtiTranscodeFile[] = [
    {
      path: "imsmanifest.xml",
      data:
        canvasPackage?.manifest ??
        packageManifest(
          profile.manifestResourceType,
          profile.schemaVersion,
          itemFiles,
          loaded.package.assets,
          loaded.package.assetOwners,
          assessmentTestFile,
          profile.target,
        ),
    },
    ...targetItemFiles,
    ...supplementalFiles,
    ...loaded.package.assets,
    { path: reportPath, data: reportData },
  ];
  const zipEntries: Record<string, Uint8Array> = {};
  for (const file of files) {
    zipEntries[file.path] = typeof file.data === "string" ? strToU8(file.data) : file.data;
  }
  const zip = zipSync(zipEntries, { level: 0, mtime: ZIP_EPOCH });
  return {
    ok: true,
    profile: options.profile,
    target: profile.target,
    fidelity: aggregateFidelity(
      reports.map((report) => report.fidelity),
      diagnostics,
    ),
    files,
    zip,
    reports,
    diagnostics,
  };
}

export { serializeTargetAssessmentTest } from "./package-assessment-test.js";
