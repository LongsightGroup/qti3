import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createItemSession,
  parseQtiXml,
  validateAssessmentItem,
  type QtiValue,
} from "@longsightgroup/qti3-core";
import { canonicalFixtures } from "@longsightgroup/qti3-fixtures";
import { uniqueDiagnostics } from "../diagnostics.js";

/** Parse every assessment item XML file beneath a directory. */
export async function parseDirectory(root: string): Promise<{
  checked: number;
  failed: number;
  results: {
    file: string;
    ok: boolean;
    diagnostics: ReturnType<typeof parseQtiXml>["diagnostics"];
    interactions: string[];
  }[];
}> {
  const sources = await readAssessmentItemSources(root);
  const results = sources.map(({ file, xml }) => {
    const result = parseQtiXml(xml);
    return {
      file,
      ok: result.ok,
      diagnostics: result.diagnostics,
      interactions:
        result.document?.item.interactions.map((interaction) => interaction.qtiName) ?? [],
    };
  });
  return summarizeDirectoryResults(results, (result) => !result.ok);
}

/** Validate every assessment item XML file beneath a directory. */
export async function validateDirectory(root: string): Promise<{
  checked: number;
  failed: number;
  results: Awaited<ReturnType<typeof validateFile>>[];
}> {
  const sources = await readAssessmentItemSources(root);
  const results = sources.map(({ file, xml }) => validateItemSource(file, xml));
  return summarizeDirectoryResults(results, (result) => !result.ok);
}

/** Parse and validate one assessment item file. */
export async function validateFile(file: string): Promise<{
  file: string;
  ok: boolean;
  diagnostics: ReturnType<typeof parseQtiXml>["diagnostics"];
}> {
  return validateItemSource(file, await readFile(file, "utf8"));
}

function validateItemSource(
  file: string,
  xml: string,
): {
  file: string;
  ok: boolean;
  diagnostics: ReturnType<typeof parseQtiXml>["diagnostics"];
} {
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

/** Score every assessment item beneath a directory with its declared correct responses. */
export async function scoreCorrectDirectory(root: string): Promise<{
  checked: number;
  failed: number;
  results: Awaited<ReturnType<typeof scoreCorrectFile>>[];
}> {
  const sources = await readAssessmentItemSources(root);
  const results = sources.map(({ file, xml }) => scoreCorrectItemSource(file, xml));
  return summarizeDirectoryResults(
    results,
    (result) => !result.ok || (result.scorable && !result.scorePositive),
  );
}

/** Score one assessment item with its declared correct responses. */
export async function scoreCorrectFile(file: string): Promise<{
  file: string;
  ok: boolean;
  scorable: boolean;
  scorePositive: boolean;
  outcomes: Record<string, QtiValue>;
  diagnostics: ReturnType<typeof parseQtiXml>["diagnostics"];
}> {
  return scoreCorrectItemSource(file, await readFile(file, "utf8"));
}

function scoreCorrectItemSource(
  file: string,
  xml: string,
): {
  file: string;
  ok: boolean;
  scorable: boolean;
  scorePositive: boolean;
  outcomes: Record<string, QtiValue>;
  diagnostics: ReturnType<typeof parseQtiXml>["diagnostics"];
} {
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

/** Write the canonical public fixture XML documents to a directory. */
export async function writeCanonicalFixtures(directory: string): Promise<{
  written: number;
  files: string[];
}> {
  await mkdir(directory, { recursive: true });
  const written: string[] = [];
  for (const fixture of canonicalFixtures) {
    const filename = `${fixture.id}.xml`;
    const path = join(directory, filename);
    await writeFile(path, `${fixture.xml}\n`, "utf8");
    written.push(path);
  }
  return { written: written.length, files: written };
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

async function readAssessmentItemSources(
  root: string,
): Promise<{ readonly file: string; readonly xml: string }[]> {
  const sources: { file: string; xml: string }[] = [];
  for (const file of await findXmlFiles(root)) {
    const xml = await readFile(file, "utf8");
    if (xml.includes("qti-assessment-item")) sources.push({ file, xml });
  }
  return sources;
}

function summarizeDirectoryResults<T>(
  results: T[],
  isFailed: (result: T) => boolean,
): { checked: number; failed: number; results: T[] } {
  return {
    checked: results.length,
    failed: results.filter(isFailed).length,
    results,
  };
}
