import type { QtiDiagnostic, QtiSourceLocation } from "./types.js";
import { descendants, parseXmlTree, type XmlNode } from "./xml.js";

export const DEFAULT_VALUE_DECLARATION_ELEMENT_NAMES = new Set([
  "response-declaration",
  "outcome-declaration",
  "template-declaration",
]);

export const FORBIDDEN_DELIVERY_SECRET_ELEMENT_NAMES = new Set([
  "correct-response",
  "mapping",
  "area-mapping",
  "match-table",
  "interpolation-table",
  "response-processing",
]);

export type QtiDeliverySecurityFindingKind =
  | "forbidden-delivery-element"
  | "unsupported-secure-delivery-element"
  | "unsupported-adaptive-response-processing";

export interface QtiDeliverySecurityFinding {
  kind: QtiDeliverySecurityFindingKind;
  qtiName: string;
  localName: string;
  message: string;
  source?: QtiSourceLocation | undefined;
}

export interface QtiDeliverySecurityAnalysis {
  diagnostics: QtiDiagnostic[];
  findings: QtiDeliverySecurityFinding[];
  /** True when this exact XML contains no known answer/scoring/feedback delivery leaks. */
  deliverySafe: boolean;
  /** True when secure-delivery redaction can be attempted for this XML. */
  secureDeliverySupported: boolean;
}

export interface ParsedDeliveryXml {
  root: XmlNode | undefined;
  diagnostics: QtiDiagnostic[];
}

export interface DeliveryRedactionPolicy {
  isForbiddenElement(node: XmlNode, normalizedName: string): boolean;
  unsupportedFinding?(
    node: XmlNode,
    normalizedName: string,
    nodes: readonly XmlNode[],
  ): QtiDeliverySecurityFinding | null;
  diagnosticCodeForFinding(kind: QtiDeliverySecurityFindingKind): string;
  forbiddenElementMessage(node: XmlNode): string;
}

export interface RedactedDeliveryXmlResult {
  ok: boolean;
  diagnostics: QtiDiagnostic[];
  analysis: QtiDeliverySecurityAnalysis;
  xml?: string | undefined;
}

