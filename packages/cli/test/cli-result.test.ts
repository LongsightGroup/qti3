import { describe, expect, it } from "vitest";
import { runFileSystemCommand } from "../src/cli-result.js";

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
});
