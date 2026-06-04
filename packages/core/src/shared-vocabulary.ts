/** Normative QTI 3 shared vocabulary input-width token values (1EdTech vocab). */
export const SHARED_VOCABULARY_GAP_INPUT_WIDTHS = [
  1, 2, 3, 4, 6, 10, 15, 20, 25, 30, 35, 40, 45, 50, 72,
] as const;

const gapInputWidthSet = new Set<number>(SHARED_VOCABULARY_GAP_INPUT_WIDTHS);

const gapInputWidthClassPattern = /^qti-input-width-(\d+)$/;

export function sharedVocabularyClassNames(attributes: Record<string, string>): string[] {
  return (attributes.class ?? "").split(/\s+/).filter(Boolean);
}

export function gapInputWidthFromAttributes(
  attributes: Record<string, string>,
): number | undefined {
  for (const className of sharedVocabularyClassNames(attributes)) {
    const value = gapInputWidthClassPattern.exec(className)?.[1];
    if (value === undefined) continue;
    const width = Number(value);
    if (gapInputWidthSet.has(width)) return width;
  }
  return undefined;
}

export function supportedGapInputWidthClassNames(classNames: string[]): string[] {
  return classNames.filter((className) => {
    const value = gapInputWidthClassPattern.exec(className)?.[1];
    return value !== undefined && gapInputWidthSet.has(Number(value));
  });
}

export function isSupportedGapInputWidthClassName(className: string): boolean {
  if (!className.startsWith("qti-input-width-")) return false;
  const value = gapInputWidthClassPattern.exec(className)?.[1];
  return value !== undefined && gapInputWidthSet.has(Number(value));
}

export function formatSupportedGapInputWidthClasses(): string {
  return SHARED_VOCABULARY_GAP_INPUT_WIDTHS.map((width) => `qti-input-width-${width}`).join(", ");
}
