import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseQtiXml } from "@qti3/core";
import { describe, expect, it } from "vitest";

const externalDir = process.env.QTI3_EXTERNAL_QTI_DIR;
const runIfConfigured = externalDir ? describe : describe.skip;

runIfConfigured("@qti3/conformance external QTI directory", () => {
  it("parses every XML assessment item under QTI3_EXTERNAL_QTI_DIR", async () => {
    const files = await findXmlFiles(externalDir!);
    expect(files.length).toBeGreaterThan(0);

    const failures: string[] = [];
    for (const file of files) {
      const xml = await readFile(file, "utf8");
      if (!xml.includes("qti-assessment-item")) continue;
      const result = parseQtiXml(xml);
      if (!result.ok) {
        failures.push(
          `${file}: ${result.diagnostics.map((diagnostic) => diagnostic.message).join("; ")}`,
        );
      }
    }

    expect(failures).toEqual([]);
  });
});

async function findXmlFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await findXmlFiles(path)));
    else if (entry.isFile() && entry.name.endsWith(".xml")) files.push(path);
  }
  return files;
}
