import { compileQtiPatternMask, type QtiInteraction } from "@longsightgroup/qti3-core";
import {
  CONTROL_PATTERN_MASK_INVALID,
  syncControlAriaInvalid,
} from "../dom/control-invalid-state.js";
import { mergeTokenAttribute, removeTokenAttribute } from "../dom/token-attribute.js";
import type { PlayerMessageResolver } from "../player-message-resolver.js";

export function patternMaskMessageId(responseIdentifier: string): string {
  return `qti3-pattern-mask-${responseIdentifier}`;
}

function controlValueAfterEdit(
  control: HTMLInputElement | HTMLTextAreaElement,
  replacement: string,
): string {
  const selectionStart = control.selectionStart ?? control.value.length;
  const selectionEnd = control.selectionEnd ?? selectionStart;
  return `${control.value.slice(0, selectionStart)}${replacement}${control.value.slice(selectionEnd)}`;
}

export interface WirePatternMaskOptions {
  messageTag?: "p" | "span";
}

export function wirePatternMask(
  control: HTMLInputElement | HTMLTextAreaElement,
  interaction: QtiInteraction,
  messages: PlayerMessageResolver,
  options: WirePatternMaskOptions = {},
): HTMLElement | undefined {
  const authoredPattern = interaction.attributes["pattern-mask"];
  if (!authoredPattern) return undefined;

  const patternMask = compileQtiPatternMask(authoredPattern);
  if (!patternMask) return undefined;

  const responseIdentifier = interaction.responseIdentifier;
  if (!responseIdentifier) return undefined;

  const messageText =
    interaction.attributes["data-patternmask-message"] ?? messages.message("patternMaskMismatch");
  const message = document.createElement(options.messageTag ?? "p");
  message.id = patternMaskMessageId(responseIdentifier);
  message.className = "qti3-pattern-mask-message";
  message.hidden = true;
  message.setAttribute("aria-live", "polite");
  message.textContent = messageText;
  let lastValidValue = patternMask.test(control.value) ? control.value : "";

  const validate = (showMessage: boolean) => {
    const isValid = patternMask.test(control.value);
    control.setCustomValidity(isValid ? "" : messageText);
    message.hidden = !(showMessage && !isValid);
    if (isValid) {
      lastValidValue = control.value;
      delete control.dataset[CONTROL_PATTERN_MASK_INVALID];
    } else if (!message.hidden) {
      control.dataset[CONTROL_PATTERN_MASK_INVALID] = "true";
    } else {
      delete control.dataset[CONTROL_PATTERN_MASK_INVALID];
    }

    if (message.hidden) {
      removeTokenAttribute(control, "aria-describedby", message.id);
    } else {
      mergeTokenAttribute(control, "aria-describedby", message.id);
    }
    syncControlAriaInvalid(control);
  };

  control.addEventListener("beforeinput", (event) => {
    if (!(event instanceof InputEvent)) return;
    if (event.isComposing || event.inputType.startsWith("delete")) return;
    const replacement = event.inputType === "insertLineBreak" ? "\n" : event.data;
    if (replacement === null) return;
    if (!patternMask.test(controlValueAfterEdit(control, replacement))) {
      event.preventDefault();
    }
  });
  control.addEventListener("input", () => {
    if (!patternMask.test(control.value)) {
      const selectionStart = Math.min(
        control.selectionStart ?? lastValidValue.length,
        lastValidValue.length,
      );
      control.value = lastValidValue;
      control.setSelectionRange(selectionStart, selectionStart);
    }
    validate(!message.hidden);
  });
  control.addEventListener("change", () => validate(true));
  control.addEventListener("blur", () => validate(true));
  validate(false);
  return message;
}
