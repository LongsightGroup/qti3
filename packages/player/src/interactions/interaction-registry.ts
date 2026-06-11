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
import { renderSelect } from "./inline-choice-interaction.js";
import { renderMatchResponse } from "./match-interaction.js";
import { renderObjectAsset } from "./object-asset.js";
import { renderPairResponse } from "./pair-interaction.js";
import { renderPositionObjectResponse } from "./position-object-interaction.js";
import { usesChoiceSet, usesOrderedResponse, usesPairResponse } from "./routing.js";
import { renderSelectPointResponse } from "./select-point-interaction.js";
import { extendedTextFormat } from "./extended-text-shared.js";
import { renderExtendedTextXhtmlResponse } from "./extended-text-xhtml.js";
import {
  renderInlineTextEntry,
  renderSliderResponse,
  renderTextResponse,
} from "./text-interaction.js";
import { renderUnsupportedInteraction } from "./unsupported-interaction.js";
import { renderUploadResponse } from "./upload-interaction.js";

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

export type InlineEmbeddingDisposition = "supported" | "unsupported" | "invalid";

export interface InteractionRegistryEntry {
  id: InteractionRendererId;
  matches: (interaction: QtiInteraction) => boolean;
  render: InteractionRenderer;
  renderEmbedded?: EmbeddedInteractionRenderer;
}

const inlineUnsupportedInteractionTypes = new Set<QtiInteraction["type"]>(["custom"]);

export const interactionRegistry: InteractionRegistryEntry[] = [
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
      renderSelect(interaction, update, currentValue, messages),
    renderEmbedded: ({ interaction, update, currentValue, messages }) =>
      renderSelect(interaction, update, currentValue, messages),
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
    renderEmbedded: ({ interaction, update, currentValue, messages }) =>
      renderInlineTextEntry(interaction, update, currentValue, messages),
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
    renderEmbedded: ({ interaction, update, endAttempt, messages }) =>
      renderEndAttemptResponse(interaction, update, endAttempt, messages),
  },
  {
    id: "media",
    matches: (interaction) => interaction.type === "media",
    render: ({ interaction, update, currentValue, isCompleted }) =>
      renderObjectAsset(interaction, {
        currentValue,
        update,
        isCompleted,
      }),
  },
];

export function matchInteractionRegistryEntry(
  interaction: QtiInteraction,
): InteractionRegistryEntry | undefined {
  return interactionRegistry.find((entry) => entry.matches(interaction));
}

export function isInteractionSupported(interaction: QtiInteraction): boolean {
  return matchInteractionRegistryEntry(interaction) !== undefined;
}

export function inlineEmbeddingDisposition(
  interaction: QtiInteraction,
): InlineEmbeddingDisposition {
  if (inlineUnsupportedInteractionTypes.has(interaction.type)) return "unsupported";
  const entry = matchInteractionRegistryEntry(interaction);
  return entry?.renderEmbedded ? "supported" : "invalid";
}

export function isInlineEmbeddableInteraction(interaction: QtiInteraction): boolean {
  return inlineEmbeddingDisposition(interaction) !== "invalid";
}

export function renderEmbeddedInteractionContent(
  context: EmbeddedInteractionResponseContext,
): HTMLElement {
  const entry = matchInteractionRegistryEntry(context.interaction);
  if (!entry?.renderEmbedded) {
    throw new Error(
      `Interaction type "${context.interaction.type}" is not configured for inline embedding.`,
    );
  }
  return entry.renderEmbedded(context);
}

export function renderInteractionResponse(context: InteractionResponseContext): HTMLElement {
  const entry = matchInteractionRegistryEntry(context.interaction);
  if (entry) return entry.render(context);
  return renderUnsupportedInteraction(context.interaction);
}
