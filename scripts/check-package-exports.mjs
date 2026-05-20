#!/usr/bin/env node
import { access, readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = new URL("..", import.meta.url).pathname;
const packagesRoot = join(root, "packages");
const failures = [];

for (const entry of await readdir(packagesRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const packageRoot = join(packagesRoot, entry.name);
  const manifestPath = join(packageRoot, "package.json");
  const manifest = await readJson(manifestPath);
  if (!manifest.name) continue;

  await checkExportMap(packageRoot, manifest);
  await checkBin(packageRoot, manifest);
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
}

async function checkExportMap(packageRoot, manifest) {
  for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
    if (typeof target === "string") {
      await assertExportFile(packageRoot, target, `${manifest.name} export ${subpath}`);
      continue;
    }
    if (target && typeof target === "object") {
      if (typeof target.import === "string") {
        await assertExportFile(
          packageRoot,
          target.import,
          `${manifest.name} export ${subpath} import`,
        );
      }
      if (typeof target.types === "string") {
        await assertFile(packageRoot, target.types, `${manifest.name} export ${subpath} types`);
      }
    }
  }
}

async function checkBin(packageRoot, manifest) {
  for (const [name, target] of Object.entries(manifest.bin ?? {})) {
    if (typeof target === "string") {
      await assertFile(packageRoot, target, `${manifest.name} bin ${name}`);
    }
  }
}

async function assertExportFile(packageRoot, path, label) {
  if (path.includes("*")) {
    const prefix = path.slice(0, path.indexOf("*"));
    const directory = join(packageRoot, prefix);
    try {
      const files = await readdir(directory);
      if (files.length === 0) failures.push(`${label} wildcard has no files.`);
    } catch {
      failures.push(`${label} wildcard points to missing directory ${relative(root, directory)}.`);
    }
    return;
  }

  await assertFile(packageRoot, path, label);
  if (path.endsWith(".js")) {
    await assertImportable(packageRoot, path, label);
  }
}

async function assertImportable(packageRoot, path, label) {
  try {
    await import(pathToFileURL(resolve(packageRoot, path)).href);
  } catch (error) {
    failures.push(`${label} failed to import: ${errorMessage(error)}`);
  }
}

async function assertFile(packageRoot, path, label) {
  try {
    await access(join(packageRoot, path));
  } catch {
    failures.push(`${label} points to missing file ${relative(root, join(packageRoot, path))}.`);
  }
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return {};
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
