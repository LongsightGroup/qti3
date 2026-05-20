#!/usr/bin/env node
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runFixture } from "@qti3/conformance";
import {
  createItemSession,
  deprecatedInteractionSupport,
  elementSupport,
  interactionSupport,
  parseQtiXml,
  processingSupport,
  validateAssessmentItem,
  type QtiValue,
} from "@qti3/core";
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
    const report = await parseDirectory(file);
    console.log(JSON.stringify(report, null, 2));
    return report.failed === 0 ? 0 : 1;
  }

  if (command === "validate" && file) {
    const result = await validateFile(file);
    console.log(JSON.stringify(result, null, 2));
    return result.ok ? 0 : 1;
  }

  if (command === "validate-dir" && file) {
    const report = await validateDirectory(file);
    console.log(JSON.stringify(report, null, 2));
    return report.failed === 0 ? 0 : 1;
  }

  if (command === "score-correct" && file) {
    const result = await scoreCorrectFile(file);
    console.log(JSON.stringify(result, null, 2));
    return result.ok && (!result.scorable || result.scorePositive) ? 0 : 1;
  }

  if (command === "score-correct-dir" && file) {
    const report = await scoreCorrectDirectory(file);
    console.log(JSON.stringify(report, null, 2));
    return report.failed === 0 ? 0 : 1;
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

  if (command === "support-matrix") {
    console.log(
      JSON.stringify(
        {
          target: "QTI 3.0.1 ASI item profile",
          elements: elementSupport,
          interactions: [...interactionSupport, ...deprecatedInteractionSupport],
          processing: processingSupport,
        },
        null,
        2,
      ),
    );
    return 0;
  }

  if (command === "run-fixtures") {
    const report = runCanonicalFixtures();
    console.log(JSON.stringify(report, null, 2));
    return report.failed === 0 ? 0 : 1;
  }

  console.log(
    "Usage: qti3 parse <item.xml> | qti3 parse-dir <directory> | qti3 validate <item.xml> | qti3 validate-dir <directory> | qti3 score-correct <item.xml> | qti3 score-correct-dir <directory> | qti3 write-fixtures <directory> | qti3 support-matrix | qti3 run-fixtures",
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

function runCanonicalFixtures(): {
  checked: number;
  failed: number;
  results: ReturnType<typeof runFixture>[];
} {
  const results = interactionFixtures.map(runFixture);
  return {
    checked: results.length,
    failed: results.filter((result) => !result.ok).length,
    results,
  };
}

async function parseDirectory(root: string): Promise<{
  checked: number;
  failed: number;
  results: {
    file: string;
    ok: boolean;
    diagnostics: ReturnType<typeof parseQtiXml>["diagnostics"];
    interactions: string[];
  }[];
}> {
  const files = await findXmlFiles(root);
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
  return { checked: results.length, failed, results };
}

async function validateDirectory(root: string): Promise<{
  checked: number;
  failed: number;
  results: Awaited<ReturnType<typeof validateFile>>[];
}> {
  const files = await findXmlFiles(root);
  const results = [];
  let failed = 0;
  for (const xmlFile of files) {
    const xml = await readFile(xmlFile, "utf8");
    if (!xml.includes("qti-assessment-item")) continue;
    const result = await validateFile(xmlFile);
    if (!result.ok) failed += 1;
    results.push(result);
  }
  return { checked: results.length, failed, results };
}

async function validateFile(file: string): Promise<{
  file: string;
  ok: boolean;
  diagnostics: ReturnType<typeof parseQtiXml>["diagnostics"];
}> {
  const xml = await readFile(file, "utf8");
  const result = parseQtiXml(xml);
  if (!result.document) {
    return { file, ok: false, diagnostics: result.diagnostics };
  }
  const validation = validateAssessmentItem(result.document);
  const diagnostics = uniqueDiagnostics([...result.diagnostics, ...validation.diagnostics]);
  return {
    file,
    ok: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

function uniqueDiagnostics(
  diagnostics: ReturnType<typeof parseQtiXml>["diagnostics"],
): ReturnType<typeof parseQtiXml>["diagnostics"] {
  const seen = new Set<string>();
  return diagnostics.filter((diagnostic) => {
    const key = `${diagnostic.code}\n${diagnostic.severity}\n${diagnostic.message}\n${diagnostic.path ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function scoreCorrectDirectory(root: string): Promise<{
  checked: number;
  failed: number;
  results: Awaited<ReturnType<typeof scoreCorrectFile>>[];
}> {
  const files = await findXmlFiles(root);
  const results = [];
  let failed = 0;
  for (const xmlFile of files) {
    const xml = await readFile(xmlFile, "utf8");
    if (!xml.includes("qti-assessment-item")) continue;
    const result = await scoreCorrectFile(xmlFile);
    if (!result.ok || (result.scorable && !result.scorePositive)) failed += 1;
    results.push(result);
  }
  return { checked: results.length, failed, results };
}

async function scoreCorrectFile(file: string): Promise<{
  file: string;
  ok: boolean;
  scorable: boolean;
  scorePositive: boolean;
  outcomes: Record<string, QtiValue>;
  diagnostics: ReturnType<typeof parseQtiXml>["diagnostics"];
}> {
  const xml = await readFile(file, "utf8");
  const result = parseQtiXml(xml);
  if (!result.document || !result.ok) {
    return {
      file,
      ok: false,
      scorable: false,
      scorePositive: false,
      outcomes: {},
      diagnostics: result.diagnostics,
    };
  }

  const session = createItemSession(result.document);
  let scorable = false;
  const correctResponses = session.correctResponses();
  for (const declaration of result.document.item.responseDeclarations) {
    const correctResponse = correctResponses[declaration.identifier] ?? null;
    if (correctResponse !== null) {
      scorable = true;
      session.respond(declaration.identifier, correctResponse);
    }
  }
  const scored = session.score();
  return {
    file,
    ok: scored.diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    scorable,
    scorePositive: typeof scored.outcomes.SCORE === "number" && scored.outcomes.SCORE > 0,
    outcomes: scored.outcomes,
    diagnostics: [...result.diagnostics, ...scored.diagnostics],
  };
}
