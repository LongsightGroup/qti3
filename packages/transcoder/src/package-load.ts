import {
  discoverQtiPackageContentAssets,
  parseQtiPackage,
  type QtiAssessmentTestPackageModel,
  type QtiStandardAlignment,
} from "@longsightgroup/qti3-core";
import { writeQti3PackageFilesResult } from "@longsightgroup/qti3-writer";

import type {
  Qti3TranscodePackageSource,
  QtiTranscodeDiagnostic,
  QtiTranscodeFile,
} from "./types.js";

export interface LoadedPackageInput {
  readonly identifier: string;
  readonly title: string;
  readonly items: readonly LoadedPackageItem[];
  readonly assets: readonly QtiTranscodeFile[];
  readonly assetOwners: ReadonlyMap<string, readonly string[]>;
  readonly assessmentTest?: QtiAssessmentTestPackageModel | undefined;
  readonly diagnostics: readonly QtiTranscodeDiagnostic[];
}

export interface LoadedPackageItem {
  readonly path: string;
  readonly xml: string;
  readonly manifestResourceIdentifier?: string | undefined;
  readonly standards: readonly QtiStandardAlignment[];
}

export function loadPackage(source: Qti3TranscodePackageSource):
  | { readonly ok: true; readonly package: LoadedPackageInput }
  | {
      readonly ok: false;
      readonly code: "invalid_source" | "malformed_package" | "missing_asset";
      readonly diagnostics: readonly QtiTranscodeDiagnostic[];
    } {
  if (source.kind === "authoringPackage") {
    const written = writeQti3PackageFilesResult(source.package);
    if (!written.ok) {
      return {
        ok: false,
        code: "invalid_source",
        diagnostics: written.diagnostics.map((entry) => ({
          code: `source.writer.${entry.code}`,
          severity: "error",
          message: entry.message,
          path: entry.path,
        })),
      };
    }
    const itemPaths = new Set(source.package.items.map((item) => item.path));
    const availablePaths = new Set(written.files.map((file) => file.path));
    for (const file of written.files) {
      if (!itemPaths.has(file.path) || typeof file.data !== "string") continue;
      const discovered = discoverQtiPackageContentAssets(file.data, file.path);
      const missing = discovered.hrefs.find((href) => !availablePaths.has(href));
      if (missing) {
        return {
          ok: false,
          code: "missing_asset",
          diagnostics: [
            {
              code: "package.asset.missing",
              severity: "error",
              message: `Package item ${file.path} requires missing asset ${missing}.`,
              path: missing,
            },
          ],
        };
      }
    }
    return {
      ok: true,
      package: {
        identifier: source.package.identifier,
        title: source.package.title ?? source.package.identifier,
        items: written.files.flatMap((file) =>
          itemPaths.has(file.path) && typeof file.data === "string"
            ? [{ path: file.path, xml: file.data, standards: [] }]
            : [],
        ),
        assets: written.files.filter(
          (file) => file.path !== "imsmanifest.xml" && !itemPaths.has(file.path),
        ),
        assetOwners: new Map(
          written.files
            .filter((file) => file.path !== "imsmanifest.xml" && !itemPaths.has(file.path))
            .map((file) => [
              file.path,
              source.package.items
                .filter((item) => item.assets?.some((asset) => asset.path === file.path))
                .map((item) => item.path),
            ]),
        ),
        diagnostics: [],
      },
    };
  }

  const parsed = parseQtiPackage(source.bytes, {
    inflateRaw: source.inflateRaw,
  });
  const diagnostics = parsed.diagnostics.map<QtiTranscodeDiagnostic>((entry) => ({
    code: `source.${entry.code}`,
    severity: entry.severity,
    message: entry.message,
    path: entry.path,
  }));
  if (!parsed.ok) return { ok: false, code: "malformed_package", diagnostics };
  const entriesByPath = new Map(parsed.entries.map((entry) => [entry.path, entry.bytes]));
  return {
    ok: true,
    package: {
      identifier: parsed.assessmentTest?.identifier ?? "ASSESSMENT",
      title:
        parsed.assessmentTest?.title ??
        parsed.assessmentTest?.identifier ??
        "Transcoded assessment",
      items: parsed.items.map((item) => ({
        path: item.href,
        xml: item.xml,
        manifestResourceIdentifier: item.manifestResourceIdentifier,
        standards: item.standards,
      })),
      assets: parsed.assets.flatMap((asset) => {
        const bytes = entriesByPath.get(asset.href);
        return bytes ? [{ path: asset.href, data: bytes }] : [];
      }),
      assetOwners: new Map(parsed.assets.map((asset) => [asset.href, asset.referencedBy])),
      assessmentTest: parsed.assessmentTest,
      diagnostics,
    },
  };
}
