import type { LoadedPackageInput } from "./package-load.js";
import { serializeCanvasClassicPackage } from "./package-canvas.js";
import { packageManifest } from "./package-manifest.js";
import { serializeMoodleXmlPackage } from "./package-moodle-xml.js";
import { serializeTargetAssessmentTest } from "./package-assessment-test.js";
import type { QtiTranscodeProfile } from "./profiles.js";
import type { QtiTranscodeDiagnostic, QtiTranscodeFile } from "./types.js";
import { validateGeneratedTargetXml } from "./xml.js";

/** Successful or diagnosed target-specific package assembly. */
export type TargetPackageAssemblyResult =
  | { readonly ok: true; readonly files: readonly QtiTranscodeFile[] }
  | { readonly ok: false; readonly diagnostic: QtiTranscodeDiagnostic };

/** Assemble target files behind the selected profile's package boundary. */
export function assembleTargetPackage(
  profile: QtiTranscodeProfile,
  source: LoadedPackageInput,
  itemFiles: readonly QtiTranscodeFile[],
): TargetPackageAssemblyResult {
  try {
    switch (profile.kind) {
      case "canvas-classic":
        return assembleCanvasPackage(source, itemFiles);
      case "moodle-xml":
        return assembleMoodlePackage(source, itemFiles);
      case "qti-standard":
        return assembleStandardPackage(profile, source, itemFiles);
      default: {
        const unexpected: never = profile;
        throw new Error(`Unsupported package profile: ${JSON.stringify(unexpected)}`);
      }
    }
  } catch {
    return {
      ok: false,
      diagnostic: {
        code: `target.${profile.kind.replaceAll("-", "_")}.package_generation`,
        severity: "error",
        message: `Target package assembly failed for ${profile.id}.`,
      },
    };
  }
}

function assembleMoodlePackage(
  source: LoadedPackageInput,
  itemFiles: readonly QtiTranscodeFile[],
): TargetPackageAssemblyResult {
  const file = serializeMoodleXmlPackage(itemFiles, source.assets, source.assetOwners);
  if (typeof file.data !== "string") {
    throw new Error("Moodle XML package assembly produced non-text data.");
  }
  const diagnostics = validateGeneratedTargetXml(file.data, "moodle-xml");
  const error = diagnostics.find((diagnostic) => diagnostic.severity === "error");
  return error ? { ok: false, diagnostic: error } : { ok: true, files: [file] };
}

function assembleCanvasPackage(
  source: LoadedPackageInput,
  itemFiles: readonly QtiTranscodeFile[],
): TargetPackageAssemblyResult {
  const canvas = serializeCanvasClassicPackage(
    source.identifier,
    source.title,
    itemFiles,
    source.assets,
    source.assetOwners,
  );
  return {
    ok: true,
    files: [
      { path: "imsmanifest.xml", data: canvas.manifest },
      canvas.assessment,
      canvas.metadata,
      ...source.assets,
    ],
  };
}

function assembleStandardPackage(
  profile: Extract<QtiTranscodeProfile, { kind: "qti-standard" }>,
  source: LoadedPackageInput,
  itemFiles: readonly QtiTranscodeFile[],
): TargetPackageAssemblyResult {
  const assessmentTest = source.assessmentTest
    ? {
        path: source.assessmentTest.href,
        data: serializeTargetAssessmentTest(source.assessmentTest, profile.target),
      }
    : undefined;
  const manifest = packageManifest(
    profile.package.manifestResourceType,
    profile.package.schemaVersion,
    itemFiles,
    source.assets,
    source.assetOwners,
    assessmentTest,
    profile.target,
  );
  return {
    ok: true,
    files: [
      { path: "imsmanifest.xml", data: manifest },
      ...itemFiles,
      ...(assessmentTest ? [assessmentTest] : []),
      ...source.assets,
    ],
  };
}
