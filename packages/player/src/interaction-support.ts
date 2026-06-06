import { qtiValueToIdentifierList } from "@longsightgroup/qti3-core";
import type {
  QtiChoice,
  QtiInteraction,
  QtiObjectAsset,
  QtiValue,
} from "@longsightgroup/qti3-core";
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
  applyResponsiveGraphicSize(surface, width, height);
}

export function applyResponsiveGraphicSize(
  element: HTMLElement | SVGSVGElement,
  width: number,
  height: number,
): void {
  element.style.display = "block";
  element.style.inlineSize = "100%";
  element.style.maxInlineSize = `${width}px`;
  element.style.aspectRatio = `${width} / ${height}`;
}

export function choiceSelector(identifier: string): string {
  return `[data-choice-identifier="${CSS.escape(identifier)}"]`;
}

export function valueToStrings(value: QtiValue): string[] {
  return qtiValueToIdentifierList(value);
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

export function appendGraphicObjectImage(
  surface: HTMLElement,
  object: QtiObjectAsset,
  alt: string,
): void {
  if (!object.data || !objectIsImage(object)) return;
  const image = document.createElement("img");
  image.className = "qti3-graphic-object-image";
  image.src = object.data;
  image.alt = alt;
  surface.append(image);
}

function percent(value: number, total: number): number {
  if (total <= 0) return 0;
  return (value / total) * 100;
}

export { percent };

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export type HotspotSvgShapeElement = SVGCircleElement | SVGRectElement | SVGPathElement;

export function parseHotspotCoords(choice: QtiChoice): number[] {
  return (choice.attributes.coords ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));
}

export function invalidHotspotGeometryMessage(choice: QtiChoice): HTMLElement {
  const shape = choice.attributes.shape ?? "unknown";
  return errorView(
    `Hotspot choice "${choice.identifier}" has invalid or unsupported geometry (shape="${shape}").`,
  );
}

export function createHotspotSvgElement(choice: QtiChoice): HotspotSvgShapeElement | undefined {
  const coords = parseHotspotCoords(choice);
  const shape = choice.attributes.shape;

  if (shape === "circle" && coords.length >= 3) {
    const [cx, cy, radius] = coords as [number, number, number];
    const circle = document.createElementNS(SVG_NAMESPACE, "circle");
    circle.setAttribute("cx", String(cx));
    circle.setAttribute("cy", String(cy));
    circle.setAttribute("r", String(radius));
    return circle;
  }

  if (shape === "rect" && coords.length >= 4) {
    const [left, top, right, bottom] = coords as [number, number, number, number];
    const rect = document.createElementNS(SVG_NAMESPACE, "rect");
    rect.setAttribute("x", String(left));
    rect.setAttribute("y", String(top));
    rect.setAttribute("width", String(Math.max(1, right - left)));
    rect.setAttribute("height", String(Math.max(1, bottom - top)));
    return rect;
  }

  if (shape === "poly" && coords.length >= 6) {
    const path = document.createElementNS(SVG_NAMESPACE, "path");
    path.setAttribute("d", hotspotPolygonPathData(coords));
    return path;
  }

  return undefined;
}

function hotspotPolygonPathData(coords: number[]): string {
  const [startX, startY] = coords as [number, number, ...number[]];
  const commands = [`M ${startX} ${startY}`];
  for (let index = 2; index < coords.length; index += 2) {
    commands.push(`L ${coords[index]} ${coords[index + 1]}`);
  }
  commands.push("Z");
  return commands.join(" ");
}

