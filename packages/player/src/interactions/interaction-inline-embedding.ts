import type { QtiInteraction } from "@longsightgroup/qti3-core";

export type InlineEmbeddingDisposition = "supported" | "unsupported" | "invalid";

export type InlineEmbedRendererId = "inlineChoice" | "textEntry" | "endAttempt";

type InlineEmbedPolicyEntry =
  | { disposition: "supported"; rendererId: InlineEmbedRendererId }
  | { disposition: "unsupported" };

/** Canonical inline item-body flow policy. Registry `renderEmbedded` hooks derive from this table. */
export const INLINE_EMBED_POLICY = {
  inlineChoice: { disposition: "supported", rendererId: "inlineChoice" },
  textEntry: { disposition: "supported", rendererId: "textEntry" },
  endAttempt: { disposition: "supported", rendererId: "endAttempt" },
  custom: { disposition: "unsupported" },
} as const satisfies Partial<Record<QtiInteraction["type"], InlineEmbedPolicyEntry>>;

type InlineEmbedPolicyType = keyof typeof INLINE_EMBED_POLICY;

function inlineEmbedPolicyEntry(interaction: QtiInteraction): InlineEmbedPolicyEntry | undefined {
  if (!hasInlineEmbedPolicyType(interaction.type)) return undefined;
  return INLINE_EMBED_POLICY[interaction.type];
}

function hasInlineEmbedPolicyType(type: QtiInteraction["type"]): type is InlineEmbedPolicyType {
  return type in INLINE_EMBED_POLICY;
}

export function inlineEmbeddingDisposition(
  interaction: QtiInteraction,
): InlineEmbeddingDisposition {
  const policy = inlineEmbedPolicyEntry(interaction);
  if (!policy) return "invalid";
  return policy.disposition;
}

/** True when an interaction may appear in inline item-body flow (supported or unsupported). */
export function isInlineFlowInteraction(interaction: QtiInteraction): boolean {
  return inlineEmbeddingDisposition(interaction) !== "invalid";
}

export function inlineEmbedRendererId(
  interaction: QtiInteraction,
): InlineEmbedRendererId | undefined {
  const policy = inlineEmbedPolicyEntry(interaction);
  return policy?.disposition === "supported" ? policy.rendererId : undefined;
}

export function inlineEmbedRendererIds(): readonly InlineEmbedRendererId[] {
  return Object.values(INLINE_EMBED_POLICY)
    .filter(
      (policy): policy is Extract<InlineEmbedPolicyEntry, { disposition: "supported" }> =>
        policy.disposition === "supported",
    )
    .map((policy) => policy.rendererId);
}

export function isInlineEmbedRendererId(value: string): value is InlineEmbedRendererId {
  return (inlineEmbedRendererIds() as readonly string[]).includes(value);
}
