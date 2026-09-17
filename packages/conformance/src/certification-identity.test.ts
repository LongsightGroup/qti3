import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { captureCertificationIdentity } from "./certification-identity.js";

const execute = promisify(execFile);
describe("certification input identity", () => {
  it("records actual revision and bytes and detects changed fixture inputs", async () => {
    const root = await mkdtemp(join(tmpdir(), "qti-identity-"));
    try {
      const workbook = "Synthetic workbook bytes";
      await writeFile(join(root, "QTI 3 IMPORT Certification Checklist.xlsx"), workbook);
      await writeFile(join(root, "package.zip"), "synthetic package");
      await execute("git", ["-C", root, "init", "-b", "codex-identity-test"]);
      await execute("git", ["-C", root, "add", "."]);
      await execute("git", [
        "-C",
        root,
        "-c",
        "user.name=Synthetic Test",
        "-c",
        "user.email=synthetic@example.invalid",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "-m",
        "Synthetic input snapshot",
      ]);
      const before = await captureCertificationIdentity(root, ["package.zip"]);
      expect(before.source).toMatchObject({
        inputsUnchanged: true,
        matchesReviewedSource: false,
        workbookSha256: createHash("sha256").update(workbook).digest("hex"),
      });
      expect(before.source.revision).toMatch(/^[a-f0-9]{40}$/);
      expect(before.producer.runtimeSha256).toMatch(/^[a-f0-9]{64}$/);
      await writeFile(join(root, "package.zip"), "changed package");
      const after = await captureCertificationIdentity(root, ["package.zip"]);
      expect(after.source).toMatchObject({
        revision: before.source.revision,
        inputsUnchanged: false,
        matchesReviewedSource: false,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("does not attribute missing input to the pinned official revision", async () => {
    const result = await captureCertificationIdentity("/nonexistent-qti-source", []);
    expect(result.source).toMatchObject({
      revision: undefined,
      workbookSha256: undefined,
      inputsUnchanged: false,
      matchesReviewedSource: false,
    });
  });
});
