import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { inflateRawSync } from "node:zlib";
import {
  readQtiPackageZipEntries,
  type QtiDiagnostic,
  type QtiPackageEntry,
} from "@longsightgroup/qti3-core";
import { PackageContentError } from "./package-content-error.js";
import { parseCliPackagePath } from "./package-path.js";

/** Read normalized entries from either a package ZIP or an expanded package directory. */
export async function readPackageEntries(file: string): Promise<QtiPackageEntry[]> {
  const fileStat = await stat(file);
  if (fileStat.isDirectory()) return readDirectoryPackageEntries(file);
  return readZipEntries(await readFile(file));
}

function readZipEntries(buffer: Uint8Array): QtiPackageEntry[] {
  const diagnostics: QtiDiagnostic[] = [];
  const entries = readQtiPackageZipEntries(
    buffer,
    {
      inflateRaw: (bytes, context) =>
        inflateRawSync(bytes, { maxOutputLength: context.maxOutputLength }),
    },
    diagnostics,
  );
  const errorDiagnostic = diagnostics.find((diagnostic) => diagnostic.severity === "error");
  if (errorDiagnostic) throw new PackageContentError(errorDiagnostic.message, diagnostics);
  return entries;
}

async function readDirectoryPackageEntries(root: string): Promise<QtiPackageEntry[]> {
  const entries: QtiPackageEntry[] = [];
  await collectDirectoryPackageEntries(root, root, entries);
  return entries;
}

async function collectDirectoryPackageEntries(
  root: string,
  directory: string,
  entries: QtiPackageEntry[],
): Promise<void> {
  const directoryEntries = (await readdir(directory, { withFileTypes: true })).toSorted((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const entry of directoryEntries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectDirectoryPackageEntries(root, path, entries);
      continue;
    }
    if (!entry.isFile()) continue;
    const name = parseCliPackagePath(relative(root, path).replaceAll("\\", "/"), "package file");
    entries.push({ path: name, bytes: await readFile(path) });
  }
}
