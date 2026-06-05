import type { SharedVocabularyClassSupport } from "./types.js";

export type SharedVocabularySupportLevel = SharedVocabularyClassSupport["level"];

export function isEnforcedSharedVocabularyLevel(level: SharedVocabularySupportLevel): boolean {
  return level !== "pass-through";
}
