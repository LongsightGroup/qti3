import { expect, type Locator } from "@playwright/test";

export const CHOICE_LAYOUT_TOLERANCE_PX = 2;

export interface ChoiceOptionRect {
  identifier: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function choiceOptionRects(interaction: Locator): Promise<ChoiceOptionRect[]> {
  return interaction.locator(".qti3-choice-option").evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        identifier: (element as HTMLElement).dataset.choiceIdentifier ?? "",
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    }),
  );
}

export function choiceRectsByIdentifier(
  rects: ChoiceOptionRect[],
  expectedOrder: readonly string[],
): Record<string, ChoiceOptionRect> {
  expect(rects.map((rect) => rect.identifier)).toEqual([...expectedOrder]);
  const byId = Object.fromEntries(rects.map((rect) => [rect.identifier, rect])) as Record<
    string,
    ChoiceOptionRect | undefined
  >;
  for (const identifier of expectedOrder) {
    expect(byId[identifier], `missing choice option ${identifier}`).toBeDefined();
  }
  return byId as Record<string, ChoiceOptionRect>;
}

export function expectChoiceGridLayout(
  byId: Record<string, ChoiceOptionRect>,
  rows: readonly (readonly string[])[],
  tolerance = CHOICE_LAYOUT_TOLERANCE_PX,
): void {
  for (const row of rows) {
    const anchor = byId[row[0]!]!;
    for (let index = 1; index < row.length; index++) {
      const previous = byId[row[index - 1]!]!;
      const current = byId[row[index]!]!;
      expect(Math.abs(current.y - anchor.y), row[index]).toBeLessThanOrEqual(tolerance);
      expect(current.x, row[index]).toBeGreaterThan(previous.x);
    }
  }

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const previousAnchor = byId[rows[rowIndex - 1]![0]!]!;
    const currentAnchor = byId[rows[rowIndex]![0]!]!;
    expect(currentAnchor.y).toBeGreaterThan(previousAnchor.y + previousAnchor.height - 1);
    expect(Math.abs(currentAnchor.x - previousAnchor.x)).toBeLessThanOrEqual(tolerance);
  }
}
