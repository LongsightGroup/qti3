import type { QtiChoice, QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import {
  interactionChoices,
  missingChoicesMessage,
  valueToStrings,
} from "../interaction-support.js";
import { createQtiInteractionRegionMarkers } from "../player/interaction-regions.js";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import { interactionLabel } from "./interaction-label.js";
import { appendChoiceVisual, hasRichChoiceContent, setChoiceAccessibleName } from "./shared.js";
import { applyInputWidth, inputWidth } from "./shared-vocabulary.js";

let inlineChoiceId = 0;

interface InlineChoiceOption {
  identifier: string;
  text: string;
  choice?: QtiChoice | undefined;
}

function selectedIdentifier(choices: QtiChoice[], value: QtiValue): string | undefined {
  const [selected] = valueToStrings(value);
  if (!selected) return undefined;
  return choices.find((choice) => choice.identifier === selected)?.identifier;
}

function renderOptionContent(container: HTMLElement, option: InlineChoiceOption): void {
  if (!option.choice) {
    container.textContent = option.text;
    container.setAttribute("aria-label", option.text);
    return;
  }

  if (hasRichChoiceContent(option.choice)) appendChoiceVisual(container, option.choice);
  else container.textContent = option.text;
  setChoiceAccessibleName(container, option.choice);
}

function renderSelectedContent(
  container: HTMLElement,
  option: InlineChoiceOption | undefined,
  prompt: string,
): void {
  if (option?.choice) {
    appendChoiceVisual(container, option.choice);
    return;
  }
  container.textContent = option?.text ?? prompt;
}

function selectedTriggerLabel(interaction: QtiInteraction, option: InlineChoiceOption | undefined) {
  if (option?.choice) return `${interactionLabel(interaction)}: ${option.choice.text}`;
  return interactionLabel(interaction);
}

function focusOption(options: HTMLElement[], index: number): void {
  options[Math.max(0, Math.min(index, options.length - 1))]?.focus();
}

export function renderInlineChoice(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  currentValue: QtiValue,
  messages: PlayerMessageResolver,
): HTMLElement {
  const choices = interactionChoices(interaction);
  if (choices.length === 0) return missingChoicesMessage(interaction);

  const controlId = `qti3-inline-choice-${inlineChoiceId++}`;
  const prompt = messages.message("inlineChoicePrompt");
  const label = interactionLabel(interaction);
  const regions = createQtiInteractionRegionMarkers(interaction);
  const options: InlineChoiceOption[] = [
    { identifier: "", text: prompt },
    ...choices.map((choice) => ({ identifier: choice.identifier, text: choice.text, choice })),
  ];
  let selected = selectedIdentifier(choices, currentValue);
  let activeIndex = Math.max(
    0,
    options.findIndex((option) => option.identifier === (selected ?? "")),
  );

  const wrapper = document.createElement("span");
  wrapper.className = "qti3-inline-choice-control";
  applyInputWidth(wrapper, inputWidth(interaction.attributes));
  regions.control(wrapper);

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "qti3-inline-choice-trigger";
  trigger.id = `${controlId}-trigger`;
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-controls", `${controlId}-listbox`);
  trigger.setAttribute("aria-label", label);
  if (interaction.responseIdentifier) trigger.name = interaction.responseIdentifier;

  const selectedContent = document.createElement("span");
  selectedContent.className = "qti3-inline-choice-selected";
  trigger.append(selectedContent);

  const listbox = document.createElement("span");
  listbox.className = "qti3-inline-choice-listbox";
  listbox.id = `${controlId}-listbox`;
  listbox.role = "listbox";
  listbox.setAttribute("aria-labelledby", trigger.id);
  listbox.hidden = true;

  const close = (restoreFocus: boolean): void => {
    listbox.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) trigger.focus();
  };

  const optionElements = options.map((option, index) => {
    const item = document.createElement("span");
    item.className = "qti3-inline-choice-option";
    item.id = `${controlId}-option-${index}`;
    item.role = "option";
    item.tabIndex = -1;
    item.dataset.choiceIdentifier = option.identifier;
    if (option.identifier) {
      regions.choice(item, option.identifier);
    }
    renderOptionContent(item, option);
    return item;
  });

  const syncSelection = (): void => {
    const selectedOption = options.find((option) => option.identifier === (selected ?? ""));
    selectedContent.replaceChildren();
    renderSelectedContent(selectedContent, selectedOption, prompt);
    trigger.dataset.value = selected ?? "";
    trigger.setAttribute("aria-label", selectedTriggerLabel(interaction, selectedOption));
    for (const optionElement of optionElements) {
      const isSelected = optionElement.dataset.choiceIdentifier === (selected ?? "");
      optionElement.dataset.selected = String(isSelected);
      optionElement.setAttribute("aria-selected", String(isSelected));
    }
  };

  const open = (nextActiveIndex = activeIndex): void => {
    listbox.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    activeIndex = nextActiveIndex;
    focusOption(optionElements, activeIndex);
  };

  const selectOption = (identifier: string): void => {
    selected = identifier || undefined;
    activeIndex = Math.max(
      0,
      options.findIndex((option) => option.identifier === identifier),
    );
    syncSelection();
    update(identifier === "" ? null : identifier);
    close(true);
  };

  optionElements.forEach((optionElement, index) => {
    optionElement.addEventListener("click", () => selectOption(options[index]?.identifier ?? ""));
  });

  trigger.addEventListener("click", () => {
    if (listbox.hidden) open();
    else close(false);
  });

  wrapper.addEventListener("keydown", (event) => {
    if (listbox.hidden) {
      if (event.target !== trigger) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const selectedIndex = options.findIndex((option) => option.identifier === (selected ?? ""));
        open(event.key === "ArrowDown" ? Math.max(0, selectedIndex) : optionElements.length - 1);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key === "Tab") {
      close(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex =
        event.key === "ArrowDown"
          ? (activeIndex + 1) % optionElements.length
          : (activeIndex - 1 + optionElements.length) % optionElements.length;
      focusOption(optionElements, activeIndex);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      activeIndex = event.key === "Home" ? 0 : optionElements.length - 1;
      focusOption(optionElements, activeIndex);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectOption(options[activeIndex]?.identifier ?? "");
    }
  });

  wrapper.addEventListener("focusout", () => {
    window.setTimeout(() => {
      if (!wrapper.contains(document.activeElement)) close(false);
    });
  });

  listbox.append(...optionElements);
  wrapper.append(trigger, listbox);
  syncSelection();
  return wrapper;
}
