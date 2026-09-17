import { spawnSync } from "node:child_process";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const entry = fileURLToPath(new URL("../dist/index.js", import.meta.url));

it("runs the CLI through a symlink in a path containing spaces", async () => {
  const directory = await mkdtemp(join(tmpdir(), "qti3 CLI "));
  try {
    const bin = join(directory, "qti3");
    await symlink(entry, bin);
    const result = spawnSync(process.execPath, [bin, "assert-support"], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.trim()).not.toBe("");
    const report: unknown = JSON.parse(result.stdout);
    expect(report).toMatchObject({ failed: 0 });

    const invalid = spawnSync(process.execPath, [bin, "unknown-command"], { encoding: "utf8" });
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain("Usage: qti3");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it.each([{ args: [] }, { args: ["nonexistent-cli-entry"] }])(
  "keeps library imports inert with argv $args",
  ({ args }) => {
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `const { main } = await import(${JSON.stringify(new URL("../dist/index.js", import.meta.url).href)}); console.log(typeof main);`,
        ...args,
      ],
      { encoding: "utf8" },
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("function\n");
  },
);
