import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { inflateRawSync } from "node:zlib";
import {
  normalizePackagePath,
  readQtiPackageZipEntries,
  type QtiDiagnostic,
} from "@longsightgroup/qti3-core";

/** One normalized file entry read from an expanded or zipped QTI package. */
export interface PackageEntry {
  name: string;
  bytes: Uint8Array;
}

/** Read normalized entries from either a package ZIP or an expanded package directory. */
export async function readPackageEntries(file: string): Promise<PackageEntry[]> {
  const fileStat = await stat(file);
  if (fileStat.isDirectory()) return readDirectoryPackageEntries(file);
  return readZipEntries(await readFile(file));
}

function readZipEntries(buffer: Uint8Array): PackageEntry[] {
  const diagnostics: QtiDiagnostic[] = [];
  const entries = readQtiPackageZipEntries(
    buffer,
    { inflateRaw: (bytes) => inflateRawSync(bytes) },
    diagnostics,
  );
  if (entries.length === 0) {
    const message =
      diagnostics.find((diagnostic) => diagnostic.severity === "error")?.message ??
      "No ZIP central directory was found.";
    throw new Error(message);
  }
  return entries.map((entry) => ({ name: entry.path, bytes: entry.bytes }));
}

async function readDirectoryPackageEntries(root: string): Promise<PackageEntry[]> {
  const entries: PackageEntry[] = [];
  await collectDirectoryPackageEntries(root, root, entries);
  return entries;
}

async function collectDirectoryPackageEntries(
  root: string,
  directory: string,
  entries: PackageEntry[],
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
    const name = normalizeCliPackagePath(
      relative(root, path).replaceAll("\\", "/"),
      "package file",
    );
    entries.push({ name, bytes: await readFile(path) });
  }
}

function normalizeCliPackagePath(path: string, context: string): string {
  const diagnostics: QtiDiagnostic[] = [];
  const normalized = normalizePackagePath(path, context, diagnostics);
  if (normalized !== undefined) return normalized;
  throw new Error(
    diagnostics.find((diagnostic) => diagnostic.severity === "error")?.message ??
      `${context} ${path} is not a valid package-relative path.`,
  );
}
