import { strToU8, zipSync } from "fflate";

import { aggregateFidelity, transcodeQti3Item } from "./item.js";
import { loadPackage } from "./package-load.js";
import { findCollision, generatedAssetPath, validatePaths } from "./package-manifest.js";
import { assembleTargetPackage } from "./package-target.js";
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
  const assembly = assembleTargetPackage(profile, loaded.package, itemFiles);
  if (!assembly.ok) {
    return {
      ok: false,
      profile: options.profile,
      code: "target_generation_failed",
      diagnostics: [...diagnostics, assembly.diagnostic],
    };
  }
  const pathFailure = validatePaths(assembly.files);
  if (pathFailure) {
    return {
      ok: false,
      profile: options.profile,
      code: "unsafe_path",
      diagnostics: [...diagnostics, pathFailure],
    };
  }
  const collision = findCollision(assembly.files);
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
    ...assembly.files,
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
  const files: QtiTranscodeFile[] = [...assembly.files, { path: reportPath, data: reportData }];
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
