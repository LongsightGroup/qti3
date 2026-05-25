import type { QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import { copySafeAttributes } from "../content/content-dom.js";
import { renderInteractionResponse } from "../interactions/interaction-dispatch.js";
import { interactionLabel, qtiSharedClassNames } from "../interactions/interaction-label.js";
import { renderSelect } from "../interactions/inline-choice-interaction.js";
import { renderInlineTextEntry } from "../interactions/text-interaction.js";
import { renderUnsupportedEmbeddedInteraction } from "../interactions/unsupported-interaction.js";
import type { QtiPlayerMessages } from "../player-messages.js";
import { inlineValidationMessageElement, validationMessageElement } from "../player-validation.js";

export interface BlockInteractionRenderOptions {
  interaction: QtiInteraction;
  messages: QtiPlayerMessages;
  update: (value: QtiValue) => void;
  currentValue: QtiValue;
  isCompleted: () => boolean;
  endAttempt: () => void;
  renderPortableCustom: (
    interaction: QtiInteraction,
    update: (value: QtiValue) => void,
    currentValue: QtiValue,
  ) => HTMLElement;
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
  } = options;
  const field = document.createElement("section");
  field.className = `qti3-interaction qti3-${interaction.type}`;
  field.classList.add(...qtiSharedClassNames(interaction.attributes.class));
  field.dataset.interactionType = interaction.type;
  if (interaction.responseIdentifier)
    field.dataset.responseIdentifier = interaction.responseIdentifier;

  const heading = document.createElement("h3");
  copySafeAttributes(heading, interaction.promptAttributes ?? {});
  heading.textContent = interactionLabel(interaction);
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
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  currentValue: QtiValue,
  messages: QtiPlayerMessages,
): HTMLElement {
  if (interaction.type !== "inlineChoice" && interaction.type !== "textEntry") {
    return renderUnsupportedEmbeddedInteraction(interaction);
  }

  const wrapper = document.createElement("span");
  wrapper.className = `qti3-interaction qti3-${interaction.type} qti3-embedded-interaction`;
  wrapper.dataset.interactionType = interaction.type;
  if (interaction.responseIdentifier)
    wrapper.dataset.responseIdentifier = interaction.responseIdentifier;

  if (interaction.responseIdentifier) {
    wrapper.append(inlineValidationMessageElement(interaction.responseIdentifier));
  }
  wrapper.append(
    interaction.type === "inlineChoice"
      ? renderSelect(interaction, update, currentValue, messages)
      : renderInlineTextEntry(interaction, update, currentValue, messages),
  );
  return wrapper;
}
