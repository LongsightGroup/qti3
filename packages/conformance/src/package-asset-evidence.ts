import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { QtiDiagnostic, QtiPackageParseResult } from "@longsightgroup/qti3-core";
import { certificationDiagnostic } from "./certification-package.js";

/** Exact resource-byte preservation evidence against the external source fixture. */
export interface QtiPackageAssetEvidence {
  readonly href: string;
  readonly referencedBy: readonly string[];
  readonly sourceSha256?: string | undefined;
  readonly importedSha256?: string | undefined;
  readonly ok: boolean;
}

/** Compare each imported asset with its source file; missing or changed resources fail. */
export async function comparePackageAssets(
  qtiRoot: string,
  packagePath: string,
  parsed: QtiPackageParseResult,
): Promise<{
  readonly assets: readonly QtiPackageAssetEvidence[];
  readonly diagnostics: readonly QtiDiagnostic[];
}> {
  const entries = new Map(parsed.entries.map((entry) => [entry.path, entry.bytes]));
  const assets: QtiPackageAssetEvidence[] = [];
  const diagnostics: QtiDiagnostic[] = [];
  for (const asset of parsed.assets) {
    const imported = entries.get(asset.href);
    let source: Uint8Array | undefined;
    try {
      source = await readFile(join(qtiRoot, dirname(packagePath), asset.href));
    } catch {
      /* Report the absent comparison source below. */
    }
    const sourceSha256 = source === undefined ? undefined : digest(source);
    const importedSha256 = imported === undefined ? undefined : digest(imported);
    const ok = sourceSha256 !== undefined && sourceSha256 === importedSha256;
    assets.push({
      href: asset.href,
      referencedBy: asset.referencedBy,
      sourceSha256,
      importedSha256,
      ok,
    });
    if (!ok)
      diagnostics.push(
        certificationDiagnostic(
          "certification.package.assetPreservation",
          `${packagePath}: ${asset.href} is missing or differs from the external source fixture.`,
        ),
      );
  }
  return { assets, diagnostics };
}
function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
