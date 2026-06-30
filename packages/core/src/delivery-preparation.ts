import { materializeAdaptiveCandidateView } from "./adaptive-turn-materializer.js";
import type {
  QtiDeliverySecurityAnalysis,
  RedactedDeliveryXmlResult,
} from "./delivery-redaction.js";
import { buildQtiDeliverySafeXml } from "./delivery-security.js";
import type { QtiValue } from "./types.js";

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

  return toCandidateDeliveryResult(redaction, options.mode);
}

function toCandidateDeliveryResult(
  redaction: RedactedDeliveryXmlResult,
  mode: QtiDeliveryPreparationMode,
): QtiDeliveryPreparationResult {
  return {
    ok: redaction.ok,
    mode,
    diagnostics: redaction.diagnostics,
    analysis: redaction.analysis,
    candidateSafeXml: redaction.xml,
  };
}
