import type { QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import { renderGraphicOrderResponse } from "../reorder/graphic-order-interaction.js";
import { renderOrderedResponse } from "../reorder/order-interaction.js";
import { renderChoice } from "./choice-interaction.js";
import { renderDrawingResponse } from "./drawing-interaction.js";
import { renderEndAttemptResponse } from "./end-attempt-interaction.js";
import { renderGapMatchResponse } from "./gap-match-interaction.js";
import { renderGraphicAssociateResponse } from "./graphic-associate-interaction.js";
import { renderHotspotResponse } from "./hotspot-interaction.js";
import { renderHottextResponse } from "./hottext-interaction.js";
import { renderInlineChoice } from "./inline-choice-interaction.js";
import { renderMatchResponse } from "./match-interaction.js";
import { renderMediaResponse } from "./media-interaction.js";
import { renderPairResponse } from "./pair-interaction.js";
import { renderPositionObjectResponse } from "./position-object-interaction.js";
import { usesChoiceSet, usesOrderedResponse, usesPairResponse } from "./routing.js";
import { renderSelectPointResponse } from "./select-point-interaction.js";
import { renderSliderResponse } from "./slider-interaction.js";
import { extendedTextFormat } from "./extended-text-shared.js";
import { renderExtendedTextXhtmlResponse } from "./extended-text-xhtml.js";
import { renderInlineTextEntry, renderTextResponse } from "./text-interaction.js";
import { renderUnsupportedInteraction } from "./unsupported-interaction.js";
import { renderUploadResponse } from "./upload-interaction.js";
import {
  inlineEmbedRendererIds,
  isInlineEmbedRendererId,
  type InlineEmbedRendererId,
} from "./interaction-inline-embedding.js";

export interface InteractionResponseContext {
  interaction: QtiInteraction;
  update: (value: QtiValue) => void;
  currentValue: QtiValue;
  messages: PlayerMessageResolver;
  isCompleted: () => boolean;
  endAttempt: () => void;
  renderPortableCustom: (
    interaction: QtiInteraction,
    update: (value: QtiValue) => void,
    currentValue: QtiValue,
  ) => HTMLElement;
}

export interface EmbeddedInteractionResponseContext {
  interaction: QtiInteraction;
  update: (value: QtiValue) => void;
  currentValue: QtiValue;
  messages: PlayerMessageResolver;
  endAttempt: () => void;
}

export type InteractionRendererId =
  | "graphicOrder"
  | "ordered"
  | "gapMatch"
  | "graphicAssociate"
  | "match"
  | "pair"
  | "hotspot"
  | "hottext"
  | "choice"
  | "inlineChoice"
  | "extendedText"
  | "selectPoint"
  | "positionObject"
  | "drawing"
  | "portableCustom"
  | "textEntry"
  | "slider"
  | "upload"
  | "endAttempt"
  | "media";

type InteractionRenderer = (context: InteractionResponseContext) => HTMLElement;
type EmbeddedInteractionRenderer = (context: EmbeddedInteractionResponseContext) => HTMLElement;

const embeddedRenderers: Record<InlineEmbedRendererId, EmbeddedInteractionRenderer> = {
  inlineChoice: ({ interaction, update, currentValue, messages }) =>
    renderInlineChoice(interaction, update, currentValue, messages),
  textEntry: ({ interaction, update, currentValue, messages }) =>
    renderInlineTextEntry(interaction, update, currentValue, messages),
  endAttempt: ({ interaction, update, endAttempt, messages }) =>
    renderEndAttemptResponse(interaction, update, endAttempt, messages),
};

function withInlineEmbedPolicy(entry: InteractionRegistryEntry): InteractionRegistryEntry {
  if (!isInlineEmbedRendererId(entry.id)) return entry;
  return { ...entry, renderEmbedded: embeddedRenderers[entry.id] };
}

function assertInlineEmbedPolicyAlignment(entries: InteractionRegistryEntry[]): void {
  const embeddedIds = inlineEmbedRendererIds();
  for (const rendererId of embeddedIds) {
    const entry = entries.find((candidate) => candidate.id === rendererId);
    if (!entry?.renderEmbedded) {
      throw new Error(
        `INLINE_EMBED_POLICY requires registry entry "${rendererId}" with renderEmbedded.`,
      );
    }
  }
  for (const entry of entries) {
    if (!entry.renderEmbedded) continue;
    if (!isInlineEmbedRendererId(entry.id)) {
      throw new Error(`Registry entry "${entry.id}" has unexpected renderEmbedded hook.`);
    }
  }
}

export type InteractionRegistryEntry = {
  id: InteractionRendererId;
  matches: (interaction: QtiInteraction) => boolean;
  render: InteractionRenderer;
  renderEmbedded?: EmbeddedInteractionRenderer;
};

const baseInteractionRegistry: InteractionRegistryEntry[] = [
  {
    id: "graphicOrder",
    matches: (interaction) => interaction.type === "graphicOrder",
    render: ({ interaction, update, currentValue, messages }) =>
      renderGraphicOrderResponse(interaction, update, currentValue, messages),
  },
  {
    id: "ordered",
    matches: usesOrderedResponse,
    render: ({ interaction, update, currentValue, messages }) =>
      renderOrderedResponse(interaction, update, currentValue, messages),
  },
  {
    id: "gapMatch",
    matches: (interaction) =>
      interaction.type === "gapMatch" || interaction.type === "graphicGapMatch",
    render: ({ interaction, update, currentValue, messages }) =>
      renderGapMatchResponse(interaction, update, currentValue, messages),
  },
  {
    id: "graphicAssociate",
    matches: (interaction) => interaction.type === "graphicAssociate",
    render: ({ interaction, update, currentValue, messages }) =>
      renderGraphicAssociateResponse(interaction, update, currentValue, messages),
  },
  {
    id: "match",
    matches: (interaction) => interaction.type === "match",
    render: ({ interaction, update, currentValue, messages }) =>
      renderMatchResponse(interaction, update, currentValue, messages),
  },
  {
    id: "pair",
    matches: usesPairResponse,
    render: ({ interaction, update, currentValue, messages }) =>
      renderPairResponse(interaction, update, currentValue, messages),
  },
  {
    id: "hotspot",
    matches: (interaction) => interaction.type === "hotspot" && Boolean(interaction.object),
    render: ({ interaction, update, currentValue, messages }) =>
      renderHotspotResponse(interaction, update, currentValue, messages),
  },
  {
    id: "hottext",
    matches: (interaction) => interaction.type === "hottext",
    render: ({ interaction, update, currentValue }) =>
      renderHottextResponse(interaction, update, currentValue),
  },
  {
    id: "choice",
    matches: usesChoiceSet,
    render: ({ interaction, update, currentValue, messages }) =>
      renderChoice(interaction, update, currentValue, messages),
  },
  {
    id: "inlineChoice",
    matches: (interaction) => interaction.type === "inlineChoice",
    render: ({ interaction, update, currentValue, messages }) =>
      renderInlineChoice(interaction, update, currentValue, messages),
  },
  {
    id: "extendedText",
    matches: (interaction) => interaction.type === "extendedText",
    render: ({ interaction, update, currentValue, messages }) =>
      extendedTextFormat(interaction) === "xhtml"
        ? renderExtendedTextXhtmlResponse(interaction, update, currentValue, messages)
        : renderTextResponse(interaction, update, "extended", currentValue, messages),
  },
  {
    id: "selectPoint",
    matches: (interaction) => interaction.type === "selectPoint",
    render: ({ interaction, update, currentValue, messages }) =>
      renderSelectPointResponse(interaction, update, currentValue, messages),
  },
  {
    id: "positionObject",
    matches: (interaction) => interaction.type === "positionObject",
    render: ({ interaction, update, currentValue, messages }) =>
      renderPositionObjectResponse(interaction, update, currentValue, messages),
  },
  {
    id: "drawing",
    matches: (interaction) => interaction.type === "drawing",
    render: ({ interaction, update, currentValue, messages }) =>
      renderDrawingResponse(interaction, update, currentValue, messages),
  },
  {
    id: "portableCustom",
    matches: (interaction) => interaction.type === "portableCustom",
    render: ({ interaction, update, currentValue, renderPortableCustom }) =>
      renderPortableCustom(interaction, update, currentValue),
  },
  {
    id: "textEntry",
    matches: (interaction) => interaction.type === "textEntry",
    render: ({ interaction, update, currentValue, messages }) =>
      renderTextResponse(interaction, update, "entry", currentValue, messages),
  },
  {
    id: "slider",
    matches: (interaction) => interaction.type === "slider",
    render: ({ interaction, update, currentValue, messages }) =>
      renderSliderResponse(interaction, update, currentValue, messages),
  },
  {
    id: "upload",
    matches: (interaction) => interaction.type === "upload",
    render: ({ interaction, update, messages }) =>
      renderUploadResponse(interaction, update, messages),
  },
  {
    id: "endAttempt",
    matches: (interaction) => interaction.type === "endAttempt",
    render: ({ interaction, update, endAttempt, messages }) =>
      renderEndAttemptResponse(interaction, update, endAttempt, messages),
  },
  {
    id: "media",
    matches: (interaction) => interaction.type === "media",
    render: ({ interaction, update, currentValue, isCompleted }) =>
      renderMediaResponse(interaction, {
        currentValue,
        update,
        isCompleted,
      }),
  },
];

export const interactionRegistry: InteractionRegistryEntry[] =
  baseInteractionRegistry.map(withInlineEmbedPolicy);

assertInlineEmbedPolicyAlignment(interactionRegistry);

export function matchInteractionRegistryEntry(
  interaction: QtiInteraction,
): InteractionRegistryEntry | undefined {
  return interactionRegistry.find((entry) => entry.matches(interaction));
}

export function isInteractionSupported(interaction: QtiInteraction): boolean {
  return matchInteractionRegistryEntry(interaction) !== undefined;
}

export function renderInteractionResponse(context: InteractionResponseContext): HTMLElement {
  const entry = matchInteractionRegistryEntry(context.interaction);
  if (entry) return entry.render(context);
  return renderUnsupportedInteraction(context.interaction);
}
