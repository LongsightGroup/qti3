import type { QtiInteraction } from "@longsightgroup/qti3-core";

export type SharedVocabularyLabelStyle = "decimal" | "lower-alpha" | "upper-alpha";
export type SharedVocabularyLabelSuffix = "none" | "period" | "parenthesis";
export type OrderChoicesPosition = "top" | "bottom" | "left" | "right";
export type OrderOrientation = "horizontal" | "vertical";

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
  let choicesPosition: OrderChoicesPosition | undefined;
  for (const className of interactionClassNames(interaction)) {
    const position = orderChoicesPosition(className);
    if (position !== undefined) {
      choicesPosition = position;
      break;
    }
  }
  if (choicesPosition === undefined) return undefined;

  const layout: OrderSharedVocabularyLayout = {
    choicesPosition,
    orientation: interaction.attributes.orientation === "vertical" ? "vertical" : "horizontal",
  };
  const width = positivePixelValue(interaction.attributes["data-choices-container-width"]);
  if (width !== undefined) layout.choicesContainerWidth = width;
  return layout;
}

function numericLabels(): string[] {
  return Array.from({ length: 26 }, (_, item) => `${item + 1}`);
}

function orderChoicesPosition(className: string): OrderChoicesPosition | undefined {
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
