import { parseQtiPackage, QTI_PACKAGE_MANIFEST_PATH } from "@longsightgroup/qti3-core";
import { strToU8, zipSync } from "fflate";

import { writerDiagnostic } from "./diagnostics.js";
import { buildPackage, packageFiles } from "./package-build.js";
import { renderPackageManifest } from "./package-manifest.js";
import type { Qti3PackageAuthoringInput, Qti3PackageZipResult } from "./package-types.js";
import type { Qti3WriterDiagnostic } from "./types.js";

const ZIP_EPOCH = new Date("1980-01-02T12:00:00.000Z");

export function writeQti3PackageZipResult(input: Qti3PackageAuthoringInput): Qti3PackageZipResult {
  const built = buildPackage(input);
  if (built.diagnostics.length) return { ok: false, diagnostics: built.diagnostics };

  const zipEntries: Record<string, Uint8Array> = {
    [QTI_PACKAGE_MANIFEST_PATH]: strToU8(renderPackageManifest(built.normalized)),
  };
  for (const file of packageFiles(built.normalized)) {
    zipEntries[file.path] = fileDataBytes(file.data);
  }

  const zip = zipSync(zipEntries, { level: 0, mtime: ZIP_EPOCH });
  const roundTripDiagnostics = packageRoundTripDiagnostics(zip);
  if (roundTripDiagnostics.length) return { ok: false, diagnostics: roundTripDiagnostics };
  return { ok: true, zip, diagnostics: [] };
}

function packageRoundTripDiagnostics(zip: Uint8Array): Qti3WriterDiagnostic[] {
  const parsed = parseQtiPackage(zip);
  return parsed.diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) =>
      writerDiagnostic(
        `package_round_trip_${diagnostic.code}`,
        diagnostic.path ?? "package",
        diagnostic.message,
      ),
    );
}

function fileDataBytes(data: Uint8Array | string): Uint8Array {
  return typeof data === "string" ? strToU8(data) : data;
}
