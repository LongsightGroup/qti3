#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

if (!existsSync(".git")) {
  process.exit(0);
}

try {
  execFileSync("git", ["config", "--get", "core.hooksPath"], { stdio: "ignore" });
} catch {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], { stdio: "inherit" });
}
