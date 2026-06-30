import {
  FORBIDDEN_DELIVERY_SECRET_ELEMENT_NAMES,
  isDeclarationDefaultValue,
  redactDeliveryXml,
  type DeliveryRedactionPolicy,
  type QtiDeliverySecurityAnalysis,
  type QtiDeliverySecurityFindingKind,
} from "./delivery-redaction.js";
import type { QtiDiagnostic, QtiValue } from "./types.js";
import { qtiValueToString } from "./value-format.js";
import type { XmlNode } from "./xml.js";

const UNSUPPORTED_MATERIALIZATION_ELEMENT_NAMES = new Set([
  "template-processing",
  "set-correct-response",
]);

const FEEDBACK_ELEMENT_NAMES = new Set(["feedback-inline", "feedback-block", "modal-feedback"]);

export interface QtiAdaptiveCandidateMaterializationInput {
  itemXml: string;
  outcomes: Record<string, QtiValue>;
}

export interface QtiAdaptiveCandidateMaterializationResult {
  ok: boolean;
  diagnostics: QtiDiagnostic[];
  analysis: QtiDeliverySecurityAnalysis;
  xml?: string | undefined;
}

export function materializeAdaptiveCandidateView(
  input: QtiAdaptiveCandidateMaterializationInput,
): QtiAdaptiveCandidateMaterializationResult {
  return redactDeliveryXml(input.itemXml, adaptiveMaterializationPolicy(input.outcomes));
}

function shouldPreserveFeedback(node: XmlNode, outcomes: Record<string, QtiValue>): boolean {
  if (node.attributes["show-hide"] === "hide") return false;
  const identifier = node.attributes.identifier;
  const outcomeIdentifier = node.attributes["outcome-identifier"];
  if (!identifier || !outcomeIdentifier) return false;

  const outcome = outcomes[outcomeIdentifier] ?? null;
  if (Array.isArray(outcome)) return outcome.includes(identifier);
  return qtiValueToString(outcome) === identifier;
}

function isFeedbackElement(normalizedName: string): boolean {
  return FEEDBACK_ELEMENT_NAMES.has(normalizedName);
}

function adaptiveMaterializationPolicy(
  outcomes: Record<string, QtiValue>,
): DeliveryRedactionPolicy {
  return {
    isForbiddenElement(node, normalizedName) {
      if (isFeedbackElement(normalizedName)) return !shouldPreserveFeedback(node, outcomes);
      return (
        FORBIDDEN_DELIVERY_SECRET_ELEMENT_NAMES.has(normalizedName) ||
        isDeclarationDefaultValue(node, normalizedName)
      );
    },
    unsupportedFinding(node, normalizedName) {
      if (!UNSUPPORTED_MATERIALIZATION_ELEMENT_NAMES.has(normalizedName)) return null;
      return {
        kind: "unsupported-secure-delivery-element",
        qtiName: node.name,
        localName: node.localName,
        message: `${node.name} is not supported by adaptive candidate materialization v1.`,
        source: node.source,
      };
    },
    diagnosticCodeForFinding: adaptiveMaterializationDiagnosticCodeForFinding,
    forbiddenElementMessage(node) {
      return `${node.name} exposes answer keys, scoring, mapping, feedback, or solution information during adaptive delivery.`;
    },
  };
}

function adaptiveMaterializationDiagnosticCodeForFinding(
  kind: QtiDeliverySecurityFindingKind,
): string {
  return kind === "unsupported-secure-delivery-element"
    ? "adaptiveTurn.materialization.unsupported"
    : "adaptiveTurn.materialization.forbiddenElement";
}
