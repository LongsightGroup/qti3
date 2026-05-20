#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const policy = await readJson(join(root, "scripts/dependency-policy.json"));
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

await checkPackageManager();
await checkDirectDependencies();
await checkLockfilePackages();
await checkWorkspaceRuntimeDependencies();
await checkInstalledPackageLicenses();

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
}

async function checkPackageManager() {
  const rootPackage = await readJson(join(root, "package.json"));
  if (rootPackage.packageManager !== policy.packageManager) {
    failures.push(
      `Root packageManager must be ${policy.packageManager}; got ${rootPackage.packageManager ?? "(missing)"}.`,
    );
  }
}

async function checkDirectDependencies() {
  const expectedByImporter = policy.directDependencies ?? {};
  const actualImporters = new Set([
    ".",
    ...(await workspaceImporters("packages")),
    ...(await workspaceImporters("examples")),
  ]);
  for (const importer of [...actualImporters].sort()) {
    if (!expectedByImporter[importer]) {
      failures.push(
        `${importer} is not listed in scripts/dependency-policy.json directDependencies.`,
      );
    }
  }
  for (const [importer, expected] of Object.entries(expectedByImporter)) {
    const manifest = await readJson(join(root, importer, "package.json"));
    if (!actualImporters.has(importer)) {
      failures.push(`${importer} is listed in dependency policy but has no package.json.`);
      continue;
    }
    assertDependencyBlock(
      importer,
      "dependencies",
      manifest.dependencies ?? {},
      expected.dependencies ?? {},
    );
    assertDependencyBlock(
      importer,
      "devDependencies",
      manifest.devDependencies ?? {},
      expected.devDependencies ?? {},
    );
    assertDependencyBlock(
      importer,
      "peerDependencies",
      manifest.peerDependencies ?? {},
      expected.peerDependencies ?? {},
    );
    assertDependencyBlock(
      importer,
      "optionalDependencies",
      manifest.optionalDependencies ?? {},
      expected.optionalDependencies ?? {},
    );
  }
}

async function workspaceImporters(directoryName) {
  const directory = join(root, directoryName);
  const importers = [];
  for (const entry of await safeReadDir(directory)) {
    if (!entry.isDirectory()) continue;
    const importer = `${directoryName}/${entry.name}`;
    const manifest = await readJson(join(root, importer, "package.json"));
    if (manifest.name || manifest.dependencies || manifest.devDependencies)
      importers.push(importer);
  }
  return importers;
}

function assertDependencyBlock(importer, blockName, actual, expected) {
  const actualEntries = sortedEntries(actual);
  const expectedEntries = sortedEntries(expected);
  if (JSON.stringify(actualEntries) === JSON.stringify(expectedEntries)) return;

  failures.push(
    `${importer} ${blockName} changed. Update scripts/dependency-policy.json only after dependency review. Expected ${formatEntries(expectedEntries)}; got ${formatEntries(actualEntries)}.`,
  );
}

async function checkLockfilePackages() {
  const expected = new Set(policy.lockfilePackages ?? []);
  const actual = new Set(lockfilePackageKeys(await readFile(join(root, "pnpm-lock.yaml"), "utf8")));

  for (const key of [...actual].sort()) {
    if (!expected.has(key)) {
      failures.push(
        `pnpm-lock.yaml contains unreviewed package ${key}. Update scripts/dependency-policy.json only after dependency review.`,
      );
    }
  }
  for (const key of [...expected].sort()) {
    if (!actual.has(key)) {
      failures.push(
        `Dependency policy allows ${key}, but it is no longer present in pnpm-lock.yaml.`,
      );
    }
  }
}

async function checkWorkspaceRuntimeDependencies() {
  const corePackage = await readJson(join(root, "packages/core/package.json"));
  const dependencies = Object.keys(corePackage.dependencies ?? {});
  for (const dependency of dependencies) {
    if (coreProhibitedDependencies.has(dependency)) {
      failures.push(
        `@longsightgroup/qti3-core may not depend on prohibited runtime package ${dependency}.`,
      );
    }
  }
}

function lockfilePackageKeys(lockfile) {
  const keys = [];
  let inPackages = false;
  for (const line of lockfile.split("\n")) {
    if (line === "packages:") {
      inPackages = true;
      continue;
    }
    if (!inPackages) continue;
    if (/^[A-Za-z]/.test(line)) break;
    const match = line.match(/^  ('[^']+'|[^\s].*):$/);
    if (match) keys.push(match[1].replace(/^'|'$/g, ""));
  }
  return keys.sort();
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

function sortedEntries(record) {
  return Object.entries(record).sort(([left], [right]) => left.localeCompare(right));
}

function formatEntries(entries) {
  if (entries.length === 0) return "{}";
  return `{ ${entries.map(([name, version]) => `${name}: ${version}`).join(", ")} }`;
}
