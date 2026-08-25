import { basicItemPlayerProfile } from "@longsightgroup/qti3-conformance";
import { type parseQtiXml } from "@longsightgroup/qti3-core";

/** Detect Basic item-player feature evidence present in a parsed item XML document. */
export function detectBasicItemFeatures(
  xml: string,
  result: ReturnType<typeof parseQtiXml>,
): string[] {
  const featureIds = new Set<string>();

  if (/<qti-assessment-item\b/i.test(xml)) featureIds.add("I-0");
  if (/<qti-response-declaration\b/i.test(xml)) featureIds.add("I-1");
  if (/<qti-outcome-declaration\b/i.test(xml)) featureIds.add("I-2");
  if (/<qti-item-body\b/i.test(xml)) featureIds.add("I-7");
  if (/<qti-response-processing\b[^>]*\btemplate\s*=/i.test(xml)) featureIds.add("I-9b");
  if (/<math(?:\s|>)/i.test(xml)) featureIds.add("I-18");
  if (/\bclass\s*=\s*["'][^"']*\bqti-[^"']*["']|\bdata-qti-/i.test(xml)) {
    featureIds.add("I-19");
  }
  if (/<img\b[^>]*\balt\s*=/i.test(xml)) featureIds.add("A-1");
  if (
    /<(?:p|section|div|span|h[1-6]|figure|figcaption|table|caption|thead|tbody|tr|th|td|ul|ol|li|em|strong|img|math)(?:\s|>)/i.test(
      xml,
    )
  ) {
    featureIds.add("I-8");
  }

  const interactions = result.document?.item.interactions ?? [];
  if (interactions.length > 1) featureIds.add("I-17");
  for (const interaction of interactions) {
    const featureId = basicInteractionFeature(interaction.qtiName, xml);
    if (featureId) featureIds.add(featureId);
  }

  const order = new Map(
    basicItemPlayerProfile.features.map((feature, index) => [feature.featureId, index]),
  );
  return [...featureIds].toSorted((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
}

function basicInteractionFeature(qtiName: string, xml: string): string | undefined {
  if (qtiName === "qti-choice-interaction") {
    return /<qti-choice-interaction\b[^>]*\bmax-choices\s*=/i.test(xml) ? "Q-2" : undefined;
  }
  if (qtiName === "qti-extended-text-interaction") return "Q-5";
  if (qtiName === "qti-match-interaction") return "Q-13";
  if (qtiName === "qti-text-entry-interaction") return "Q-20";
  return undefined;
}
