import {
  FORBIDDEN_DELIVERY_SECRET_ELEMENT_NAMES,
  analyzeDeliveryXml,
  isDeclarationDefaultValue,
  normalizedQtiElementName,
  parseDeliveryXml,
  redactDeliveryXml,
  type DeliveryRedactionPolicy,
  type QtiDeliverySecurityAnalysis,
  type QtiDeliverySecurityFindingKind,
} from "./delivery-redaction.js";
import { parseXmlBoolean } from "./parser-values.js";
import type { XmlNode } from "./xml.js";

export type {
  QtiDeliverySecurityAnalysis,
  QtiDeliverySecurityFinding,
  QtiDeliverySecurityFindingKind,
} from "./delivery-redaction.js";

const FORBIDDEN_DELIVERY_ELEMENT_NAMES = new Set([
  ...FORBIDDEN_DELIVERY_SECRET_ELEMENT_NAMES,
  "feedback-inline",
  "feedback-block",
  "modal-feedback",
]);

const UNSUPPORTED_SECURE_DELIVERY_ELEMENT_NAMES = new Set([
  "template-processing",
  "set-correct-response",
]);

export interface QtiDeliverySafeXmlResult {
  ok: boolean;
  diagnostics: QtiDeliverySecurityAnalysis["diagnostics"];
  analysis: QtiDeliverySecurityAnalysis;
  xml?: string | undefined;
}

export function analyzeQtiDeliverySecurity(xml: string): QtiDeliverySecurityAnalysis {
  return analyzeDeliveryXml(parseDeliveryXml(xml), staticDeliveryPolicy);
}

export function buildQtiDeliverySafeXml(xml: string): QtiDeliverySafeXmlResult {
  return redactDeliveryXml(xml, staticDeliveryPolicy);
}

const staticDeliveryPolicy: DeliveryRedactionPolicy = {
  isForbiddenElement(node, normalizedName) {
    return (
      FORBIDDEN_DELIVERY_ELEMENT_NAMES.has(normalizedName) ||
      isDeclarationDefaultValue(node, normalizedName)
    );
  },
  unsupportedFinding(node, normalizedName, nodes) {
    if (UNSUPPORTED_SECURE_DELIVERY_ELEMENT_NAMES.has(normalizedName)) {
      return {
        kind: "unsupported-secure-delivery-element",
        qtiName: node.name,
        localName: node.localName,
        message: `${node.name} is not supported by secure delivery redaction v1.`,
        source: node.source,
      };
    }

    if (
      node.parent === undefined &&
      parseXmlBoolean(node.attributes.adaptive) === true &&
      nodes.some(
        (candidate) => normalizedQtiElementName(candidate.localName) === "response-processing",
      )
    ) {
      return {
        kind: "unsupported-adaptive-response-processing",
        qtiName: node.name,
        localName: node.localName,
        message:
          "Adaptive response processing requires server-side item materialization before secure delivery.",
        source: node.source,
      };
    }

    return null;
  },
  diagnosticCodeForFinding: staticDiagnosticCodeForFinding,
  forbiddenElementMessage(node: XmlNode) {
    return `${node.name} exposes answer keys, scoring, mapping, feedback, or solution information during delivery.`;
  },
};

function staticDiagnosticCodeForFinding(kind: QtiDeliverySecurityFindingKind): string {
  if (kind === "forbidden-delivery-element") return "delivery.forbiddenElement";
  if (kind === "unsupported-adaptive-response-processing") {
    return "delivery.unsupportedAdaptiveResponseProcessing";
  }
  return "delivery.unsupportedSecureDelivery";
}
