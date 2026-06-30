import { materializeAdaptiveCandidateView } from "./adaptive-turn-materializer.js";
import type {
  QtiDeliverySecurityAnalysis,
  QtiDeliverySecurityFindingKind,
  RedactedDeliveryXmlResult,
} from "./delivery-redaction.js";
import { buildQtiDeliverySafeXml } from "./delivery-security.js";
import type { QtiDiagnostic, QtiValue } from "./types.js";

export type QtiDeliveryPreparationMode = "static" | "server-materialized-adaptive";

export type QtiDeliveryPreparationOptions =
  | { mode: "static" }
  | { mode: "server-materialized-adaptive"; outcomes: Record<string, QtiValue> };

export interface QtiDeliveryPreparationResult {
  ok: boolean;
  mode: QtiDeliveryPreparationMode;
  diagnostics: QtiDeliverySecurityAnalysis["diagnostics"];
  analysis: QtiDeliverySecurityAnalysis;
  candidateSafeXml?: string | undefined;
}

/** Prepare candidate-safe XML for a supported QTI delivery mode. */
export function prepareQtiDeliveryXml(
  xml: string,
  options: QtiDeliveryPreparationOptions,
): QtiDeliveryPreparationResult {
  const redaction =
    options.mode === "static"
      ? buildQtiDeliverySafeXml(xml)
      : materializeAdaptiveCandidateView({
          itemXml: xml,
          outcomes: options.outcomes,
        });

  return {
    ok: redaction.ok,
    mode: options.mode,
    diagnostics: normalizePreparationDiagnostics(redaction, options.mode),
    analysis: redaction.analysis,
    candidateSafeXml: redaction.xml,
  };
}

function normalizePreparationDiagnostics(
  redaction: RedactedDeliveryXmlResult,
  mode: QtiDeliveryPreparationMode,
): QtiDiagnostic[] {
  const findingCodes = redaction.analysis.findings.map((finding) =>
    preparationDiagnosticCodeForFinding(finding.kind, mode),
  );
  let findingIndex = 0;

  return redaction.diagnostics.map((diagnostic) => {
    if (!isDeliveryFindingDiagnosticCode(diagnostic.code)) return diagnostic;

    const code = findingCodes[findingIndex];
    findingIndex += 1;

    return {
      ...diagnostic,
      code: code ?? preparationDiagnosticCodeForLowerLevelCode(diagnostic.code, mode),
    };
  });
}

function preparationDiagnosticCodeForFinding(
  kind: QtiDeliverySecurityFindingKind,
  mode: QtiDeliveryPreparationMode,
): string {
  if (kind === "forbidden-delivery-element") return "delivery.preparation.forbiddenElement";
  if (kind === "unsupported-adaptive-response-processing") {
    return "delivery.preparation.unsupportedAdaptiveResponseProcessing";
  }
  return mode === "server-materialized-adaptive"
    ? "delivery.preparation.unsupportedMaterialization"
    : "delivery.preparation.unsupportedSecureDelivery";
}

function isDeliveryFindingDiagnosticCode(code: string): boolean {
  return (
    code === "delivery.forbiddenElement" ||
    code === "delivery.unsupportedSecureDelivery" ||
    code === "delivery.unsupportedAdaptiveResponseProcessing" ||
    code === "adaptiveTurn.materialization.forbiddenElement" ||
    code === "adaptiveTurn.materialization.unsupported"
  );
}

function preparationDiagnosticCodeForLowerLevelCode(
  code: string,
  mode: QtiDeliveryPreparationMode,
): string {
  if (
    code === "delivery.forbiddenElement" ||
    code === "adaptiveTurn.materialization.forbiddenElement"
  ) {
    return "delivery.preparation.forbiddenElement";
  }
  if (code === "delivery.unsupportedAdaptiveResponseProcessing") {
    return "delivery.preparation.unsupportedAdaptiveResponseProcessing";
  }
  return mode === "server-materialized-adaptive"
    ? "delivery.preparation.unsupportedMaterialization"
    : "delivery.preparation.unsupportedSecureDelivery";
}
