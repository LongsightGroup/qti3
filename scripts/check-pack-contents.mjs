#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { join, relative } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = new URL("..", import.meta.url).pathname;
const packagesRoot = join(root, "packages");
const failures = [];

for (const entry of await readdir(packagesRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;

  const packageRoot = join(packagesRoot, entry.name);
  const manifest = await readJson(join(packageRoot, "package.json"));
  if (!manifest.name) continue;

  assertFilesManifest(entry.name, manifest);
  await assertPackContents(entry.name, packageRoot, manifest);
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
}

function assertFilesManifest(packageDirectory, manifest) {
  const expected =
    packageDirectory === "fixtures"
      ? ["dist", "!dist/*.test.*", "xml"]
      : ["dist", "!dist/*.test.*"];
  const actual = manifest.files ?? [];
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(
      `${manifest.name} package.json files must be ${JSON.stringify(expected)}; got ${JSON.stringify(actual)}.`,
    );
  }
}

async function assertPackContents(packageDirectory, packageRoot, manifest) {
  const { stdout } = await runPnpm(["pack", "--dry-run", "--json"], packageRoot);
  const pack = parsePackJson(stdout, manifest.name);
  if (!pack) return;

  for (const file of pack.files ?? []) {
    const path = file.path;
    if (typeof path !== "string") {
      failures.push(`${manifest.name} pack output contained a file entry without a string path.`);
      continue;
    }

    if (isUnsafePath(path)) {
      failures.push(`${manifest.name} pack output contained unsafe path ${path}.`);
      continue;
    }

    if (!isAllowedPackPath(packageDirectory, path)) {
      failures.push(`${manifest.name} package includes unexpected file ${path}.`);
    }
  }
}

function isUnsafePath(path) {
  return path.startsWith("/") || path.includes("\\") || path.split("/").includes("..");
}

function isAllowedPackPath(packageDirectory, path) {
  if (path === "package.json") return true;
  if (path.startsWith("dist/")) return isAllowedDistPath(path);
  if (packageDirectory === "fixtures" && path.startsWith("xml/")) return path.endsWith(".xml");
  return false;
}

function isAllowedDistPath(path) {
  if (path.includes(".test.")) return false;
  return (
    path.endsWith(".js") ||
    path.endsWith(".js.map") ||
    path.endsWith(".d.ts") ||
    path.endsWith(".d.ts.map")
  );
}

async function runPnpm(args, cwd) {
  const npmExecPath = process.env.npm_execpath;
  const command = npmExecPath?.includes("pnpm") ? process.execPath : "pnpm";
  const commandArgs = npmExecPath?.includes("pnpm") ? [npmExecPath, ...args] : args;

  try {
    return await execFileAsync(command, commandArgs, {
      cwd,
      maxBuffer: 1024 * 1024 * 10,
    });
  } catch (error) {
    failures.push(
      `pnpm ${args.join(" ")} failed in ${relative(root, cwd)}: ${errorMessage(error)}`,
    );
    return { stdout: "" };
  }
}

function parsePackJson(stdout, packageName) {
  const text = stdout.trim();
  const candidates = [text.indexOf("{"), text.indexOf("[")]
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);
  for (const index of candidates) {
    try {
      const parsed = JSON.parse(text.slice(index));
      return Array.isArray(parsed) ? parsed[0] : parsed;
    } catch {
      // Try the next plausible JSON start.
    }
  }

  failures.push(`${packageName} produced non-JSON pack output.`);
  return undefined;
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
