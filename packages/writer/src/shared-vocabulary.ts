import {
  serializeSharedVocabularyAttributes,
  serializeSharedVocabularyClassNames,
  type QtiInteractionType,
  type QtiSharedVocabularyState,
} from "@longsightgroup/qti3-core";

import { classAttribute, xmlAttributes } from "./xml.js";

export function sharedVocabularyXmlAttributes(
  state: QtiSharedVocabularyState | undefined,
  interaction: QtiInteractionType,
  classNames: readonly string[] = [],
): string {
  const sharedClasses = state ? serializeSharedVocabularyClassNames(state, interaction) : [];
  const sharedAttributes = state ? serializeSharedVocabularyAttributes(state, interaction) : {};
  return `${classAttribute([...classNames, ...sharedClasses])}${xmlAttributes(sharedAttributes)}`;
}
