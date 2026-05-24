#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import {
  dirname,
  isAbsolute as isAbsolutePosix,
  join as joinPosix,
  normalize as normalizePosix,
} from "node:path/posix";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const packagesRoot = join(root, "packages");
const failures = [];

for (const entry of await readdir(packagesRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const packageRoot = join(packagesRoot, entry.name);
  const manifestPath = join(packageRoot, "package.json");
  const manifest = await readJson(manifestPath);
  if (!manifest.name) continue;
  await checkPackage(packageRoot, manifest);
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
}

async function checkPackage(packageRoot, manifest) {
  const tempRoot = await mkdtemp(join(tmpdir(), "qti3-package-map-check-"));
  try {
    const packDirectory = join(tempRoot, "pack");
    const extractDirectory = join(tempRoot, "extract");
    await mkdirs(packDirectory, extractDirectory);
    execFileSync("pnpm", ["--dir", packageRoot, "pack", "--pack-destination", packDirectory], {
      cwd: root,
      stdio: "pipe",
    });

    const tarballs = (await readdir(packDirectory)).filter((file) => file.endsWith(".tgz"));
    if (tarballs.length !== 1) {
      failures.push(`${manifest.name} generated ${tarballs.length} tarballs while checking maps.`);
      return;
    }

    const tarballPath = join(packDirectory, tarballs[0]);
    execFileSync("tar", ["-xzf", tarballPath, "-C", extractDirectory], { stdio: "pipe" });
    await checkExtractedPackage(join(extractDirectory, "package"), manifest);
  } finally {
    await rm(tempRoot, { force: true, recursive: true });
  }
}

async function checkExtractedPackage(packageDirectory, manifest) {
  const packageFiles = await listFiles(packageDirectory);
  const packageFileSet = new Set(packageFiles);
  for (const mapPath of packageFiles.filter((file) => file.endsWith(".map"))) {
    const map = await readJson(join(packageDirectory, mapPath));
    if (!Array.isArray(map.sources)) continue;
    const sourceRoot = typeof map.sourceRoot === "string" ? map.sourceRoot : "";
    for (const source of map.sources) {
      if (typeof source !== "string" || shouldSkipSource(source)) continue;
      const sourcePath = normalizeMapSource(mapPath, sourceRoot, source);
      if (!sourcePath || !packageFileSet.has(sourcePath)) {
        failures.push(
          `${manifest.name} ${mapPath} references missing source ${sourcePath ?? source}.`,
        );
      }
    }
  }
}

function normalizeMapSource(mapPath, sourceRoot, source) {
  if (isAbsolutePosix(sourceRoot) || isAbsolutePosix(source)) return undefined;
  const normalized = normalizePosix(joinPosix(dirname(mapPath), sourceRoot, source));
  if (normalized === "." || normalized.startsWith("../")) return undefined;
  return normalized;
}

function shouldSkipSource(source) {
  return /^[a-z][a-z\d+.-]*:\/\//i.test(source);
}

async function listFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await listFiles(directory, path)));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

async function mkdirs(...directories) {
  await Promise.all(directories.map((directory) => mkdir(directory, { recursive: true })));
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    failures.push(`${relative(root, path)} is not valid JSON: ${errorMessage(error)}`);
    return {};
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
