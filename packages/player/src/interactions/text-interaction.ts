import { type QtiInteraction, type QtiValue } from "@longsightgroup/qti3-core";
import { createQtiInteractionRegionMarkers } from "../player/interaction-regions.js";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import {
  appendExtendedTextResponseChildren,
  applyExtendedTextRows,
  createExtendedTextCounter,
  expectedExtendedTextRows,
  extendedTextCounterState,
  syncExtendedTextCounter,
} from "./extended-text-shared.js";
import { scalarString } from "./text-value.js";
import { wireTextControlConstraints } from "./text-control-constraints.js";
import { applyInputWidth, inputWidth } from "./shared-vocabulary.js";

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

function appendInOrder(group: HTMLElement, ...nodes: Array<HTMLElement | undefined>): void {
  for (const node of nodes) {
    if (node) group.append(node);
  }
}

export function renderTextResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  mode: "entry" | "extended",
  currentValue: QtiValue,
  messages: PlayerMessageResolver,
): HTMLElement {
  const regions = createQtiInteractionRegionMarkers(interaction);
  const group = document.createElement("div");
  group.className = "qti3-text-response";
  const expectedLength = Number(interaction.attributes["expected-length"] ?? 0);
  const control =
    mode === "extended" ? document.createElement("textarea") : document.createElement("input");
  control.className = mode === "extended" ? "qti3-textarea" : "qti3-text-input";
  control.value = scalarString(currentValue);
  regions.control(control);
  control.setAttribute(
    "aria-label",
    interaction.prompt ??
      (mode === "extended"
        ? messages.message("extendedTextResponseLabel")
        : messages.message("textResponseLabel")),
  );
  const rows = mode === "extended" ? expectedExtendedTextRows(interaction) : undefined;
  if (rows !== undefined) applyExtendedTextRows(control, rows);
  const patternMaskMessage = wireTextControlConstraints(control, interaction, messages);
  if (mode === "entry") {
    // qti-input-width-* applies to text-entry controls; extended text keeps textarea sizing.
    applyTextEntryWidthWithPrecedence(interaction, control, expectedLength);
  }
  const counterState = mode === "extended" ? extendedTextCounterState(interaction) : undefined;
  const counter = createExtendedTextCounter(counterState);
  const sync = (emitResponse = true) => {
    const value = control.value;
    syncExtendedTextCounter(counter, counterState, value.length, messages);
    if (emitResponse) update(value);
  };
  control.addEventListener("input", () => sync());
  control.addEventListener("change", () => sync());
  sync(false);
  appendExtendedTextResponseChildren(group, {
    control,
    patternMaskMessage,
    counter,
    counterPosition: counterState?.position,
  });
  return group;
}

export function renderInlineTextEntry(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  currentValue: QtiValue,
  messages: PlayerMessageResolver,
): HTMLElement {
  const regions = createQtiInteractionRegionMarkers(interaction);
  const group = document.createElement("span");
  group.className = "qti3-inline-text-response";
  const input = document.createElement("input");
  input.className = "qti3-text-input qti3-inline-text-input";
  input.value = scalarString(currentValue);
  regions.control(input);
  input.setAttribute(
    "aria-label",
    interaction.prompt ?? interaction.contextText ?? messages.message("textResponseLabel"),
  );
  const expectedLength = Number(interaction.attributes["expected-length"] ?? 0);
  applyTextEntryWidthWithPrecedence(interaction, input, expectedLength);
  const patternMaskMessage = wireTextControlConstraints(input, interaction, messages, {
    messageTag: "span",
  });
  const sync = (emitResponse = true) => {
    if (emitResponse) update(input.value);
  };
  input.addEventListener("input", () => sync());
  input.addEventListener("change", () => sync());
  sync(false);
  appendInOrder(group, input, patternMaskMessage);
  return group;
}
