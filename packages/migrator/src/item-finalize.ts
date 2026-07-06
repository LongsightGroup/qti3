import { parseQtiXml, validateAssessmentItem, type QtiDiagnostic } from "@longsightgroup/qti3-core";
import {
  qti3TrustedXmlFragment,
  writeQti3AssessmentItemResult,
  type Qti3AuthoringItem,
} from "@longsightgroup/qti3-writer";

import { diagnostic, hasErrors } from "./diagnostics.js";
import { uniqueSiblingItemHref } from "./item-hrefs.js";
import type { QtiMigrationDiagnostic, QtiMigrationItemResult } from "./types.js";
import type { ResolvedQtiMigrationOptions } from "./types.js";

export interface PendingMigrationItem {
  readonly identifier: string;
  readonly title: string;
  readonly authoringItem?: Qti3AuthoringItem | undefined;
  readonly diagnostics: readonly QtiMigrationDiagnostic[];
}

export function finalizeItemResults(
  pendingItems: readonly PendingMigrationItem[],
  sourceHref: string,
  options: ResolvedQtiMigrationOptions,
): readonly QtiMigrationItemResult[] {
  if (pendingItems.length <= 1) {
    return pendingItems.map((item) => finalizeItemResult(item, sourceHref, options));
  }

  const identifiers = new Set<string>();
  const paths = new Set<string>();
  return pendingItems.map((item, index) => {
    const identifier = item.identifier.trim();
    const uniqueIdentifier = identifier && !identifiers.has(identifier);
    if (uniqueIdentifier) identifiers.add(identifier);
    const suffix = uniqueIdentifier ? identifier : `ITEM_${index + 1}`;
    const href = uniqueSiblingItemHref(sourceHref, suffix, paths);
    return finalizeItemResult(item, href, options);
  });
}

export function finalizeItemResult(
  pending: PendingMigrationItem,
  href: string,
  options: ResolvedQtiMigrationOptions,
): QtiMigrationItemResult {
  const diagnostics = [...pending.diagnostics];
  if (pending.authoringItem && !hasErrors(diagnostics)) {
    const writer = writeQti3AssessmentItemResult(pending.authoringItem);
    if (writer.ok) {
      diagnostics.push(...validateWrittenXml(writer.xml));
      return {
        identifier: pending.identifier,
        title: pending.title,
        href,
        authoringItem: pending.authoringItem,
        xml: writer.xml,
        diagnostics,
      };
    }
    diagnostics.push({
      code: "writer_diagnostics",
      severity: "error",
      message: "QTI 3 writer rejected migrated authoring item.",
      writerDiagnostics: writer.diagnostics,
    });
  }

  if (options.unsupportedPolicy === "stub") {
    const stub = stubItem(pending.identifier, pending.title);
    const writer = writeQti3AssessmentItemResult(stub);
    return {
      identifier: pending.identifier,
      title: pending.title,
      href,
      authoringItem: stub,
      xml: writer.ok ? writer.xml : undefined,
      diagnostics: [
        ...diagnostics,
        diagnostic(
          "unsupported_item_stubbed",
          "warning",
          "Unsupported item migrated as an extended-text review stub.",
        ),
      ],
    };
  }

  return {
    identifier: pending.identifier,
    title: pending.title,
    href,
    authoringItem: options.unsupportedPolicy === "skip" ? undefined : pending.authoringItem,
    diagnostics,
  };
}

function validateWrittenXml(xml: string): QtiMigrationDiagnostic[] {
  const parsed = parseQtiXml(xml);
  const diagnostics: QtiMigrationDiagnostic[] = [];
  if (!parsed.ok || !parsed.document) {
    diagnostics.push(...coreDiagnostics("core_parse", parsed.diagnostics));
    return diagnostics;
  }
  const validation = validateAssessmentItem(parsed.document);
  if (!validation.ok) diagnostics.push(...coreDiagnostics("core_validate", validation.diagnostics));
  return diagnostics;
}

function coreDiagnostics(
  prefix: string,
  diagnostics: readonly QtiDiagnostic[],
): QtiMigrationDiagnostic[] {
  return diagnostics.map((entry) =>
    diagnostic(
      `${prefix}.${entry.code}`,
      entry.severity === "error" ? "error" : "warning",
      entry.message,
    ),
  );
}

function stubItem(identifier: string, title: string): Qti3AuthoringItem {
  return {
    interactionType: "extendedText",
    identifier,
    title,
    bodyHtml: qti3TrustedXmlFragment("<p>This item requires manual migration review.</p>"),
    responseIdentifier: "RESPONSE",
    responseBaseType: "string",
    responseCardinality: "single",
    expectedLines: 6,
  };
}
