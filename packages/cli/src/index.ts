#!/usr/bin/env node
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseQtiXml } from "@qti3/core";
import { interactionFixtures } from "@qti3/fixtures";

export async function main(args = process.argv.slice(2)): Promise<number> {
  const [command, file] = args;
  if (command === "parse" && file) {
    const xml = await readFile(file, "utf8");
    const result = parseQtiXml(xml);
    console.log(JSON.stringify(result, null, 2));
    return result.ok ? 0 : 1;
  }

  if (command === "parse-dir" && file) {
    const files = await findXmlFiles(file);
    const results = [];
    let failed = 0;
    for (const xmlFile of files) {
      const xml = await readFile(xmlFile, "utf8");
      if (!xml.includes("qti-assessment-item")) continue;
      const result = parseQtiXml(xml);
      if (!result.ok) failed += 1;
      results.push({
        file: xmlFile,
        ok: result.ok,
        diagnostics: result.diagnostics,
        interactions:
          result.document?.item.interactions.map((interaction) => interaction.qtiName) ?? [],
      });
    }
    console.log(JSON.stringify({ checked: results.length, failed, results }, null, 2));
    return failed === 0 ? 0 : 1;
  }

  if (command === "write-fixtures" && file) {
    await mkdir(file, { recursive: true });
    const written: string[] = [];
    for (const fixture of interactionFixtures) {
      const filename = `${fixture.id}.xml`;
      const path = join(file, filename);
      await writeFile(path, `${fixture.xml}\n`, "utf8");
      written.push(path);
    }
    console.log(JSON.stringify({ written: written.length, files: written }, null, 2));
    return 0;
  }

  console.log(
    "Usage: qti3 parse <item.xml> | qti3 parse-dir <directory> | qti3 write-fixtures <directory>",
  );
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await main();
}

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
