#!/usr/bin/env node
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";
import { accessibilityProofMatrix, manualAssistiveTechnologyScripts } from "@qti3/a11y";
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
import { StaxXmlParserSync, XmlEventType } from "stax-xml";

interface ZipEntry {
  name: string;
  bytes: Uint8Array;
}

interface PackageXmlNode {
  localName: string;
  attributes: Record<string, string>;
  children: PackageXmlNode[];
}

interface PackageXmlFile {
  path: string;
  xml: string;
  root: PackageXmlNode | undefined;
  errors: string[];
}

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

  if (command === "inspect-package" && file) {
    const report = await inspectPackage(file);
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

  if (command === "a11y-proof") {
    console.log(
      JSON.stringify(
        {
          target: "QTI 3.0.1 ASI item interaction accessibility proof",
          interactions: accessibilityProofMatrix,
          manualAssistiveTechnologyScripts,
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
    "Usage: qti3 parse <item.xml> | qti3 parse-dir <directory> | qti3 validate <item.xml> | qti3 validate-dir <directory> | qti3 score-correct <item.xml> | qti3 score-correct-dir <directory> | qti3 inspect-package <package.zip> | qti3 write-fixtures <directory> | qti3 support-matrix | qti3 a11y-proof | qti3 run-fixtures",
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

async function inspectPackage(file: string): Promise<{
  file: string;
  checked: number;
  failed: number;
  xmlFiles: string[];
  assetFiles: string[];
  discoveredReferences: string[];
  results: {
    file: string;
    source: "assessment-test" | "manifest" | "direct";
    ok: boolean;
    diagnostics: ReturnType<typeof parseQtiXml>["diagnostics"];
    interactions: string[];
  }[];
}> {
  const entries = readZipEntries(await readFile(file));
  const xmlFiles = entries
    .filter((entry) => entry.name.toLowerCase().endsWith(".xml"))
    .map((entry) => parsePackageXml(entry));
  const byPath = new Map(xmlFiles.map((entry) => [entry.path, entry]));
  const itemSources = new Map<string, "assessment-test" | "manifest" | "direct">();
  const discoveredReferences: string[] = [];

  for (const xmlFile of xmlFiles) {
    const rootName = xmlFile.root?.localName;
    const refs =
      rootName === "qti-assessment-test"
        ? assessmentItemRefs(xmlFile)
        : rootName === "manifest"
          ? manifestItemResources(xmlFile)
          : [];
    for (const ref of refs) {
      discoveredReferences.push(ref);
      if (byPath.has(ref) && !itemSources.has(ref)) {
        itemSources.set(ref, rootName === "manifest" ? "manifest" : "assessment-test");
      }
    }
    if (rootName === "qti-assessment-item" && !itemSources.has(xmlFile.path)) {
      itemSources.set(xmlFile.path, "direct");
    }
  }

  const results = [...itemSources.entries()].map(([path, source]) => {
    const xmlFile = byPath.get(path);
    const result = xmlFile ? parseQtiXml(xmlFile.xml) : { ok: false, diagnostics: [] };
    return {
      file: path,
      source,
      ok: result.ok,
      diagnostics: result.diagnostics,
      interactions:
        result.document?.item.interactions.map((interaction) => interaction.qtiName) ?? [],
    };
  });

  return {
    file,
    checked: results.length,
    failed: results.filter((result) => !result.ok).length,
    xmlFiles: xmlFiles.map((entry) => entry.path),
    assetFiles: entries
      .filter((entry) => !entry.name.toLowerCase().endsWith(".xml"))
      .map((entry) => entry.name),
    discoveredReferences,
    results,
  };
}

function readZipEntries(buffer: Uint8Array): ZipEntry[] {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const eocdOffset = findEndOfCentralDirectory(view);
  if (eocdOffset < 0) return [];

  const entryCount = view.getUint16(eocdOffset + 10, true);
  let offset = view.getUint32(eocdOffset + 16, true);
  const entries: ZipEntry[] = [];
  const decoder = new TextDecoder();

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const rawName = buffer.slice(offset + 46, offset + 46 + nameLength);
    const name = normalizePath(decoder.decode(rawName));
    offset += 46 + nameLength + extraLength + commentLength;
    if (!name || name.endsWith("/")) continue;

    const content = zipEntryBytes(buffer, view, localHeaderOffset, compressedSize, method);
    if (content) entries.push({ name, bytes: content });
  }

  return entries;
}

function findEndOfCentralDirectory(view: DataView): number {
  const minimumOffset = Math.max(0, view.byteLength - 65557);
  for (let offset = view.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  return -1;
}

function zipEntryBytes(
  bytes: Uint8Array,
  view: DataView,
  localHeaderOffset: number,
  compressedSize: number,
  method: number,
): Uint8Array | undefined {
  if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) return undefined;
  const nameLength = view.getUint16(localHeaderOffset + 26, true);
  const extraLength = view.getUint16(localHeaderOffset + 28, true);
  const dataOffset = localHeaderOffset + 30 + nameLength + extraLength;
  const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
  if (method === 0) return compressed;
  if (method === 8) return inflateRawSync(compressed);
  return undefined;
}

function parsePackageXml(entry: ZipEntry): PackageXmlFile {
  const xml = new TextDecoder().decode(entry.bytes);
  const parsed = parsePackageXmlTree(xml);
  return { path: entry.name, xml, root: parsed.root, errors: parsed.errors };
}

function parsePackageXmlTree(xml: string): {
  root: PackageXmlNode | undefined;
  errors: string[];
} {
  const parser = new StaxXmlParserSync(xml, { autoDecodeEntities: true });
  const stack: PackageXmlNode[] = [];
  const errors: string[] = [];
  let root: PackageXmlNode | undefined;

  for (const event of parser) {
    if (event.type === XmlEventType.ERROR) {
      errors.push(event.error.message);
      continue;
    }
    if (event.type !== XmlEventType.START_ELEMENT && event.type !== XmlEventType.END_ELEMENT) {
      continue;
    }
    if (event.type === XmlEventType.END_ELEMENT) {
      stack.pop();
      continue;
    }

    const node: PackageXmlNode = {
      localName: event.localName ?? event.name,
      attributes: event.attributes,
      children: [],
    };
    const parent = stack.at(-1);
    if (parent) parent.children.push(node);
    else root = node;
    stack.push(node);
  }

  return { root, errors };
}

function assessmentItemRefs(xmlFile: PackageXmlFile): string[] {
  return descendants(xmlFile.root, "qti-assessment-item-ref")
    .map((node) => node.attributes.href ?? "")
    .filter(Boolean)
    .map((href) => resolveRelativePath(xmlFile.path, href));
}

function manifestItemResources(xmlFile: PackageXmlFile): string[] {
  return descendants(xmlFile.root, "resource")
    .filter((node) => isQtiItemResource(node.attributes.type ?? ""))
    .map((node) => resourceHref(node))
    .filter(Boolean)
    .map((href) => resolveRelativePath(xmlFile.path, href));
}

function isQtiItemResource(type: string): boolean {
  return type.toLowerCase().startsWith("imsqti_item_xmlv3p0");
}

function resourceHref(resource: PackageXmlNode): string {
  const href = resource.attributes.href;
  if (href) return href;
  const file = descendants(resource, "file").find((node) => {
    return (node.attributes.href ?? "").toLowerCase().endsWith(".xml");
  });
  return file?.attributes.href ?? "";
}

function descendants(node: PackageXmlNode | undefined, localName: string): PackageXmlNode[] {
  if (!node) return [];
  const found: PackageXmlNode[] = [];
  for (const child of node.children) {
    if (child.localName === localName) found.push(child);
    found.push(...descendants(child, localName));
  }
  return found;
}

function resolveRelativePath(from: string, href: string): string {
  const base = from.includes("/") ? from.slice(0, from.lastIndexOf("/") + 1) : "";
  return normalizePath(`${base}${href}`);
}

function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}
