import type { QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import type { QtiPlayerMessages } from "../player-messages.js";
import { renderChoice } from "./choice-interaction.js";
import { renderDrawingResponse } from "./drawing-interaction.js";
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
import {
  renderInlineTextEntry,
  renderSliderResponse,
  renderTextResponse,
} from "./text-interaction.js";
import { renderUnsupportedInteraction } from "./unsupported-interaction.js";
import { renderGraphicOrderResponse } from "../reorder/graphic-order-interaction.js";
import { renderOrderedResponse } from "../reorder/order-interaction.js";

export interface InteractionResponseContext {
  interaction: QtiInteraction;
  update: (value: QtiValue) => void;
  currentValue: QtiValue;
  messages: QtiPlayerMessages;
  isCompleted: () => boolean;
  interactionLabel: string;
  endAttempt: () => void;
  renderPortableCustom: (
    interaction: QtiInteraction,
    update: (value: QtiValue) => void,
    currentValue: QtiValue,
  ) => HTMLElement;
}

type InteractionRenderer = (context: InteractionResponseContext) => HTMLElement;

const interactionRenderers: Array<{
  matches: (interaction: QtiInteraction) => boolean;
  render: InteractionRenderer;
}> = [
  {
    matches: (interaction) => interaction.type === "graphicOrder",
    render: ({ interaction, update, currentValue, messages }) =>
      renderGraphicOrderResponse(interaction, update, currentValue, messages),
  },
  {
    matches: usesOrderedResponse,
    render: ({ interaction, update, currentValue }) =>
      renderOrderedResponse(interaction, update, currentValue),
  },
  {
    matches: (interaction) =>
      interaction.type === "gapMatch" || interaction.type === "graphicGapMatch",
    render: ({ interaction, update, currentValue }) =>
      renderGapMatchResponse(interaction, update, currentValue),
  },
  {
    matches: (interaction) => interaction.type === "graphicAssociate",
    render: ({ interaction, update, currentValue, messages }) =>
      renderGraphicAssociateResponse(interaction, update, currentValue, messages),
  },
  {
    matches: (interaction) => interaction.type === "match",
    render: ({ interaction, update, currentValue, messages }) =>
      renderMatchResponse(interaction, update, currentValue, messages),
  },
  {
    matches: usesPairResponse,
    render: ({ interaction, update, currentValue, messages }) =>
      renderPairResponse(interaction, update, currentValue, messages),
  },
  {
    matches: (interaction) => interaction.type === "hotspot" && Boolean(interaction.object),
    render: ({ interaction, update, currentValue }) =>
      renderHotspotResponse(interaction, update, currentValue),
  },
  {
    matches: (interaction) => interaction.type === "hottext",
    render: ({ interaction, update, currentValue }) =>
      renderHottextResponse(interaction, update, currentValue),
  },
  {
    matches: usesChoiceSet,
    render: ({ interaction, update, currentValue }) =>
      renderChoice(interaction, update, currentValue),
  },
  {
    matches: (interaction) => interaction.type === "inlineChoice",
    render: ({ interaction, update, currentValue }) =>
      renderSelect(interaction, update, currentValue),
  },
  {
    matches: (interaction) => interaction.type === "extendedText",
    render: ({ interaction, update, currentValue }) =>
      renderTextResponse(interaction, update, "extended", currentValue),
  },
  {
    matches: (interaction) => interaction.type === "selectPoint",
    render: ({ interaction, update, currentValue }) =>
      renderSelectPointResponse(interaction, update, currentValue),
  },
  {
    matches: (interaction) => interaction.type === "positionObject",
    render: ({ interaction, update, currentValue }) =>
      renderPositionObjectResponse(interaction, update, currentValue),
  },
  {
    matches: (interaction) => interaction.type === "drawing",
    render: ({ interaction, update, currentValue }) =>
      renderDrawingResponse(interaction, update, currentValue),
  },
  {
    matches: (interaction) => interaction.type === "portableCustom",
    render: ({ interaction, update, currentValue, renderPortableCustom }) =>
      renderPortableCustom(interaction, update, currentValue),
  },
  {
    matches: (interaction) => interaction.type === "textEntry",
    render: ({ interaction, update, currentValue }) =>
      renderTextResponse(interaction, update, "entry", currentValue),
  },
  {
    matches: (interaction) => interaction.type === "slider",
    render: ({ interaction, update, currentValue }) =>
      renderSliderResponse(interaction, update, currentValue),
  },
  {
    matches: (interaction) => interaction.type === "upload",
    render: ({ interaction, update, interactionLabel }) => {
      const input = document.createElement("input");
      input.type = "file";
      input.setAttribute("aria-label", interactionLabel || "Upload response");
      input.addEventListener("change", () => update(input.files?.[0]?.name ?? ""));
      return input;
    },
  },
  {
    matches: (interaction) => interaction.type === "endAttempt",
    render: ({ interaction, update, endAttempt }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = interaction.attributes.title ?? "End attempt";
      button.addEventListener("click", () => {
        if (interaction.responseIdentifier) update(true);
        endAttempt();
      });
      return button;
    },
  },
  {
    matches: (interaction) => interaction.type === "media",
    render: ({ interaction, update, currentValue, isCompleted }) =>
      renderObjectAsset(interaction, {
        currentValue,
        update,
        isCompleted,
      }),
  },
];

export function renderInteractionResponse(context: InteractionResponseContext): HTMLElement {
  for (const entry of interactionRenderers) {
    if (entry.matches(context.interaction)) return entry.render(context);
  }
  return renderUnsupportedInteraction(context.interaction);
}
