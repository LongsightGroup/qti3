import type { QtiInteraction } from "./types.js";

/** Normative QTI 3 shared vocabulary input-width token values (1EdTech vocab). */
export const SHARED_VOCABULARY_INPUT_WIDTHS = [
  1, 2, 3, 4, 6, 10, 15, 20, 25, 30, 35, 40, 45, 50, 72,
] as const;

export const SHARED_VOCABULARY_GAP_INPUT_WIDTHS = SHARED_VOCABULARY_INPUT_WIDTHS;

/** Normative QTI 3 shared vocabulary extended text height token values (1EdTech vocab). */
export const SHARED_VOCABULARY_EXTENDED_TEXT_HEIGHT_LINES = [3, 6, 15] as const;

export const SHARED_VOCABULARY_EXTENDED_TEXT_COUNTER_CLASSES = [
  "qti-counter-up",
  "qti-counter-down",
] as const;

export type SharedVocabularyExtendedTextCounterPosition = "up" | "down";

export const SHARED_VOCABULARY_MEDIA_PLAYER_CONTROLS = [
  "none",
  "default",
  "play",
  "rewind",
  "captions",
  "audioDescription",
] as const;

export type SharedVocabularyMediaPlayerControls =
  (typeof SHARED_VOCABULARY_MEDIA_PLAYER_CONTROLS)[number];

const inputWidthSet = new Set<number>(SHARED_VOCABULARY_INPUT_WIDTHS);
const extendedTextHeightLinesSet = new Set<number>(SHARED_VOCABULARY_EXTENDED_TEXT_HEIGHT_LINES);
const extendedTextCounterClassSet = new Set<string>(
  SHARED_VOCABULARY_EXTENDED_TEXT_COUNTER_CLASSES,
);
const mediaPlayerControlsSet = new Set<string>(SHARED_VOCABULARY_MEDIA_PLAYER_CONTROLS);

const inputWidthClassPattern = /^qti-input-width-(\d+)$/;
const extendedTextHeightLinesClassPattern = /^qti-height-lines-(\d+)$/;

const extendedTextCounterPositionByClass: Record<
  (typeof SHARED_VOCABULARY_EXTENDED_TEXT_COUNTER_CLASSES)[number],
  SharedVocabularyExtendedTextCounterPosition
> = {
  "qti-counter-up": "up",
  "qti-counter-down": "down",
};

export function sharedVocabularyClassNames(attributes: Record<string, string>): string[] {
  return (attributes.class ?? "").split(/\s+/).filter(Boolean);
}

export function firstMatchingSharedVocabularyClass<T extends string>(
  classNames: string[],
  tokens: readonly T[],
): T | undefined {
  const tokenSet = new Set<string>(tokens);
  for (const className of classNames) {
    if (tokenSet.has(className)) return className as T;
  }
  return undefined;
}

export function inputWidthFromAttributes(attributes: Record<string, string>): number | undefined {
  for (const className of sharedVocabularyClassNames(attributes)) {
    const value = inputWidthClassPattern.exec(className)?.[1];
    if (value === undefined) continue;
    const width = Number(value);
    if (inputWidthSet.has(width)) return width;
  }
  return undefined;
}

export const gapInputWidthFromAttributes = inputWidthFromAttributes;

export function extendedTextHeightLinesFromAttributes(
  attributes: Record<string, string>,
): number | undefined {
  for (const className of sharedVocabularyClassNames(attributes)) {
    const value = extendedTextHeightLinesClassPattern.exec(className)?.[1];
    if (value === undefined) continue;
    const lines = Number(value);
    if (extendedTextHeightLinesSet.has(lines)) return lines;
  }
  return undefined;
}

export function extendedTextHeightLines(interaction: QtiInteraction): number | undefined {
  return extendedTextHeightLinesFromAttributes(interaction.attributes);
}

export function extendedTextCounterPositionFromAttributes(
  attributes: Record<string, string>,
): SharedVocabularyExtendedTextCounterPosition | undefined {
  const matched = firstMatchingSharedVocabularyClass(
    sharedVocabularyClassNames(attributes),
    SHARED_VOCABULARY_EXTENDED_TEXT_COUNTER_CLASSES,
  );
  return matched === undefined ? undefined : extendedTextCounterPositionByClass[matched];
}

export function extendedTextCounterPosition(
  interaction: QtiInteraction,
): SharedVocabularyExtendedTextCounterPosition | undefined {
  return extendedTextCounterPositionFromAttributes(interaction.attributes);
}

export function supportedInputWidthClassNames(classNames: string[]): string[] {
  return classNames.filter((className) => {
    const value = inputWidthClassPattern.exec(className)?.[1];
    return value !== undefined && inputWidthSet.has(Number(value));
  });
}

export const supportedGapInputWidthClassNames = supportedInputWidthClassNames;

export function supportedExtendedTextHeightLinesClassNames(classNames: string[]): string[] {
  return classNames.filter((className) => {
    const value = extendedTextHeightLinesClassPattern.exec(className)?.[1];
    return value !== undefined && extendedTextHeightLinesSet.has(Number(value));
  });
}

export function supportedExtendedTextCounterClassNames(classNames: string[]): string[] {
  return classNames.filter((className) => extendedTextCounterClassSet.has(className));
}

export function mediaPlayerControlsTokens(value: string | undefined): string[] {
  return (value ?? "").split(/\s+/).filter(Boolean);
}

export function unsupportedMediaPlayerControlsTokens(value: string | undefined): string[] {
  return mediaPlayerControlsTokens(value).filter((token) => !mediaPlayerControlsSet.has(token));
}

export function isSupportedMediaPlayerControlsToken(token: string): boolean {
  return mediaPlayerControlsSet.has(token);
}

export function formatSupportedMediaPlayerControlsTokens(): string {
  return SHARED_VOCABULARY_MEDIA_PLAYER_CONTROLS.join(", ");
}

export function isSupportedInputWidthClassName(className: string): boolean {
  if (!className.startsWith("qti-input-width-")) return false;
  const value = inputWidthClassPattern.exec(className)?.[1];
  return value !== undefined && inputWidthSet.has(Number(value));
}

export const isSupportedGapInputWidthClassName = isSupportedInputWidthClassName;

export function isSupportedExtendedTextHeightLinesClassName(className: string): boolean {
  if (!className.startsWith("qti-height-lines-")) return false;
  const value = extendedTextHeightLinesClassPattern.exec(className)?.[1];
  return value !== undefined && extendedTextHeightLinesSet.has(Number(value));
}

export function isSupportedExtendedTextCounterClassName(className: string): boolean {
  return extendedTextCounterClassSet.has(className);
}

export function formatSupportedInputWidthClasses(): string {
  return SHARED_VOCABULARY_INPUT_WIDTHS.map((width) => `qti-input-width-${width}`).join(", ");
}

export const formatSupportedGapInputWidthClasses = formatSupportedInputWidthClasses;

export function formatSupportedExtendedTextHeightLinesClasses(): string {
  return SHARED_VOCABULARY_EXTENDED_TEXT_HEIGHT_LINES.map(
    (lines) => `qti-height-lines-${lines}`,
  ).join(", ");
}

export function formatSupportedExtendedTextCounterClasses(): string {
  return SHARED_VOCABULARY_EXTENDED_TEXT_COUNTER_CLASSES.join(", ");
}
