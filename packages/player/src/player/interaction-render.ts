import type { QtiContentNode, QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import { copySafeAttributes } from "../content/content-dom.js";
import {
  inlineEmbeddingDisposition,
  renderEmbeddedInteractionContent,
  renderInteractionResponse,
} from "../interactions/interaction-dispatch.js";
import { interactionLabel, qtiSharedClassNames } from "../interactions/interaction-label.js";
import {
  renderUnsupportedEmbeddedInteraction,
  renderUnsupportedInlineInteraction,
} from "../interactions/unsupported-interaction.js";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import { inlineValidationMessageElement, validationMessageElement } from "../player-validation.js";

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
  const field = document.createElement("section");
  field.className = `qti3-interaction qti3-${interaction.type}`;
  field.classList.add(...qtiSharedClassNames(interaction.attributes.class));
  field.dataset.interactionType = interaction.type;
  if (interaction.responseIdentifier)
    field.dataset.responseIdentifier = interaction.responseIdentifier;

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

  switch (inlineEmbeddingDisposition(interaction)) {
    case "invalid":
      return renderUnsupportedEmbeddedInteraction(interaction);
    case "unsupported":
      return renderUnsupportedInlineInteraction(interaction);
    case "supported":
      break;
  }

  const wrapper = document.createElement("span");
  wrapper.className = `qti3-interaction qti3-${interaction.type} qti3-embedded-interaction`;
  wrapper.classList.add(...qtiSharedClassNames(interaction.attributes.class));
  wrapper.dataset.interactionType = interaction.type;
  if (interaction.responseIdentifier)
    wrapper.dataset.responseIdentifier = interaction.responseIdentifier;

  if (interaction.responseIdentifier) {
    wrapper.append(inlineValidationMessageElement(interaction.responseIdentifier));
  }
  wrapper.append(
    renderEmbeddedInteractionContent({
      interaction,
      update,
      currentValue,
      messages,
      endAttempt,
    }),
  );
  return wrapper;
}
