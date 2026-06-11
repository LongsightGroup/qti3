import {
  extendedTextCounterStateFromAttributes,
  extendedTextCounterValues,
  extendedTextHeightLinesFromAttributes,
  type ExtendedTextCounterState,
  type QtiInteraction,
  type SharedVocabularyExtendedTextCounterPosition,
} from "@longsightgroup/qti3-core";
import type { PlayerMessageResolver } from "../player-message-resolver.js";

export type ExtendedTextFormat = "plain" | "xhtml";

export function extendedTextFormat(interaction: QtiInteraction): ExtendedTextFormat {
  return interaction.attributes.format === "xhtml" ? "xhtml" : "plain";
}

export function expectedExtendedTextRows(interaction: QtiInteraction): number | undefined {
  const sharedVocabularyRows = extendedTextHeightLinesFromAttributes(interaction.attributes);
  if (sharedVocabularyRows !== undefined) return sharedVocabularyRows;

  const expectedLines = Number(interaction.attributes["expected-lines"] ?? 0);
  return Number.isFinite(expectedLines) && expectedLines > 0 ? expectedLines : undefined;
}

export function createExtendedTextCounter(
  counterState: ExtendedTextCounterState | undefined,
): HTMLElement | undefined {
  if (!counterState) return undefined;
  const counter = document.createElement("p");
  counter.className = "qti3-counter";
  counter.setAttribute("aria-live", "polite");
  return counter;
}

export function syncExtendedTextCounter(
  counter: HTMLElement | undefined,
  counterState: ExtendedTextCounterState | undefined,
  visibleLength: number,
  messages: PlayerMessageResolver,
): void {
  if (!counter || !counterState) return;
  counter.textContent = messages.message(
    "extendedTextCounter",
    extendedTextCounterValues(counterState.position, visibleLength, counterState.expectedLength),
  );
}

export function applyExtendedTextRows(
  control: HTMLTextAreaElement | HTMLElement,
  rows: number,
): void {
  if (control instanceof HTMLTextAreaElement) {
    control.rows = rows;
    return;
  }
  control.style.setProperty("--qti3-extended-text-rows", String(rows));
}

function appendInOrder(group: HTMLElement, ...nodes: Array<HTMLElement | undefined>): void {
  for (const node of nodes) {
    if (node) group.append(node);
  }
}

export function appendExtendedTextResponseChildren(
  group: HTMLElement,
  options: {
    control: HTMLElement;
    patternMaskMessage?: HTMLElement | undefined;
    counter?: HTMLElement | undefined;
    counterPosition?: SharedVocabularyExtendedTextCounterPosition | undefined;
  },
): void {
  const { control, patternMaskMessage, counter, counterPosition } = options;
  if (counter && counterPosition === "up") {
    appendInOrder(group, counter, control, patternMaskMessage);
    return;
  }
  appendInOrder(group, control, patternMaskMessage, counter);
}

export function extendedTextCounterState(
  interaction: QtiInteraction,
): ExtendedTextCounterState | undefined {
  return extendedTextCounterStateFromAttributes(interaction.attributes);
}

export function extendedTextAriaLabel(
  interaction: QtiInteraction,
  messages: PlayerMessageResolver,
): string {
  return interaction.prompt ?? messages.message("extendedTextResponseLabel");
}
