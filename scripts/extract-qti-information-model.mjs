import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const sourceUrl =
  "https://www.imsglobal.org/sites/default/files/spec/qti/v3/info/imsqti_asi_v3p0p1_infomodel_v1p0.html";
const htmlPath = process.argv[2];
const outputPath =
  process.argv.slice(3).find((argument) => argument !== "--check") ??
  "packages/conformance/src/information-model-inventory.ts";

if (!htmlPath) {
  console.error("Usage: node scripts/extract-qti-information-model.mjs <index.html> [output.ts]");
  process.exit(1);
}

const html = readFileSync(htmlPath, "utf8");
const sha256 = createHash("sha256").update(html).digest("hex");
if (sha256 !== "dde409f5d4266480457edbad98e8cf6e1bc7c831ff6be2fbc348038642f0b3c6") {
  throw new Error("Source digest changed. Review the versioned document before updating the pin.");
}
const date = html.match(/<meta name="date" content="([^"]+)"/u)?.[1];
if (date !== "1st September 2024") {
  throw new Error(
    `Expected the 1 September 2024 information model, found date ${date ?? "missing"}.`,
  );
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
  const numbered = text.match(/^([A-Z]?\d+(?:\.\d+)*)(?:\.)?\s+(.*)$/u);
  const id = numbered?.[1] ?? anchor;
  const title = numbered?.[2] ?? text;
  if (!id || !title || !anchor) {
    throw new Error(`TOC entry is missing an id, title, or anchor: ${text}`);
  }
  if (seen.has(id)) throw new Error(`Duplicate information-model section ${id}`);
  seen.add(id);
  entries.push({ id, title, kind: kindFor(id, title), anchor });
}

if (entries.length !== 1921) {
  throw new Error(`Expected the information-model TOC, extracted ${entries.length} sections.`);
}

const lines = entries.map(
  (entry) =>
    `  { id: ${JSON.stringify(entry.id)}, title: ${JSON.stringify(entry.title)}, kind: ${JSON.stringify(entry.kind)}, anchor: ${JSON.stringify(entry.anchor)} },`,
);

const output = `// Generated from the QTI 3.0.1 ASI information model table of contents.
// Source: ${sourceUrl}
// Date: 1st September 2024. 1EdTech Final Release Version 1.0.
// Regenerate: node scripts/extract-qti-information-model.mjs <index.html>
import type { QtiInformationModelEntry } from "./information-model.js";

/** Exact normative document used to enumerate sections; headings are not compliance evidence. */
export const qtiInformationModelSource = {
  document:
    "1EdTech Question and Test Interoperability (QTI): Assessment, Section and Item Information Model Version 3.0.1",
  url: ${JSON.stringify(sourceUrl)},
  date: "1st September 2024",
  release: "1EdTech Final Release Version 1.0",
  sha256: "${sha256}",
  inventorySha256: "${createHash("sha256").update(JSON.stringify(entries)).digest("hex")}",
  entryCount: ${entries.length},
} as const;

/** Section index for review navigation, not an enumeration of every normative requirement. */
export const qtiInformationModelInventory = [
${lines.join("\n")}
] as const satisfies readonly QtiInformationModelEntry[];
`;

if (process.argv.includes("--check")) {
  if (readFileSync(outputPath, "utf8") !== output) throw new Error("Generated inventory differs");
  console.log(`Verified ${entries.length} sections against the pinned source`);
} else {
  writeFileSync(outputPath, output);
  console.log(`Wrote ${entries.length} sections to ${outputPath}`);
}

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