export function applyGraphicRegionPlacement(
  element: HTMLElement,
  placement: {
    insetInlineStart: string;
    insetBlockStart: string;
    inlineSize?: string;
    blockSize?: string;
    shape?: string;
  },
): void {
  element.style.setProperty("--qti3-graphic-region-inline-start", placement.insetInlineStart);
  element.style.setProperty("--qti3-graphic-region-block-start", placement.insetBlockStart);
  if (placement.inlineSize !== undefined) {
    element.style.setProperty("--qti3-graphic-region-inline-size", placement.inlineSize);
  } else {
    element.style.removeProperty("--qti3-graphic-region-inline-size");
  }
  if (placement.blockSize !== undefined) {
    element.style.setProperty("--qti3-graphic-region-block-size", placement.blockSize);
  } else {
    element.style.removeProperty("--qti3-graphic-region-block-size");
  }
  if (placement.shape) element.dataset.shape = placement.shape;
  else delete element.dataset.shape;
}

export function applyPointMarkerPlacement(
  marker: HTMLElement,
  insetInlineStart: string,
  insetBlockStart: string,
): void {
  marker.style.setProperty("--qti3-point-marker-inline-start", insetInlineStart);
  marker.style.setProperty("--qti3-point-marker-block-start", insetBlockStart);
}

export function applyPositionObjectMarkerSize(
  marker: HTMLElement,
  inlineSize: number,
  blockSize: number,
): void {
  marker.style.setProperty("--qti3-position-object-marker-inline-size", `${inlineSize}px`);
  marker.style.setProperty("--qti3-position-object-marker-block-size", `${blockSize}px`);
}

export function applyPositionObjectMarkerPlacement(
  marker: HTMLElement,
  insetInlineStart: string,
  insetBlockStart: string,
): void {
  marker.style.setProperty("--qti3-position-object-marker-inline-start", insetInlineStart);
  marker.style.setProperty("--qti3-position-object-marker-block-start", insetBlockStart);
}

export function placeHotspotButton(
  button: HTMLButtonElement,
  choice: QtiChoice,
  width: number,
  height: number,
): void {
  const coords = parseHotspotCoords(choice);
  const shape = choice.attributes.shape;

  if (shape === "circle" && coords.length >= 3) {
    const [x, y, radius] = coords as [number, number, number];
    applyGraphicRegionPlacement(button, {
      insetInlineStart: `${percent(x - radius, width)}%`,
      insetBlockStart: `${percent(y - radius, height)}%`,
      inlineSize: `${percent(radius * 2, width)}%`,
      blockSize: `${percent(radius * 2, height)}%`,
      shape: "circle",
    });
    return;
  }

  if (shape === "rect" && coords.length >= 4) {
    const [left, top, right, bottom] = coords as [number, number, number, number];
    applyGraphicRegionPlacement(button, {
      insetInlineStart: `${percent(left, width)}%`,
      insetBlockStart: `${percent(top, height)}%`,
      inlineSize: `${percent(Math.max(1, right - left), width)}%`,
      blockSize: `${percent(Math.max(1, bottom - top), height)}%`,
      shape: "rect",
    });
    return;
  }

  if (shape === "poly" && coords.length >= 6) {
    const xs = coords.filter((_, index) => index % 2 === 0);
    const ys = coords.filter((_, index) => index % 2 === 1);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    const right = Math.max(...xs);
    const bottom = Math.max(...ys);
    applyGraphicRegionPlacement(button, {
      insetInlineStart: `${percent(left, width)}%`,
      insetBlockStart: `${percent(top, height)}%`,
      inlineSize: `${percent(Math.max(1, right - left), width)}%`,
      blockSize: `${percent(Math.max(1, bottom - top), height)}%`,
      shape: "poly",
    });
    return;
  }

  applyGraphicRegionPlacement(button, {
    insetInlineStart: "0",
    insetBlockStart: "0",
  });
}

export function hotspotCenter(
  choice: QtiChoice,
  width: number,
  height: number,
): { x: number; y: number } {
  const coords = parseHotspotCoords(choice);
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

export function hotspotSelectionAccessibleLabel(choice: QtiChoice, index: number): string {
  return (
    choice.attributes["aria-label"] ||
    choice.attributes["hotspot-label"] ||
    choice.text ||
    `Region ${index + 1}`
  );
}
