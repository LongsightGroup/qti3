import {
  extendedTextCounterPositionFromAttributes,
  extendedTextHeightLinesFromAttributes,
  type QtiInteraction,
  type QtiValue,
  type SharedVocabularyExtendedTextCounterPosition,
} from "@longsightgroup/qti3-core";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import { applyInputWidth, inputWidth } from "./shared-vocabulary.js";

function scalarString(value: QtiValue): string {
  if (value === null || Array.isArray(value) || typeof value === "object") return "";
  return String(value);
}

function coerceResponseInputValue(
  value: string,
  baseType: QtiInteraction["responseBaseType"],
): QtiValue {
  if (baseType === "integer") return Number.parseInt(value, 10);
  if (baseType === "float") return Number.parseFloat(value);
  if (baseType === "boolean") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return value;
}

function applyExpectedTextEntryWidth(
  control: HTMLInputElement | HTMLTextAreaElement,
  expectedLength: number,
): void {
  if (!(control instanceof HTMLInputElement) || expectedLength <= 0) return;
  const width = Math.max(8, Math.min(expectedLength + 2, 72));
  control.style.inlineSize = `${width}ch`;
}

function applyTextEntryWidthWithPrecedence(
  interaction: QtiInteraction,
  control: HTMLInputElement | HTMLTextAreaElement,
  expectedLength: number,
): void {
  // Authored qti-input-width-* shared vocabulary takes precedence over expected-length hints.
  if (!applyInputWidth(control, inputWidth(interaction.attributes))) {
    applyExpectedTextEntryWidth(control, expectedLength);
  }
}

function expectedRows(interaction: QtiInteraction): number | undefined {
  const sharedVocabularyRows = extendedTextHeightLinesFromAttributes(interaction.attributes);
  if (sharedVocabularyRows !== undefined) return sharedVocabularyRows;

  const expectedLines = Number(interaction.attributes["expected-lines"] ?? 0);
  return Number.isFinite(expectedLines) && expectedLines > 0 ? expectedLines : undefined;
}

function appendExtendedTextControl(
  group: HTMLElement,
  control: HTMLElement,
  counter: HTMLElement | undefined,
  counterPosition: SharedVocabularyExtendedTextCounterPosition | undefined,
): void {
  if (counter && counterPosition === "up") {
    group.append(counter, control);
    return;
  }
  group.append(control);
  if (counter) group.append(counter);
}

export function renderTextResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  mode: "entry" | "extended",
  currentValue: QtiValue,
  messages: PlayerMessageResolver,
): HTMLElement {
  const group = document.createElement("div");
  group.className = "qti3-text-response";
  const expectedLength = Number(interaction.attributes["expected-length"] ?? 0);
  const control =
    mode === "extended" ? document.createElement("textarea") : document.createElement("input");
  control.className = mode === "extended" ? "qti3-textarea" : "qti3-text-input";
  control.value = scalarString(currentValue);
  control.setAttribute(
    "aria-label",
    interaction.prompt ??
      (mode === "extended"
        ? messages.message("extendedTextResponseLabel")
        : messages.message("textResponseLabel")),
  );
  const rows = mode === "extended" ? expectedRows(interaction) : undefined;
  if (rows !== undefined) {
    (control as HTMLTextAreaElement).rows = rows;
  }
  if (mode === "entry") {
    // qti-input-width-* applies to text-entry controls; extended text keeps textarea sizing.
    applyTextEntryWidthWithPrecedence(interaction, control, expectedLength);
  }
  const counter = mode === "extended" ? document.createElement("p") : undefined;
  if (counter) {
    counter.className = "qti3-counter";
    counter.setAttribute("aria-live", "polite");
  }
  const sync = (emitResponse = true) => {
    const value = control.value;
    if (counter) {
      const words = value.trim().length > 0 ? value.trim().split(/\s+/).length : 0;
      counter.textContent = messages.message("extendedTextCounter", {
        characters: value.length,
        words,
      });
    }
    if (emitResponse) update(value);
  };
  control.addEventListener("input", () => sync());
  control.addEventListener("change", () => sync());
  sync(false);
  appendExtendedTextControl(
    group,
    control,
    counter,
    extendedTextCounterPositionFromAttributes(interaction.attributes),
  );
  return group;
}

export function renderInlineTextEntry(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  currentValue: QtiValue,
  messages: PlayerMessageResolver,
): HTMLElement {
  const group = document.createElement("span");
  group.className = "qti3-inline-text-response";
  const input = document.createElement("input");
  input.className = "qti3-text-input qti3-inline-text-input";
  input.value = scalarString(currentValue);
  input.setAttribute(
    "aria-label",
    interaction.prompt ?? interaction.contextText ?? messages.message("textResponseLabel"),
  );
  const expectedLength = Number(interaction.attributes["expected-length"] ?? 0);
  applyTextEntryWidthWithPrecedence(interaction, input, expectedLength);
  const sync = (emitResponse = true) => {
    if (emitResponse) update(input.value);
  };
  input.addEventListener("input", () => sync());
  input.addEventListener("change", () => sync());
  sync(false);
  group.append(input);
  return group;
}

export function renderSliderResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  currentValue: QtiValue,
  messages: PlayerMessageResolver,
): HTMLElement {
  const group = document.createElement("div");
  group.className = "qti3-slider-response";
  const input = document.createElement("input");
  input.type = "range";
  input.min = interaction.attributes["lower-bound"] ?? "0";
  input.max = interaction.attributes["upper-bound"] ?? "100";
  input.step = interaction.attributes.step ?? "1";
  input.value = scalarString(currentValue) || interaction.attributes["lower-bound"] || "0";
  input.setAttribute("aria-label", interaction.prompt ?? messages.message("sliderResponseLabel"));
  const output = document.createElement("output");
  output.className = "qti3-slider-output";
  output.value = input.value;
  output.textContent = input.value;
  const sync = () => {
    output.value = input.value;
    output.textContent = input.value;
    update(coerceResponseInputValue(input.value, interaction.responseBaseType));
  };
  input.addEventListener("input", sync);
  group.append(input, output);
  return group;
}
