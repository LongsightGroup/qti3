import type {
  QtiAssessmentItem,
  QtiContentNode,
  QtiDiagnostic,
  QtiElementContent,
} from "./types.js";

export function sharedClassNames(attributes: Record<string, string>): string[] {
  return (attributes.class ?? "").split(/\s+/).filter(Boolean);
}

export function isLayoutColumnClassName(className: string): boolean {
  return /^qti-layout-col-?\w+$/.test(className);
}

export function layoutColumnValue(className: string): number | undefined {
  const rawValue = /^qti-layout-col-?(\d+)$/.exec(className)?.[1];
  if (rawValue === undefined) return undefined;
  const value = Number(rawValue);
  if (value < 1 || value > 12) return undefined;
  return value;
}

export function firstLayoutColumnValue(classNames: string[]): number | undefined {
  for (const className of classNames) {
    const value = layoutColumnValue(className);
    if (value !== undefined) return value;
  }
  return undefined;
}

export function isLayoutOffsetClassName(className: string): boolean {
  return /^qti-layout-offset-?\w+$/.test(className);
}

export function layoutOffsetValue(className: string): number | undefined {
  const rawValue = /^qti-layout-offset-?(\d+)$/.exec(className)?.[1];
  if (rawValue === undefined) return undefined;
  const value = Number(rawValue);
  if (value < 1 || value > 11) return undefined;
  return value;
}

export function firstLayoutOffsetValue(classNames: string[]): number | undefined {
  for (const className of classNames) {
    const value = layoutOffsetValue(className);
    if (value !== undefined) return value;
  }
  return undefined;
}

export function validateItemBodySharedVocabulary(
  item: QtiAssessmentItem,
  diagnostics: QtiDiagnostic[],
): void {
  validateContentSharedVocabulary(item.body, diagnostics);
}

function validateContentSharedVocabulary(
  nodes: QtiContentNode[],
  diagnostics: QtiDiagnostic[],
): void {
  for (const node of nodes) {
    if (node.kind !== "element") continue;
    validateLayoutVocabularyClasses(node, diagnostics);
    if (sharedClassNames(node.attributes).includes("qti-layout-row")) {
      validateLayoutRow(node, diagnostics);
    }
    validateContentSharedVocabulary(node.children, diagnostics);
  }
}

function validateLayoutVocabularyClasses(
  node: QtiElementContent,
  diagnostics: QtiDiagnostic[],
): void {
  const classNames = sharedClassNames(node.attributes);
  for (const className of classNames) {
    if (isLayoutColumnClassName(className) && layoutColumnValue(className) === undefined) {
      diagnostics.push({
        code: "item.sharedVocabulary.layoutColumnInvalid",
        severity: "warning",
        message: `Shared vocabulary class ${className} is not supported; expected qti-layout-col1 through qti-layout-col12, or dashed qti-layout-col-1 through qti-layout-col-12.`,
        path: node.source?.path,
        source: node.source,
      });
    }
    if (isLayoutOffsetClassName(className) && layoutOffsetValue(className) === undefined) {
      diagnostics.push({
        code: "item.sharedVocabulary.layoutOffsetInvalid",
        severity: "warning",
        message: `Shared vocabulary class ${className} is not supported; expected qti-layout-offset1 through qti-layout-offset11, or dashed qti-layout-offset-1 through qti-layout-offset-11.`,
        path: node.source?.path,
        source: node.source,
      });
    }
  }
}

function validateLayoutRow(node: QtiElementContent, diagnostics: QtiDiagnostic[]): void {
  let totalColumns = 0;
  for (const child of node.children) {
    if (child.kind !== "element") continue;
    const classNames = sharedClassNames(child.attributes);
    const column = firstLayoutColumnValue(classNames);
    if (column === undefined) continue;
    totalColumns += (firstLayoutOffsetValue(classNames) ?? 0) + column;
  }
  if (totalColumns <= 12) return;
  diagnostics.push({
    code: "item.sharedVocabulary.layoutRowOverflow",
    severity: "warning",
    message: `qti-layout-row column groupings plus offsets total ${totalColumns}; the QTI shared vocabulary grid allows at most twelve columns per row.`,
    path: node.source?.path,
    source: node.source,
  });
}
