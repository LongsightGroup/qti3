import { QTI_PACKAGE_MANIFEST_PATH } from "@longsightgroup/qti3-core";

import { throwIfDiagnostics } from "./diagnostics.js";
import { buildPackage, packageFiles } from "./package-build.js";
import { renderPackageManifest } from "./package-manifest.js";
import type {
  Qti3PackageAuthoringInput,
  Qti3PackageFile,
  Qti3PackageFilesResult,
  Qti3PackageManifestResult,
} from "./package-types.js";
export type {
  Qti3PackageAsset,
  Qti3PackageAuthoringInput,
  Qti3PackageAuthoringItem,
  Qti3PackageFile,
  Qti3PackageFilesResult,
  Qti3PackageItem,
  Qti3PackageManifestResult,
  Qti3PackageXmlItem,
  Qti3PackageZipResult,
} from "./package-types.js";
import type { Qti3WriterDiagnostic } from "./types.js";
import { Qti3WriterError } from "./types.js";
import { writeQti3PackageZipResult } from "./package-zip.js";

/** Validate a package authoring input without writing package files. */
export function validateQti3Package(
  input: Qti3PackageAuthoringInput,
): readonly Qti3WriterDiagnostic[] {
  return buildPackage(input).diagnostics;
}

/** Write an IMS manifest XML document for an item-bank QTI 3 package. */
export function writeQti3PackageManifest(input: Qti3PackageAuthoringInput): string {
  const built = buildPackage(input);
  throwIfDiagnostics(built.diagnostics);
  return renderPackageManifest(built.normalized);
}

/** Write an IMS manifest XML document and return diagnostics instead of throwing. */
export function writeQti3PackageManifestResult(
  input: Qti3PackageAuthoringInput,
): Qti3PackageManifestResult {
  const built = buildPackage(input);
  if (built.diagnostics.length) return { ok: false, diagnostics: built.diagnostics };
  return { ok: true, xml: renderPackageManifest(built.normalized), diagnostics: [] };
}

/** Write a package file map containing imsmanifest.xml, item XML files, and declared assets. */
export function writeQti3PackageFiles(
  input: Qti3PackageAuthoringInput,
): readonly Qti3PackageFile[] {
  const result = writeQti3PackageFilesResult(input);
  if (!result.ok) throw new Qti3WriterError(result.diagnostics);
  return result.files;
}

/** Write a package file map and return diagnostics instead of throwing. */
export function writeQti3PackageFilesResult(
  input: Qti3PackageAuthoringInput,
): Qti3PackageFilesResult {
  const built = buildPackage(input);
  if (built.diagnostics.length) return { ok: false, diagnostics: built.diagnostics };
  return {
    ok: true,
    files: [
      { path: QTI_PACKAGE_MANIFEST_PATH, data: renderPackageManifest(built.normalized) },
      ...packageFiles(built.normalized),
    ],
    diagnostics: [],
  };
}

/** Write a deterministic stored ZIP archive for an item-bank QTI 3 package. */
export function writeQti3PackageZip(input: Qti3PackageAuthoringInput): Uint8Array {
  const result = writeQti3PackageZipResult(input);
  if (!result.ok) throw new Qti3WriterError(result.diagnostics);
  return result.zip;
}

export { writeQti3PackageZipResult };
