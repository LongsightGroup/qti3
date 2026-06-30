import {
  FORBIDDEN_DELIVERY_SECRET_ELEMENT_NAMES,
  analyzeDeliveryXml,
  isDeclarationDefaultValue,
  parseDeliveryXml,
  redactDeliveryXml,
  type DeliveryRedactionPolicy,
  type QtiDeliverySecurityAnalysis,
  type QtiDeliverySecurityFindingKind,
} from "./delivery-redaction.js";
import { materializeTemplatePresentation } from "./template-presentation-materializer.js";
import type { QtiDiagnostic, QtiValue } from "./types.js";
import { qtiValueToString } from "./value-format.js";
import type { XmlNode } from "./xml.js";

const TEMPLATE_PROCESSING_ELEMENT_NAMES = new Set(["template-processing", "set-correct-response"]);

const FEEDBACK_ELEMENT_NAMES = new Set(["feedback-inline", "feedback-block", "modal-feedback"]);

export interface QtiAdaptiveCandidateMaterializationInput {
  itemXml: string;
  outcomes: Record<string, QtiValue>;
  templateValues?: Record<string, QtiValue>;
  responses?: Record<string, QtiValue>;
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
  const policy = adaptiveMaterializationPolicy(input.outcomes);
  const templateMaterialization = materializeTemplatePresentation(input.itemXml, {
    outcomes: input.outcomes,
    templateValues: input.templateValues ?? {},
    responses: input.responses,
  });
  if (!templateMaterialization.ok) {
    const analysis = analyzeDeliveryXml(parseDeliveryXml(input.itemXml), policy);
    const diagnostics = [...templateMaterialization.diagnostics, ...analysis.diagnostics];
    return {
      ok: false,
      diagnostics,
      analysis,
    };
  }
  return redactDeliveryXml(templateMaterialization.xml, policy);
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
        TEMPLATE_PROCESSING_ELEMENT_NAMES.has(normalizedName) ||
        FORBIDDEN_DELIVERY_SECRET_ELEMENT_NAMES.has(normalizedName) ||
        isDeclarationDefaultValue(node, normalizedName)
      );
    },
    unsupportedFinding() {
      return null;
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
