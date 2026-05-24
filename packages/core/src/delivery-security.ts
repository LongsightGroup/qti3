import type { QtiDiagnostic, QtiSourceLocation } from "./types.js";
import { descendants, parseXmlTree, type XmlNode } from "./xml.js";

const FORBIDDEN_DELIVERY_ELEMENT_NAMES = new Set([
  "correct-response",
  "mapping",
  "area-mapping",
  "response-processing",
  "feedback-inline",
  "feedback-block",
  "modal-feedback",
]);

const UNSUPPORTED_SECURE_DELIVERY_ELEMENT_NAMES = new Set([
  "template-processing",
  "set-correct-response",
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
  deliverySafe: boolean;
  secureDeliverySupported: boolean;
}

export interface QtiDeliverySafeXmlResult {
  ok: boolean;
  diagnostics: QtiDiagnostic[];
  analysis: QtiDeliverySecurityAnalysis;
  xml?: string | undefined;
}

export function analyzeQtiDeliverySecurity(xml: string): QtiDeliverySecurityAnalysis {
  const parsed = parseDeliveryXml(xml);
  const diagnostics = [...parsed.diagnostics];
  const findings: QtiDeliverySecurityFinding[] = [];

  if (parsed.root) {
    const nodes = [parsed.root, ...descendants(parsed.root, () => true)];
    for (const node of nodes) {
      const normalizedName = normalizedQtiElementName(node.localName);
      if (FORBIDDEN_DELIVERY_ELEMENT_NAMES.has(normalizedName)) {
        findings.push({
          kind: "forbidden-delivery-element",
          qtiName: node.name,
          localName: node.localName,
          message: `${node.name} exposes answer keys, scoring, mapping, feedback, or solution information during delivery.`,
          source: node.source,
        });
      }
      if (UNSUPPORTED_SECURE_DELIVERY_ELEMENT_NAMES.has(normalizedName)) {
        findings.push({
          kind: "unsupported-secure-delivery-element",
          qtiName: node.name,
          localName: node.localName,
          message: `${node.name} is not supported by secure delivery redaction v1.`,
          source: node.source,
        });
      }
    }

    if (
      parseXmlBoolean(parsed.root.attributes.adaptive) === true &&
      nodes.some((node) => normalizedQtiElementName(node.localName) === "response-processing")
    ) {
      findings.push({
        kind: "unsupported-adaptive-response-processing",
        qtiName: parsed.root.name,
        localName: parsed.root.localName,
        message:
          "Adaptive response processing requires server-side item materialization before secure delivery.",
        source: parsed.root.source,
      });
    }
  }

  diagnostics.push(...findings.map(findingToDiagnostic));
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

export function buildQtiDeliverySafeXml(xml: string): QtiDeliverySafeXmlResult {
  const analysis = analyzeQtiDeliverySecurity(xml);
  if (!analysis.secureDeliverySupported) {
    return {
      ok: false,
      diagnostics: analysis.diagnostics,
      analysis,
    };
  }

  const parsed = parseDeliveryXml(xml);
  if (!parsed.root) {
    return {
      ok: false,
      diagnostics: parsed.diagnostics,
      analysis,
    };
  }

  const redactionRanges = readRedactionRanges(
    [parsed.root, ...descendants(parsed.root, () => true)],
    FORBIDDEN_DELIVERY_ELEMENT_NAMES,
  );
  const redactedXml = removeSourceRanges(xml, redactionRanges);
  const redactedAnalysis = analyzeQtiDeliverySecurity(redactedXml);
  if (!redactedAnalysis.deliverySafe) {
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

function parseDeliveryXml(xml: string): {
  root: XmlNode | undefined;
  diagnostics: QtiDiagnostic[];
} {
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

function normalizedQtiElementName(localName: string): string {
  const lower = localName.toLowerCase();
  return lower.startsWith("qti-") ? lower.slice("qti-".length) : lower;
}

function parseXmlBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return undefined;
}

function findingToDiagnostic(finding: QtiDeliverySecurityFinding): QtiDiagnostic {
  const code =
    finding.kind === "forbidden-delivery-element"
      ? "delivery.forbiddenElement"
      : "delivery.unsupportedSecureDelivery";
  return {
    code,
    severity: "error",
    message: finding.message,
    path: finding.source?.path,
    source: finding.source,
  };
}

interface RedactionRange {
  startOffset: number;
  endOffset: number;
}

function readRedactionRanges(
  nodes: XmlNode[],
  strippedElementNames: Set<string>,
): RedactionRange[] {
  const ranges = nodes.flatMap((node) => {
    if (!strippedElementNames.has(normalizedQtiElementName(node.localName))) return [];
    const endOffset = node.sourceRange.endOffset;
    if (node.sourceRange.startOffset < 0 || endOffset === undefined) return [];
    return [{ startOffset: node.sourceRange.startOffset, endOffset }];
  });
  return mergeSourceRanges(ranges);
}

function mergeSourceRanges(ranges: RedactionRange[]): RedactionRange[] {
  const sorted = [...ranges].sort((left, right) => left.startOffset - right.startOffset);
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

function removeSourceRanges(xml: string, ranges: RedactionRange[]): string {
  let output = "";
  let cursor = 0;
  for (const range of ranges) {
    output += xml.slice(cursor, range.startOffset);
    cursor = range.endOffset;
  }
  return output + xml.slice(cursor);
}
