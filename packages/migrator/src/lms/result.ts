import { strToU8 } from "fflate";
import { decodeUtf8 } from "@longsightgroup/qti3-core";
import { finalizeItemResult } from "../item-finalize.js";
import { resolveOptions } from "../options.js";
import { normalizeIdentifier } from "../text.js";
import type {
  QtiMigrationAsset,
  QtiMigrationDiagnostic,
  QtiMigrationOptions,
  QtiMigrationSourceInput,
} from "../types.js";
import type { LmsIssue, LmsMigrationResult, LmsPendingItem } from "./types.js";

const warnings = new Set([
  "LMS_CONTENT_REVIEW",
  "LMS_MANUAL_POINTS_REVIEW",
  "GIFT_FEEDBACK_IGNORED",
  "CLOZE_MIXED",
]);
export function diagnostics(issues: readonly LmsIssue[], path?: string): QtiMigrationDiagnostic[] {
  return issues.map((entry) => ({
    code: entry.code.toLowerCase().replace(/_review$/, "_not_preserved"),
    severity: warnings.has(entry.code) ? "warning" : "error",
    message: entry.detail ? `${entry.message} Source: ${entry.detail}` : entry.message,
    path,
  }));
}
export function uniqueIdentifier(value: string, index: number, seen: Set<string>): string {
  const base = normalizeIdentifier(value, `ITEM_${index + 1}`);
  let id = base;
  let duplicate = 1;
  while (seen.has(id)) id = `${base}_${++duplicate}`;
  seen.add(id);
  return id;
}
export function finish(
  format: LmsMigrationResult["sourceFormat"],
  records: readonly LmsPendingItem[],
  assets: readonly QtiMigrationAsset[],
  options: QtiMigrationOptions,
  title: string,
  global: readonly QtiMigrationDiagnostic[] = [],
): LmsMigrationResult {
  const resolved = resolveOptions(options);
  const items = records.map((record) => {
    const href = `${record.identifier}.xml`;
    const converted = finalizeItemResult(record, href, resolved);
    return { ...converted, sourceMetadata: record.sourceMetadata };
  });
  const categories = new Map<string, string[]>();
  for (const item of items) {
    const category = item.sourceMetadata.category ?? "Imported content";
    const hrefs = categories.get(category);
    if (hrefs) hrefs.push(item.href);
    else categories.set(category, [item.href]);
  }
  const parts = [...categories].map(([category, itemHrefs], index) => ({
    identifier: `PART_${index + 1}`,
    title: category,
    itemHrefs,
  }));
  return { title, sourceFormat: format, parts, items, assets, diagnostics: global };
}
export function sourceText(input: QtiMigrationSourceInput): string {
  if (input.xml !== undefined && input.bytes !== undefined) throw new Error("Ambiguous source");
  if (input.xml !== undefined) return input.xml;
  if (input.bytes !== undefined) {
    const bytes = input.bytes;
    const source =
      bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.subarray(3) : bytes;
    const decoded = decodeUtf8(source);
    const encoded = strToU8(decoded);
    if (source.length !== encoded.length || source.some((byte, index) => byte !== encoded[index]))
      throw new Error("Invalid UTF-8");
    return decoded;
  }
  throw new Error("Missing source");
}
