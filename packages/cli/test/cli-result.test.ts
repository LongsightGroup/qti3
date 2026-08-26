import { describe, expect, it } from "vitest";
import { isMissingPathError } from "../src/cli-io.js";
import { runFileSystemCommand } from "../src/cli-result.js";
import { lastStderr, runCli } from "./cli-harness.js";

describe("CLI result handling", () => {
  it("preserves coded defects instead of rendering them as filesystem failures", async () => {
    const defect = Object.assign(new Error("internal invariant failed"), {
      code: "ERR_ASSERTION",
    });

    await expect(
      runFileSystemCommand(async () => {
        throw defect;
      }),
    ).rejects.toBe(defect);
  });

  it("distinguishes missing paths from other filesystem failures", () => {
    const missing = Object.assign(new Error("missing"), { code: "ENOENT", syscall: "stat" });
    const denied = Object.assign(new Error("denied"), { code: "EACCES", syscall: "stat" });

    expect(isMissingPathError(missing)).toBe(true);
    expect(isMissingPathError(denied)).toBe(false);
  });

  it.each([
    ["parse", ["parse"], "Usage: qti3 parse <item.xml>"],
    ["parse-dir", ["parse-dir"], "Usage: qti3 parse-dir <directory>"],
    ["validate", ["validate"], "Usage: qti3 validate <item.xml>"],
    ["validate-dir", ["validate-dir"], "Usage: qti3 validate-dir <directory>"],
    ["score-correct", ["score-correct"], "Usage: qti3 score-correct <item.xml>"],
    ["score-correct-dir", ["score-correct-dir"], "Usage: qti3 score-correct-dir <directory>"],
    ["inspect-package", ["inspect-package"], "Usage: qti3 inspect-package <package.zip|directory>"],
    [
      "validate-package",
      ["validate-package"],
      "Usage: qti3 validate-package <package.zip|directory>",
    ],
    ["write-fixtures", ["write-fixtures"], "Usage: qti3 write-fixtures <directory>"],
  ])("writes targeted %s usage to stderr", async (_name, args, usage) => {
    const { code, output } = await runCli(args);

    expect(code).toBe(1);
    expect(output.stdout).toEqual([]);
    expect(output.stderr).toEqual([usage]);
  });

  it.each([
    { name: "no command", args: [] },
    { name: "an unknown command", args: ["unknown-command"] },
    { name: "an unknown certification profile", args: ["certification", "unknown-profile"] },
  ])("writes general or command-family usage to stderr for $name", async ({ args }) => {
    const { code, output } = await runCli(args);

    expect(code).toBe(1);
    expect(output.stdout).toEqual([]);
    expect(lastStderr(output)).toMatch(/^Usage: qti3 /);
  });
});