export function parseDeliveryXml(xml: string): ParsedDeliveryXml {
  let parsed: ReturnType<typeof parseXmlTree>;
  try {
    parsed = parseXmlTree(xml);
  } catch (error) {
    return {
      root: undefined,
      diagnostics: [
        {
          code: "xml.parse",
          severity: "error",
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }

  const diagnostics: QtiDiagnostic[] = parsed.errors.map((error) => ({
    code: "xml.parse",
    severity: "error",
    message: error.message,
  }));
  if (!parsed.root) {
    diagnostics.push({
      code: "xml.empty",
      severity: "error",
      message: "No XML root element was found.",
    });
  }
  return { root: parsed.root, diagnostics };
}

export function analyzeDeliveryXml(
  parsed: ParsedDeliveryXml,
  policy: DeliveryRedactionPolicy,
): QtiDeliverySecurityAnalysis {
  const diagnostics = [...parsed.diagnostics];
  const findings: QtiDeliverySecurityFinding[] = [];

  if (parsed.root) {
    const nodes = [parsed.root, ...descendants(parsed.root, () => true)];
    for (const node of nodes) {
      const normalizedName = normalizedQtiElementName(node.localName);
      if (policy.isForbiddenElement(node, normalizedName)) {
        findings.push({
          kind: "forbidden-delivery-element",
          qtiName: node.name,
          localName: node.localName,
          message: policy.forbiddenElementMessage(node),
          source: node.source,
        });
      }

      const unsupportedFinding = policy.unsupportedFinding?.(node, normalizedName, nodes);
      if (unsupportedFinding) findings.push(unsupportedFinding);
    }
  }

  diagnostics.push(
    ...findings.map((finding) =>
      findingToDiagnostic(finding, (kind) => policy.diagnosticCodeForFinding(kind)),
    ),
  );
  const parseOk = parsed.diagnostics.every((diagnostic) => diagnostic.severity !== "error");

  return {
    diagnostics,
    findings,
    deliverySafe:
      parseOk && !findings.some((finding) => finding.kind === "forbidden-delivery-element"),
    secureDeliverySupported:
      parseOk &&
      !findings.some(
        (finding) =>
          finding.kind === "unsupported-secure-delivery-element" ||
          finding.kind === "unsupported-adaptive-response-processing",
      ),
  };
}

export function redactDeliveryXml(
  xml: string,
  policy: DeliveryRedactionPolicy,
): RedactedDeliveryXmlResult {
  const parsed = parseDeliveryXml(xml);
  const analysis = analyzeDeliveryXml(parsed, policy);
  if (!analysis.secureDeliverySupported) {
    return {
      ok: false,
      diagnostics: analysis.diagnostics,
      analysis,
    };
  }

  if (!parsed.root) {
    return {
      ok: false,
      diagnostics: parsed.diagnostics,
      analysis,
    };
  }

  const redactionRanges = readRedactionRanges(
    [parsed.root, ...descendants(parsed.root, () => true)],
    (node, normalizedName) => policy.isForbiddenElement(node, normalizedName),
  );
  const redactedXml = applySourceRangeEdits(
    xml,
    redactionRanges.map((range) => ({
      startOffset: range.startOffset,
      endOffset: range.endOffset,
    })),
  );
  const redactedAnalysis = analyzeDeliveryXml(parseDeliveryXml(redactedXml), policy);
  if (!redactedAnalysis.deliverySafe || !redactedAnalysis.secureDeliverySupported) {
    return {
      ok: false,
      diagnostics: [...analysis.diagnostics, ...redactedAnalysis.diagnostics],
      analysis: redactedAnalysis,
    };
  }

  return {
    ok: true,
    xml: redactedXml,
    diagnostics: redactedAnalysis.diagnostics,
    analysis: redactedAnalysis,
  };
}

export function readRedactionRanges(
  nodes: readonly XmlNode[],
  shouldRedact: (node: XmlNode, normalizedName: string) => boolean,
): RedactionRange[] {
  const ranges = nodes.flatMap((node) => {
    const normalizedName = normalizedQtiElementName(node.localName);
    if (!shouldRedact(node, normalizedName)) return [];
    return sourceRangeFor(node);
  });
  return mergeSourceRanges(ranges);
}

export function sourceRangeFor(node: XmlNode): RedactionRange[] {
  const endOffset = node.sourceRange.endOffset;
  if (node.sourceRange.startOffset < 0 || endOffset === undefined) return [];
  return [{ startOffset: node.sourceRange.startOffset, endOffset }];
}

export function applySourceRangeEdits(xml: string, edits: readonly SourceRangeEdit[]): string {
  if (edits.length === 0) return xml;
  const sorted = edits.toSorted((left, right) => left.startOffset - right.startOffset);
  assertNonOverlappingSourceRangeEdits(sorted);
  let output = "";
  let cursor = 0;
  for (const edit of sorted) {
    output += xml.slice(cursor, edit.startOffset);
    if (edit.text !== undefined) output += edit.text;
    cursor = edit.endOffset;
  }
  return output + xml.slice(cursor);
}

function assertNonOverlappingSourceRangeEdits(edits: readonly SourceRangeEdit[]): void {
  for (let index = 1; index < edits.length; index += 1) {
    const previous = edits[index - 1];
    const current = edits[index];
    if (!previous || !current || current.startOffset >= previous.endOffset) continue;
    throw new Error("Source range edits must not overlap.");
  }
}

export function removeSourceRanges(xml: string, ranges: readonly RedactionRange[]): string {
  return applySourceRangeEdits(
    xml,
    ranges.map((range) => ({ startOffset: range.startOffset, endOffset: range.endOffset })),
  );
}

export function normalizedQtiElementName(localName: string): string {
  const lower = localName.toLowerCase();
  return lower.startsWith("qti-") ? lower.slice("qti-".length) : lower;
}

export function parseXmlBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return undefined;
}

export function isDeclarationDefaultValue(node: XmlNode, normalizedName: string): boolean {
  return (
    normalizedName === "default-value" &&
    DEFAULT_VALUE_DECLARATION_ELEMENT_NAMES.has(
      normalizedQtiElementName(node.parent?.localName ?? ""),
    )
  );
}

export interface RedactionRange {
  startOffset: number;
  endOffset: number;
}

export interface SourceRangeEdit extends RedactionRange {
  /** When omitted, the source range is removed. When set, the range is replaced with this text. */
  text?: string | undefined;
}

function mergeSourceRanges(ranges: readonly RedactionRange[]): RedactionRange[] {
  const sorted = ranges.toSorted((left, right) => left.startOffset - right.startOffset);
  const merged: RedactionRange[] = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (last && range.startOffset <= last.endOffset) {
      last.endOffset = Math.max(last.endOffset, range.endOffset);
      continue;
    }
    merged.push({ ...range });
  }
  return merged;
}

function findingToDiagnostic(
  finding: QtiDeliverySecurityFinding,
  diagnosticCodeForFinding: (kind: QtiDeliverySecurityFindingKind) => string,
): QtiDiagnostic {
  return {
    code: diagnosticCodeForFinding(finding.kind),
    severity: "error",
    message: finding.message,
    path: finding.source?.path,
    source: finding.source,
  };
}
