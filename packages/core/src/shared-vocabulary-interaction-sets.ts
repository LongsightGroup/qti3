import type { QtiInteractionType } from "./types.js";

export const SHARED_VOCABULARY_CHOICE_INTERACTIONS = [
  "choice",
] as const satisfies readonly QtiInteractionType[];

export const SHARED_VOCABULARY_CHOICE_AND_ORDER_INTERACTIONS = [
  "choice",
  "order",
] as const satisfies readonly QtiInteractionType[];

export const SHARED_VOCABULARY_CHOICES_LAYOUT_INTERACTIONS = [
  "match",
  "gapMatch",
  "graphicGapMatch",
  "order",
] as const satisfies readonly QtiInteractionType[];

export const SHARED_VOCABULARY_SELECTION_PRESENTATION_INTERACTIONS = [
  "choice",
  "hottext",
  "hotspot",
  "graphicGapMatch",
] as const satisfies readonly QtiInteractionType[];

export const SHARED_VOCABULARY_MEDIA_INTERACTIONS = [
  "media",
] as const satisfies readonly QtiInteractionType[];
