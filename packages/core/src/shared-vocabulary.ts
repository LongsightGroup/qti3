/** Normative QTI 3 shared vocabulary input-width token values (1EdTech vocab). */
export const SHARED_VOCABULARY_INPUT_WIDTHS = [
  1, 2, 3, 4, 6, 10, 15, 20, 25, 30, 35, 40, 45, 50, 72,
] as const;

export const SHARED_VOCABULARY_GAP_INPUT_WIDTHS = SHARED_VOCABULARY_INPUT_WIDTHS;

const inputWidthSet = new Set<number>(SHARED_VOCABULARY_INPUT_WIDTHS);

const inputWidthClassPattern = /^qti-input-width-(\d+)$/;

export function sharedVocabularyClassNames(attributes: Record<string, string>): string[] {
  return (attributes.class ?? "").split(/\s+/).filter(Boolean);
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

export function supportedInputWidthClassNames(classNames: string[]): string[] {
  return classNames.filter((className) => {
    const value = inputWidthClassPattern.exec(className)?.[1];
    return value !== undefined && inputWidthSet.has(Number(value));
  });
}

export const supportedGapInputWidthClassNames = supportedInputWidthClassNames;

export function isSupportedInputWidthClassName(className: string): boolean {
  if (!className.startsWith("qti-input-width-")) return false;
  const value = inputWidthClassPattern.exec(className)?.[1];
  return value !== undefined && inputWidthSet.has(Number(value));
}

export const isSupportedGapInputWidthClassName = isSupportedInputWidthClassName;

export function formatSupportedInputWidthClasses(): string {
  return SHARED_VOCABULARY_INPUT_WIDTHS.map((width) => `qti-input-width-${width}`).join(", ");
}

export const formatSupportedGapInputWidthClasses = formatSupportedInputWidthClasses;
