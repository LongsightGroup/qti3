#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const prohibitedLicensePattern = /\b(A?GPL|GPL|AGPL)\b/i;
const coreProhibitedDependencies = new Set([
  "@angular/core",
  "@lit/reactive-element",
  "@preact/signals",
  "axios",
  "got",
  "jquery",
  "lit",
  "preact",
  "react",
  "react-dom",
  "solid-js",
  "svelte",
  "vue",
]);

const failures = [];

await checkWorkspaceRuntimeDependencies();
await checkInstalledPackageLicenses();

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
}

async function checkWorkspaceRuntimeDependencies() {
  const corePackage = await readJson(join(root, "packages/core/package.json"));
  const dependencies = Object.keys(corePackage.dependencies ?? {});
  for (const dependency of dependencies) {
    if (coreProhibitedDependencies.has(dependency)) {
      failures.push(`@qti3/core may not depend on prohibited runtime package ${dependency}.`);
    }
  }
}

async function checkInstalledPackageLicenses() {
  const manifests = await installedPackageManifests(join(root, "node_modules"));
  for (const manifestPath of manifests) {
    const manifest = await readJson(manifestPath);
    const licenseText = licenseString(manifest.license);
    if (prohibitedLicensePattern.test(licenseText)) {
      failures.push(
        `${manifest.name ?? relative(root, manifestPath)} has prohibited license ${licenseText}.`,
      );
    }
  }
}

async function installedPackageManifests(nodeModulesPath) {
  const manifests = [];
  for (const entry of await safeReadDir(nodeModulesPath)) {
    if (entry.name === ".pnpm") {
      const path = join(nodeModulesPath, entry.name);
      manifests.push(...(await pnpmStoreManifests(path)));
      continue;
    }
    if (entry.name.startsWith(".")) continue;
    const path = join(nodeModulesPath, entry.name);
    if (entry.name.startsWith("@") && entry.isDirectory()) {
      for (const scopedEntry of await safeReadDir(path)) {
        manifests.push(join(path, scopedEntry.name, "package.json"));
      }
      continue;
    }
    if (entry.isDirectory() || entry.isSymbolicLink()) {
      manifests.push(join(path, "package.json"));
    }
  }
  return manifests;
}

async function pnpmStoreManifests(storePath) {
  const manifests = [];
  for (const entry of await safeReadDir(storePath)) {
    const packageRoot = join(storePath, entry.name, "node_modules");
    for (const packageEntry of await safeReadDir(packageRoot)) {
      const path = join(packageRoot, packageEntry.name);
      if (packageEntry.name.startsWith("@") && packageEntry.isDirectory()) {
        for (const scopedEntry of await safeReadDir(path)) {
          manifests.push(join(path, scopedEntry.name, "package.json"));
        }
        continue;
      }
      manifests.push(join(path, "package.json"));
    }
  }
  return manifests;
}

async function safeReadDir(path) {
  try {
    return await readdir(path, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return {};
  }
}

function licenseString(license) {
  if (typeof license === "string") return license;
  if (Array.isArray(license)) return license.map(licenseString).join(" OR ");
  if (license && typeof license === "object" && typeof license.type === "string") {
    return license.type;
  }
  return "UNLICENSED";
}
