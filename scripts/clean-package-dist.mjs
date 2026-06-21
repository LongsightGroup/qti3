#!/usr/bin/env node
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const packagesRoot = join(root, "packages");

for (const entry of await readdir(packagesRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const packageRoot = join(packagesRoot, entry.name);
  await rm(join(packageRoot, "dist"), { force: true, recursive: true });
  await rm(join(packageRoot, "tsconfig.tsbuildinfo"), { force: true });
  await rm(join(packageRoot, "tsconfig.test.tsbuildinfo"), { force: true });
}
