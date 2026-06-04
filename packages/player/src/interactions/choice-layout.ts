import type { QtiInteraction } from "@longsightgroup/qti3-core";
import { interactionClassNames } from "./shared-vocabulary.js";

export type ChoiceOrientation = "horizontal" | "vertical";

export interface ChoiceLayout {
  orientation: ChoiceOrientation;
  columns: number;
  rows: number;
  stacking?: number;
}

export function choiceLayout(interaction: QtiInteraction, choiceCount: number): ChoiceLayout {
  // QTI shared vocabulary orientation and stacking semantics:
  // https://www.imsglobal.org/node/218713
  const classNames = interactionClassNames(interaction);
  let hasHorizontal = false;
  let hasVertical = false;
  let stacking: number | undefined;
  for (const className of classNames) {
    if (className === "qti-orientation-horizontal") hasHorizontal = true;
    else if (className === "qti-orientation-vertical") hasVertical = true;
    else if (stacking === undefined) {
      const value = /^qti-choices-stacking-([1-5])$/.exec(className)?.[1];
      if (value !== undefined) stacking = Number(value);
    }
  }

  const orientation = hasHorizontal
    ? "horizontal"
    : hasVertical
      ? "vertical"
      : interaction.attributes.orientation === "horizontal"
        ? "horizontal"
        : "vertical";
  const columns =
    stacking !== undefined
      ? stacking
      : orientation === "horizontal"
        ? Math.min(Math.max(choiceCount, 1), 5)
        : 1;

  const layout: ChoiceLayout = {
    orientation,
    columns,
    rows: Math.max(1, Math.ceil(Math.max(choiceCount, 1) / columns)),
  };
  if (stacking !== undefined) layout.stacking = stacking;
  return layout;
}
