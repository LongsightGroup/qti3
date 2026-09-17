import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { basicImportItemChecklistSource } from "./basic-import-item-checklist.js";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceRoot = dirname(dirname(packageRoot));

/** Run identity binds evidence to actual inputs and runtime code, without claiming certification. */
export interface QtiCertificationIdentity {
  readonly collectedAt: string;
  readonly source: {
    readonly revision?: string | undefined;
    readonly workbookSha256?: string | undefined;
    readonly inputsUnchanged: boolean;
    readonly matchesReviewedSource: boolean;
  };
  readonly producer: {
    readonly version: string;
    readonly revision?: string | undefined;
    readonly clean: boolean;
    readonly runtimeSha256?: string | undefined;
    readonly mode: "src" | "dist";
  };
  readonly environment: { readonly node: string; readonly platform: string; readonly arch: string };
}

/** Read actual git/file identity for a certification run; unavailable provenance stays explicit. */
export async function captureCertificationIdentity(
  qtiRoot: string,
  sourcePaths: readonly string[],
): Promise<QtiCertificationIdentity> {
  const [revision, sourceChanges, producerRevision, producerChanges] = await Promise.all([
    git(qtiRoot, ["rev-parse", "HEAD"]),
    git(qtiRoot, [
      "status",
      "--porcelain",
      "--untracked-files=all",
      "--",
      basicImportItemChecklistSource.workbook,
      ...sourcePaths,
    ]),
    git(sourceRoot, ["rev-parse", "HEAD"]),
    git(sourceRoot, ["status", "--porcelain", "--untracked-files=all"]),
  ]);
  let workbookSha256: string | undefined;
  try {
    workbookSha256 = hash(await readFile(join(qtiRoot, basicImportItemChecklistSource.workbook)));
  } catch {
    /* Unavailable is recorded below. */
  }
  let version = "unavailable";
  try {
    const value: unknown = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
    if (
      typeof value === "object" &&
      value !== null &&
      "version" in value &&
      typeof value.version === "string"
    )
      version = value.version;
  } catch {
    /* Do not infer a version when package metadata is unavailable. */
  }
  const mode = fileURLToPath(import.meta.url).includes("/src/") ? "src" : "dist";
  let runtimeSha256: string | undefined;
  try {
    const records: string[] = [];
    for (const name of ["core", "fixtures", "writer", "conformance", "cli"]) {
      for (const file of await runtimeFiles(join(sourceRoot, "packages", name, mode), mode)) {
        records.push(`${relative(sourceRoot, file)}:${hash(await readFile(file))}`);
      }
    }
    if (records.length > 0) runtimeSha256 = hash(records.toSorted().join("\n"));
  } catch {
    /* Missing runtime files cannot establish a reproducible build. */
  }
  const inputsUnchanged = sourceChanges === "";
  return {
    collectedAt: new Date().toISOString(),
    source: {
      revision,
      workbookSha256,
      inputsUnchanged,
      matchesReviewedSource:
        inputsUnchanged &&
        revision === basicImportItemChecklistSource.revision &&
        workbookSha256 === basicImportItemChecklistSource.sha256,
    },
    producer: {
      version,
      revision: producerRevision,
      clean: producerChanges === "",
      runtimeSha256,
      mode,
    },
    environment: { node: process.version, platform: process.platform, arch: process.arch },
  };
}
function git(root: string, args: readonly string[]): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile("git", ["-C", root, ...args], { maxBuffer: 1024 * 1024 }, (error, stdout) => {
      resolve(error ? undefined : stdout.trim());
    });
  });
}
async function runtimeFiles(root: string, mode: "src" | "dist"): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await runtimeFiles(path, mode)));
    else if (
      entry.isFile() &&
      entry.name.endsWith(mode === "src" ? ".ts" : ".js") &&
      !entry.name.includes(".test.")
    )
      files.push(path);
  }
  return files;
}
function hash(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}
