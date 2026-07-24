#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const schemaRoot = join(root, "packages", "conformance", "schemas", "legacy");
const manifestPath = join(schemaRoot, "SHA256.json");
const files = await schemaFiles(schemaRoot);
const observed = Object.fromEntries(
  await Promise.all(
    files.map(async (path) => [
      relative(schemaRoot, path),
      createHash("sha256")
        .update(await readFile(path))
        .digest("hex"),
    ]),
  ),
);

if (process.argv.includes("--write")) {
  await writeFile(manifestPath, `${JSON.stringify(observed, undefined, 2)}\n`, "utf8");
  console.log(`Recorded ${String(files.length)} vendored schema hashes.`);
} else {
  const expected = JSON.parse(await readFile(manifestPath, "utf8"));
  if (JSON.stringify(expected) !== JSON.stringify(observed)) {
    throw new Error(
      "Vendored QTI schema closure differs from packages/conformance/schemas/legacy/SHA256.json.",
    );
  }
  console.log(`Verified ${String(files.length)} vendored schema hashes.`);
}

async function schemaFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => entry.name !== "SHA256.json")
      .map((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? schemaFiles(path) : [path];
      }),
  );
  return nested.flat().toSorted();
}
