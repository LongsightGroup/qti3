import { readFileSync, writeFileSync } from "node:fs";

const sourceUrl = "https://www.imsglobal.org/sites/default/files/spec/qti/v3/info/index.html";
const htmlPath = process.argv[2];
const outputPath = process.argv[3] ?? "packages/conformance/src/information-model-inventory.ts";

if (!htmlPath) {
  console.error("Usage: node scripts/extract-qti-information-model.mjs <index.html> [output.ts]");
  process.exit(1);
}

const html = readFileSync(htmlPath, "utf8");
const date = html.match(/<meta name="date" content="([^"]+)"/u)?.[1];
if (date !== "1st May 2022") {
  throw new Error(`Expected the 1 May 2022 information model, found date ${date ?? "missing"}.`);
}

const entries = [];
const seen = new Set();
for (const match of html.matchAll(/<p class="tocLevel\d">(.*?)<\/p>/gsu)) {
  const inner = match[1];
  if (!inner) continue;
  const anchorMatch = inner.match(/href="#([^"]+)"/u);
  const anchor = anchorMatch ? anchorMatch[1] : undefined;
  const text = decodeHtml(inner.replace(/<[^>]+>/gu, ""))
    .replace(/\s+/gu, " ")
    .trim();
  const numbered = text.match(/^(\d+(?:\.\d+)*)(?:\.)?\s+(.*)$/u);
  if (!numbered) continue;
  const id = numbered[1];
  const title = numbered[2];
  if (!id || !title || !anchor) {
    throw new Error(`TOC entry is missing an id, title, or anchor: ${text}`);
  }
  if (seen.has(id)) throw new Error(`Duplicate information-model section ${id}`);
  seen.add(id);
  entries.push({ id, title, kind: kindFor(id, title), anchor });
}

if (entries.length < 1500) {
  throw new Error(`Expected the information-model TOC, extracted ${entries.length} sections.`);
}

const lines = entries.map(
  (entry) =>
    `  { id: ${JSON.stringify(entry.id)}, title: ${JSON.stringify(entry.title)}, kind: ${JSON.stringify(entry.kind)}, anchor: ${JSON.stringify(entry.anchor)} },`,
);

const output = `// Generated from the QTI 3.0 ASI information model table of contents.
// Source: ${sourceUrl}
// Date: 1st May 2022. IMS Final Release Version 1.0.
// Regenerate: node scripts/extract-qti-information-model.mjs <index.html>
import type { QtiInformationModelEntry } from "./information-model.js";

export const qtiInformationModelSource = {
  document:
    "IMS Question and Test Interoperability (QTI): Assessment, Section and Item Information Model Version 3.0",
  url: ${JSON.stringify(sourceUrl)},
  date: "1st May 2022",
  release: "IMS Final Release Version 1.0",
  entryCount: ${entries.length},
} as const;

export const qtiInformationModelInventory = [
${lines.join("\n")}
] as const satisfies readonly QtiInformationModelEntry[];
`;

writeFileSync(outputPath, output);
console.log(`Wrote ${entries.length} sections to ${outputPath}`);

function kindFor(id, title) {
  if (title.endsWith("Class Description")) return "class";
  if (title.endsWith("Characteristic Description")) return "characteristic";
  if (title.endsWith("Attribute Description")) return "attribute";
  if (title.endsWith("Vocabulary Description")) return "vocabulary";
  if (!id.includes(".")) return "part";
  return "behavior";
}

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'");
}
