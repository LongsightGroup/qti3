import type { QtiChoice, QtiInteraction, QtiObjectAsset, QtiValue } from "@longsightgroup/qti3-core";
import { errorView } from "./player-validation.js";

export function responseGroup(className?: string): HTMLElement {
  const group = document.createElement("div");
  group.className = ["qti3-response-group", className].filter(Boolean).join(" ");
  return group;
}

export function interactionChoices(interaction: QtiInteraction): QtiChoice[] {
  return interaction.choices;
}

export function missingChoicesMessage(interaction: QtiInteraction): HTMLElement {
  const identifier = interaction.responseIdentifier ? ` (${interaction.responseIdentifier})` : "";
  return errorView(`No choices are defined for the ${interaction.type} interaction${identifier}.`);
}

export function applyGraphicSurfaceLayout(
  surface: HTMLElement,
  width: number,
  height: number,
  ...classNames: string[]
): void {
  surface.classList.add("qti3-graphic-surface", ...classNames);
  surface.style.inlineSize = `${width}px`;
  surface.style.aspectRatio = `${width} / ${height}`;
}

export function choiceSelector(identifier: string): string {
  return `[data-choice-identifier="${CSS.escape(identifier)}"]`;
}

export function valueToStrings(value: QtiValue): string[] {
  if (value === null) return [];
  if (Array.isArray(value)) return value.map((item) => String(item));
  return [String(value)];
}

export function orderChoicesFromValue(choices: QtiChoice[], value: QtiValue): QtiChoice[] {
  const identifiers = valueToStrings(value);
  if (identifiers.length === 0) return [...choices];
  const byIdentifier = new Map(choices.map((choice) => [choice.identifier, choice]));
  const ordered = identifiers
    .map((identifier) => byIdentifier.get(identifier))
    .filter((choice): choice is QtiChoice => Boolean(choice));
  const used = new Set(ordered.map((choice) => choice.identifier));
  ordered.push(...choices.filter((choice) => !used.has(choice.identifier)));
  return ordered;
}

export function readableType(type: string): string {
  return type
    .replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)
    .replace(/^./, (letter) => letter.toUpperCase());
}

function dimension(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function objectWidth(interaction: QtiInteraction): number {
  return dimension(interaction.object?.width, 160);
}

export function objectHeight(interaction: QtiInteraction): number {
  return dimension(interaction.object?.height, 120);
}

export function objectIsImage(object: QtiObjectAsset): boolean {
  return Boolean(
    object.type?.startsWith("image/") ||
      object.data?.startsWith("data:image/") ||
      /\.(svg|png|jpg|jpeg|gif|webp)(?:[?#].*)?$/i.test(object.data ?? ""),
  );
}

function percent(value: number, total: number): number {
  if (total <= 0) return 0;
  return (value / total) * 100;
}

export { percent };

function hotspotCoords(choice: QtiChoice): number[] {
  return (choice.attributes.coords ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));
}

export function placeHotspotButton(
  button: HTMLButtonElement,
  choice: QtiChoice,
  width: number,
  height: number,
): void {
  const coords = hotspotCoords(choice);
  const shape = choice.attributes.shape;

  if (shape === "circle" && coords.length >= 3) {
    const [x, y, radius] = coords as [number, number, number];
    button.style.insetInlineStart = `${percent(x - radius, width)}%`;
    button.style.insetBlockStart = `${percent(y - radius, height)}%`;
    button.style.inlineSize = `${percent(radius * 2, width)}%`;
    button.style.blockSize = `${percent(radius * 2, height)}%`;
    button.style.borderRadius = "50%";
    return;
  }

  if (shape === "rect" && coords.length >= 4) {
    const [left, top, right, bottom] = coords as [number, number, number, number];
    button.style.insetInlineStart = `${percent(left, width)}%`;
    button.style.insetBlockStart = `${percent(top, height)}%`;
    button.style.inlineSize = `${percent(Math.max(1, right - left), width)}%`;
    button.style.blockSize = `${percent(Math.max(1, bottom - top), height)}%`;
    return;
  }

  if (shape === "poly" && coords.length >= 6) {
    const xs = coords.filter((_, index) => index % 2 === 0);
    const ys = coords.filter((_, index) => index % 2 === 1);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    const right = Math.max(...xs);
    const bottom = Math.max(...ys);
    button.style.insetInlineStart = `${percent(left, width)}%`;
    button.style.insetBlockStart = `${percent(top, height)}%`;
    button.style.inlineSize = `${percent(Math.max(1, right - left), width)}%`;
    button.style.blockSize = `${percent(Math.max(1, bottom - top), height)}%`;
    return;
  }

  button.style.insetInlineStart = "0";
  button.style.insetBlockStart = "0";
}

export function hotspotCenter(choice: QtiChoice, width: number, height: number): { x: number; y: number } {
  const coords = hotspotCoords(choice);
  const shape = choice.attributes.shape;
  if ((shape === "circle" || shape === "ellipse") && coords.length >= 2) {
    const [x, y] = coords as [number, number];
    return { x, y };
  }
  if (shape === "rect" && coords.length >= 4) {
    const [left, top, right, bottom] = coords as [number, number, number, number];
    return { x: (left + right) / 2, y: (top + bottom) / 2 };
  }
  if (shape === "poly" && coords.length >= 6) {
    const xs = coords.filter((_, index) => index % 2 === 0);
    const ys = coords.filter((_, index) => index % 2 === 1);
    return {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
    };
  }
  return { x: width / 2, y: height / 2 };
}

export function hotspotDisplayLabel(choice: QtiChoice, choices: QtiChoice[]): string {
  return choice.attributes["hotspot-label"] || `Region ${choices.indexOf(choice) + 1}`;
}

export function hotspotAccessibleLabel(choice: QtiChoice, index: number): string {
  return (
    choice.attributes["aria-label"] || choice.attributes["hotspot-label"] || `Region ${index + 1}`
  );
}
