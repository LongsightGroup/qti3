#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { runFixture } from "@qti3/conformance";
import { parseQtiXml } from "@qti3/core";

export async function main(args = process.argv.slice(2)): Promise<number> {
  const [command, file] = args;
  if (command === "parse" && file) {
    const xml = await readFile(file, "utf8");
    const result = parseQtiXml(xml);
    console.log(JSON.stringify(result, null, 2));
    return result.ok ? 0 : 1;
  }

  if (command === "fixture" && file) {
    const module = await import(file);
    const result = runFixture(module.default);
    console.log(JSON.stringify(result, null, 2));
    return result.ok ? 0 : 1;
  }

  console.log("Usage: qti3 parse <item.xml>");
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await main();
}
