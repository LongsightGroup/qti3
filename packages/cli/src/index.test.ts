import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseQtiXml } from "@qti3/core";
import { interactionFixtures } from "@qti3/fixtures";
import { describe, expect, it } from "vitest";
import { main } from "./index.js";

describe("@qti3/cli", () => {
  it("writes standalone reference XML fixtures", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-fixtures-"));
    try {
      await expect(main(["write-fixtures", directory])).resolves.toBe(0);

      for (const fixture of interactionFixtures) {
        const xml = await readFile(join(directory, `${fixture.id}.xml`), "utf8");
        const result = parseQtiXml(xml);
        expect(result.ok, fixture.id).toBe(true);
        expect(result.document?.item.interactions[0]?.type).toBe(fixture.interactionType);
      }

      await expect(main(["validate-dir", directory])).resolves.toBe(0);
      await expect(main(["score-correct-dir", directory])).resolves.toBe(0);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("prints the support matrix", async () => {
    await expect(main(["support-matrix"])).resolves.toBe(0);
  });
});
