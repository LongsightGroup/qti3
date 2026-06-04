import type { QtiInteraction } from "@longsightgroup/qti3-core";

export type SharedVocabularyLabelStyle = "decimal" | "lower-alpha" | "upper-alpha";
export type SharedVocabularyLabelSuffix = "none" | "period" | "parenthesis";
export type SharedVocabularyChoicesPosition = "top" | "bottom" | "left" | "right";
export type OrderChoicesPosition = SharedVocabularyChoicesPosition;
export type OrderOrientation = "horizontal" | "vertical";

export interface SharedVocabularyChoicesLayout {
  choicesPosition: SharedVocabularyChoicesPosition;
  choicesContainerWidth?: number;
}

export interface OrderSharedVocabularyLayout {
  choicesPosition: OrderChoicesPosition;
  orientation: OrderOrientation;
  choicesContainerWidth?: number;
}

export function interactionClassNames(interaction: QtiInteraction): string[] {
  return (interaction.attributes.class ?? "").split(/\s+/).filter(Boolean);
}

export function sharedVocabularyLabel(interaction: QtiInteraction, index: number): string {
  const classNames = new Set(interactionClassNames(interaction));
  if (classNames.has("qti-labels-none")) return "";

  const labels = classNames.has("qti-labels-decimal")
    ? numericLabels()
    : classNames.has("qti-labels-lower-alpha")
      ? "abcdefghijklmnopqrstuvwxyz".split("")
      : "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const suffix = classNames.has("qti-labels-suffix-none")
    ? ""
    : classNames.has("qti-labels-suffix-parenthesis")
      ? ")"
      : ".";
  return `${labels[index] ?? `${index + 1}`}${suffix}`;
}

export function orderSharedVocabularyLayout(
  interaction: QtiInteraction,
): OrderSharedVocabularyLayout | undefined {
  // QTI shared vocabulary order choices positioning, target labels, and suffixes:
  // https://www.imsglobal.org/node/218713
  const choicesLayout = sharedVocabularyChoicesLayout(interaction);
  if (choicesLayout === undefined) return undefined;

  const layout: OrderSharedVocabularyLayout = {
    choicesPosition: choicesLayout.choicesPosition,
    orientation: interaction.attributes.orientation === "vertical" ? "vertical" : "horizontal",
  };
  if (choicesLayout.choicesContainerWidth !== undefined) {
    layout.choicesContainerWidth = choicesLayout.choicesContainerWidth;
  }
  return layout;
}

export function sharedVocabularyChoicesLayout(
  interaction: QtiInteraction,
): SharedVocabularyChoicesLayout | undefined {
  // QTI shared vocabulary choices-bank positioning for match, gap match, graphic gap match, and order:
  // https://www.imsglobal.org/node/218713
  let choicesPosition: SharedVocabularyChoicesPosition | undefined;
  for (const className of interactionClassNames(interaction)) {
    const position = sharedVocabularyChoicesPosition(className);
    if (position !== undefined) {
      choicesPosition = position;
      break;
    }
  }
  if (choicesPosition === undefined) return undefined;

  const layout: SharedVocabularyChoicesLayout = { choicesPosition };
  const width = positivePixelValue(interaction.attributes["data-choices-container-width"]);
  if (width !== undefined) layout.choicesContainerWidth = width;
  return layout;
}

export function applySharedVocabularyChoicesLayout(
  container: HTMLElement,
  choicesBank: HTMLElement,
  mainRegion: HTMLElement,
  layout: SharedVocabularyChoicesLayout | undefined,
): void {
  if (layout === undefined) return;
  container.classList.add("qti3-choices-layout");
  container.dataset.qtiChoicesPosition = layout.choicesPosition;
  choicesBank.classList.add("qti3-choices-bank");
  mainRegion.classList.add("qti3-choices-main");
  if (layout.choicesContainerWidth !== undefined) {
    choicesBank.dataset.qtiChoicesContainerWidth = String(layout.choicesContainerWidth);
    choicesBank.style.setProperty(
      "--qti3-choices-container-width",
      `${layout.choicesContainerWidth}px`,
    );
  }
}

export function appendSharedVocabularyChoicesLayout(
  container: HTMLElement,
  choicesBank: HTMLElement,
  mainRegion: HTMLElement,
  layout: SharedVocabularyChoicesLayout | undefined,
): void {
  applySharedVocabularyChoicesLayout(container, choicesBank, mainRegion, layout);
  if (layout?.choicesPosition === "bottom" || layout?.choicesPosition === "right") {
    container.append(mainRegion, choicesBank);
    return;
  }
  container.append(choicesBank, mainRegion);
}

function numericLabels(): string[] {
  return Array.from({ length: 26 }, (_, item) => `${item + 1}`);
}

function sharedVocabularyChoicesPosition(
  className: string,
): SharedVocabularyChoicesPosition | undefined {
  switch (className) {
    case "qti-choices-top":
      return "top";
    case "qti-choices-bottom":
      return "bottom";
    case "qti-choices-left":
      return "left";
    case "qti-choices-right":
      return "right";
    default:
      return undefined;
  }
}

function positivePixelValue(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
