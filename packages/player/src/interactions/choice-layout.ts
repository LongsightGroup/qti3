import { parseSharedVocabularyClasses, type QtiInteraction } from "@longsightgroup/qti3-core";
import { sharedVocabularyChoiceOrientation } from "./shared-vocabulary.js";

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
  const state = parseSharedVocabularyClasses(interaction.attributes.class ?? "", "choice");
  const stackingValue = state["choices-stacking"];
  const stacking = typeof stackingValue === "number" ? stackingValue : undefined;

  const orientation = sharedVocabularyChoiceOrientation(interaction, stacking);
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
