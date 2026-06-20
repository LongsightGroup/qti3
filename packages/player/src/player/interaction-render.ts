import type { QtiContentNode, QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import { copySafeAttributes } from "../content/content-dom.js";
import { resolveInlineInteractionRoute } from "../interactions/interaction-inline-route.js";
import { renderInteractionResponse } from "../interactions/interaction-registry.js";
import { interactionLabel, qtiSharedClassNames } from "../interactions/interaction-label.js";
import {
  renderUnsupportedEmbeddedInteraction,
  renderUnsupportedInlineInteraction,
} from "../interactions/unsupported-interaction.js";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import { inlineValidationMessageElement, validationMessageElement } from "../player-validation.js";
import { createQtiInteractionRegionMarkers } from "./interaction-regions.js";

export interface BlockInteractionRenderOptions {
  interaction: QtiInteraction;
  messages: PlayerMessageResolver;
  update: (value: QtiValue) => void;
  currentValue: QtiValue;
  isCompleted: () => boolean;
  endAttempt: () => void;
  renderPortableCustom: (
    interaction: QtiInteraction,
    update: (value: QtiValue) => void,
    currentValue: QtiValue,
  ) => HTMLElement;
  renderPromptContent: (nodes: QtiContentNode[]) => Node[];
}

export interface EmbeddedInteractionRenderOptions {
  interaction: QtiInteraction;
  messages: PlayerMessageResolver;
  update: (value: QtiValue) => void;
  currentValue: QtiValue;
  endAttempt: () => void;
}

export function renderBlockInteractionSection(options: BlockInteractionRenderOptions): HTMLElement {
  const {
    interaction,
    messages,
    update,
    currentValue,
    isCompleted,
    endAttempt,
    renderPortableCustom,
    renderPromptContent,
  } = options;
  const regions = createQtiInteractionRegionMarkers(interaction);
  const field = document.createElement("section");
  field.className = `qti3-interaction qti3-${interaction.type}`;
  field.classList.add(...qtiSharedClassNames(interaction.attributes.class));
  field.dataset.interactionType = interaction.type;
  if (interaction.responseIdentifier)
    field.dataset.responseIdentifier = interaction.responseIdentifier;
  regions.interaction(field);

  const heading = document.createElement("h3");
  copySafeAttributes(heading, interaction.promptAttributes ?? {});
  if (interaction.promptContent && interaction.promptContent.length > 0) {
    heading.append(...renderPromptContent(interaction.promptContent));
  } else {
    heading.textContent = interactionLabel(interaction);
  }
  field.append(heading);
  if (interaction.responseIdentifier) {
    field.append(validationMessageElement(interaction.responseIdentifier));
  }

  field.append(
    renderInteractionResponse({
      interaction,
      update,
      currentValue,
      messages,
      isCompleted,
      endAttempt,
      renderPortableCustom,
    }),
  );
  return field;
}

export function renderEmbeddedInteractionSection(
  options: EmbeddedInteractionRenderOptions,
): HTMLElement {
  const { interaction, messages, update, currentValue, endAttempt } = options;
  const route = resolveInlineInteractionRoute(interaction);

  if (route.disposition === "invalid") {
    return renderUnsupportedEmbeddedInteraction(interaction);
  }
  if (route.disposition === "unsupported") {
    return renderUnsupportedInlineInteraction(interaction);
  }

  const regions = createQtiInteractionRegionMarkers(interaction);
  const wrapper = document.createElement("span");
  wrapper.className = `qti3-interaction qti3-${interaction.type} qti3-embedded-interaction`;
  wrapper.classList.add(...qtiSharedClassNames(interaction.attributes.class));
  wrapper.dataset.interactionType = interaction.type;
  if (interaction.responseIdentifier)
    wrapper.dataset.responseIdentifier = interaction.responseIdentifier;
  regions.interaction(wrapper);

  if (interaction.responseIdentifier) {
    wrapper.append(inlineValidationMessageElement(interaction.responseIdentifier));
  }
  wrapper.append(
    route.render({
      interaction,
      update,
      currentValue,
      messages,
      endAttempt,
    }),
  );
  return wrapper;
}
