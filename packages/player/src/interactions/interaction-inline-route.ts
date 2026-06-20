import type { QtiInteraction } from "@longsightgroup/qti3-core";
import {
  inlineEmbeddingDisposition,
  inlineEmbedRendererId,
} from "./interaction-inline-embedding.js";
import {
  matchInteractionRegistryEntry,
  type EmbeddedInteractionResponseContext,
} from "./interaction-registry.js";

export type InlineInteractionRoute =
  | { disposition: "invalid" }
  | { disposition: "unsupported" }
  | {
      disposition: "supported";
      render: (context: EmbeddedInteractionResponseContext) => HTMLElement;
    };

export function resolveInlineInteractionRoute(interaction: QtiInteraction): InlineInteractionRoute {
  const disposition = inlineEmbeddingDisposition(interaction);
  if (disposition === "invalid") return { disposition: "invalid" };
  if (disposition === "unsupported") return { disposition: "unsupported" };
  const rendererId = inlineEmbedRendererId(interaction);
  if (!rendererId) return { disposition: "invalid" };
  const entry = matchInteractionRegistryEntry(interaction);
  if (!entry?.renderEmbedded || entry.id !== rendererId) return { disposition: "invalid" };
  return { disposition: "supported", render: entry.renderEmbedded };
}
