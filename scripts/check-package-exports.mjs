#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { access, mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
  const tempRoot = await mkdtemp(join(tmpdir(), "qti3-package-export-check-"));
  try {
    const packDirectory = join(tempRoot, "pack");
    const extractDirectory = join(tempRoot, "extract");
    await mkdir(packDirectory, { recursive: true });
    await mkdir(extractDirectory, { recursive: true });
    execFileSync("pnpm", ["--dir", packageRoot, "pack", "--pack-destination", packDirectory], {
      cwd: root,
      stdio: "pipe",
    });

    const tarballs = (await readdir(packDirectory)).filter((file) => file.endsWith(".tgz"));
    if (tarballs.length !== 1) {
      failures.push(
        `${manifest.name} generated ${tarballs.length} tarballs while checking exports.`,
      );
      return;
    }

    execFileSync("tar", ["-xzf", join(packDirectory, tarballs[0]), "-C", extractDirectory], {
      stdio: "pipe",
    });

    const packageDirectory = join(extractDirectory, "package");
    await checkExportMap(packageDirectory, manifest);
    await checkBin(packageDirectory, manifest);
    await checkDistRelativeImports(packageDirectory, manifest);
    await checkWorkspaceImport(packageRoot, manifest);
  } finally {
    await rm(tempRoot, { force: true, recursive: true });
  }
}

async function checkExportMap(packageDirectory, manifest) {
  for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
    if (typeof target === "string") {
      await assertExportFile(packageDirectory, target, `${manifest.name} export ${subpath}`);
      continue;
    }
    if (target && typeof target === "object") {
      if (typeof target.import === "string") {
        await assertExportFile(
          packageDirectory,
          target.import,
          `${manifest.name} export ${subpath} import`,
        );
      }
      if (typeof target.types === "string") {
        await assertFile(
          packageDirectory,
          target.types,
          `${manifest.name} export ${subpath} types`,
        );
      }
    }
  }
}

async function checkBin(packageDirectory, manifest) {
  for (const [name, target] of Object.entries(manifest.bin ?? {})) {
    if (typeof target === "string") {
      await assertFile(packageDirectory, target, `${manifest.name} bin ${name}`);
    }
  }
}

async function checkDistRelativeImports(packageDirectory, manifest) {
  const distDirectory = join(packageDirectory, "dist");
  try {
    await access(distDirectory);
  } catch {
    return;
  }

  for (const distPath of await listFiles(distDirectory)) {
    if (!distPath.endsWith(".js")) continue;
    const content = await readFile(join(distDirectory, distPath), "utf8");
    for (const match of content.matchAll(/from\s+["'](\.\/[^"']+)["']/g)) {
      const importPath = match[1];
      const resolvedPath = resolve(distDirectory, distPath, "..", importPath);
      try {
        await access(resolvedPath);
      } catch {
        failures.push(
          `${manifest.name} packed dist/${distPath} imports missing file ${importPath}.`,
        );
      }
    }
  }
}

async function assertExportFile(packageDirectory, path, label) {
  if (path.includes("*")) {
    const prefix = path.slice(0, path.indexOf("*"));
    const directory = join(packageDirectory, prefix);
    try {
      const files = await readdir(directory);
      if (files.length === 0) failures.push(`${label} wildcard has no files.`);
    } catch {
      failures.push(`${label} wildcard points to missing directory ${relative(root, directory)}.`);
    }
    return;
  }

  await assertFile(packageDirectory, path, label);
}

async function checkWorkspaceImport(packageRoot, manifest) {
  for (const target of collectImportExportPaths(manifest.exports)) {
    if (!target.endsWith(".js")) continue;
    await assertImportable(packageRoot, target, `${manifest.name} export ${target}`);
  }
}

function collectImportExportPaths(exportsMap) {
  const paths = [];
  for (const target of Object.values(exportsMap ?? {})) {
    if (typeof target === "string") {
      paths.push(target);
      continue;
    }
    if (target && typeof target === "object" && typeof target.import === "string") {
      paths.push(target.import);
    }
  }
  return paths;
}

async function assertImportable(packageDirectory, path, label) {
  try {
    await import(pathToFileURL(resolve(packageDirectory, path)).href);
  } catch (error) {
    failures.push(`${label} failed to import: ${errorMessage(error)}`);
  }
}

async function assertFile(packageDirectory, path, label) {
  try {
    await access(join(packageDirectory, path));
  } catch {
    failures.push(
      `${label} points to missing file ${relative(root, join(packageDirectory, path))}.`,
    );
  }
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
