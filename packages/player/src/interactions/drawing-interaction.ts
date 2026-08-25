import type { QtiInteraction, QtiObjectAsset, QtiValue } from "@longsightgroup/qti3-core";
import { bindActivateOnEnterOrSpace } from "../dom/keyboard-activation.js";
import { applyResponsiveGraphicSize, objectIsImage } from "../interaction-support.js";
import { createQtiInteractionRegionMarkers } from "../player/interaction-regions.js";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import { parseAuthoredAssetUrl } from "../asset-url-policy.js";
import {
  announceDrawingPenColor,
  announceDrawingStrokeStatus,
  createDrawingPenColorAnnouncement,
  createDrawingStatusOutput,
} from "./drawing-a11y.js";

export const DRAWING_STROKE_COLOR = "#000000";
export const DRAWING_STROKE_WIDTH = 3;

export type DrawingPoint = { x: number; y: number };
export type ParsedDrawingStroke = { points: DrawingPoint[]; color: string };

type DrawingStroke = ParsedDrawingStroke & { element: SVGPolylineElement };

export function renderDrawingResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  currentValue: QtiValue,
  messages: PlayerMessageResolver,
): HTMLElement {
  const regions = createQtiInteractionRegionMarkers(interaction);
  const group = document.createElement("div");
  group.role = "group";
  group.setAttribute(
    "aria-label",
    messages.message("interactionDrawingResponse", { type: interaction.type }),
  );

  const surface = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  surface.classList.add("qti3-drawing-surface");
  surface.setAttribute("role", "img");
  surface.setAttribute("aria-label", messages.message("drawingSurface"));
  surface.setAttribute("tabindex", "0");
  regions.surface(surface);
  const width = drawingWidth(interaction);
  const height = drawingHeight(interaction);
  surface.setAttribute("viewBox", `0 0 ${width} ${height}`);
  applyResponsiveGraphicSize(surface, width, height);
  surface.style.touchAction = "none";
  const paletteDisabled = drawingPaletteDisabled(interaction);
  const restoredStrokes = normalizeRestoredDrawingStrokes(
    parseDrawingValue(currentValue),
    paletteDisabled,
  );
  const authoredBackgroundHref = drawingBackgroundHref(interaction);
  let resolvedAuthoredBackgroundHref = authoredBackgroundHref;
  let activeBackgroundIsAuthored =
    restoredStrokes.length > 0 || !drawingResponseImage(currentValue);
  let activeBackgroundHref =
    restoredStrokes.length === 0
      ? (drawingResponseImage(currentValue) ?? authoredBackgroundHref)
      : authoredBackgroundHref;
  const resetSurface = () => {
    const background = activeBackgroundHref
      ? drawingImageElement(activeBackgroundHref, width, height)
      : undefined;
    surface.replaceChildren(...(background ? [background] : []));
  };
  resetSurface();

  const summary = createDrawingStatusOutput();
  const penColorAnnouncement = createDrawingPenColorAnnouncement();
  const strokes: DrawingStroke[] = [];
  let activeStroke: DrawingStroke | undefined;
  let activeColor = DRAWING_STROKE_COLOR;
  let colorInput: HTMLInputElement | undefined;
  let commitVersion = 0;
  const commit = (emitResponse = true) => {
    const version = ++commitVersion;
    if (emitResponse) {
      if (strokes.length === 0) {
        update(null);
      } else {
        void exportDrawingResponse(interaction, width, height, strokes, () => {
          const currentHref = currentDrawingBackgroundHref(surface);
          if (activeBackgroundIsAuthored && currentHref) {
            resolvedAuthoredBackgroundHref = currentHref;
          }
          return currentHref ?? activeBackgroundHref;
        }).then((value) => {
          if (version === commitVersion) update(value);
        });
      }
    }
    announceDrawingStrokeStatus(
      summary,
      surface,
      messages,
      strokes.length,
      serializeDrawingStrokes(strokes),
    );
  };

  const tools = document.createElement("div");
  tools.className = "qti3-drawing-tools";
  if (!paletteDisabled) {
    const colorLabel = document.createElement("label");
    colorLabel.className = "qti3-drawing-color";
    const colorLabelText = document.createElement("span");
    colorLabelText.className = "qti3-drawing-color-label";
    colorLabelText.textContent = messages.message("drawingPenColor");
    colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.className = "qti3-drawing-color-input";
    colorInput.value = DRAWING_STROKE_COLOR;
    colorInput.addEventListener("input", () => {
      activeColor = penColorForInteraction(false, colorInput!.value);
      announceDrawingPenColor(penColorAnnouncement, messages, activeColor);
    });
    colorLabel.append(colorLabelText, colorInput);
    tools.append(colorLabel);
  }

  for (const { points, color } of restoredStrokes) {
    const element = polylineElement(points, color);
    strokes.push({ points, color, element });
    surface.append(element);
  }
  const lastRestoredStroke = strokes.at(-1);
  if (lastRestoredStroke && !paletteDisabled) {
    activeColor = lastRestoredStroke.color;
    if (colorInput) colorInput.value = activeColor;
  }
  const addPoint = (event: PointerEvent) => {
    if (!activeStroke) return;
    const point = svgPoint(surface, event);
    const previous = activeStroke.points.at(-1);
    if (previous && previous.x === point.x && previous.y === point.y) return;
    activeStroke.points.push(point);
    activeStroke.element.setAttribute("points", serializeSvgPoints(activeStroke.points));
  };
  const finishStroke = (event: PointerEvent) => {
    if (!activeStroke) return;
    addPoint(event);
    const firstPoint = activeStroke.points[0];
    if (activeStroke.points.length === 1 && firstPoint) activeStroke.points.push(firstPoint);
    activeStroke.element.setAttribute("points", serializeSvgPoints(activeStroke.points));
    activeStroke = undefined;
    commit();
  };

  surface.addEventListener("pointerdown", (event) => {
    const point = svgPoint(surface, event);
    const strokeColor = penColorForInteraction(paletteDisabled, activeColor);
    const element = polylineElement([point], strokeColor);
    activeStroke = { points: [point], color: strokeColor, element };
    strokes.push(activeStroke);
    surface.append(element);
    surface.setPointerCapture(event.pointerId);
  });
  surface.addEventListener("pointermove", addPoint);
  surface.addEventListener("pointerup", finishStroke);
  surface.addEventListener("pointercancel", () => {
    activeStroke = undefined;
  });
  bindActivateOnEnterOrSpace(surface, () => {
    const points = [
      { x: 10, y: 10 },
      { x: 90, y: 90 },
    ];
    const strokeColor = penColorForInteraction(paletteDisabled, activeColor);
    const element = polylineElement(points, strokeColor);
    strokes.push({ points, color: strokeColor, element });
    surface.append(element);
    commit();
  });

  const clear = document.createElement("button");
  clear.type = "button";
  clear.textContent = messages.message("clearDrawing");
  clear.addEventListener("click", () => {
    strokes.splice(0, strokes.length);
    activeStroke = undefined;
    if (activeBackgroundIsAuthored) {
      resolvedAuthoredBackgroundHref =
        currentDrawingBackgroundHref(surface) ?? resolvedAuthoredBackgroundHref;
    }
    activeBackgroundHref = resolvedAuthoredBackgroundHref;
    activeBackgroundIsAuthored = true;
    resetSurface();
    commit();
  });

  tools.append(clear);
  commit(false);
  group.append(tools, surface, summary, penColorAnnouncement);
  return group;
}

function dimension(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function scalarString(value: QtiValue): string {
  if (value === null || Array.isArray(value) || typeof value === "object") return "";
  return String(value);
}

export function parseDrawingValue(value: QtiValue): ParsedDrawingStroke[] {
  const raw = scalarString(value);
  if (!raw) return [];

  const metadata = drawingMetadataFromSvgDataUrl(raw);
  if (metadata) return parseDrawingStrokePayload(metadata);

  return parseDrawingStrokePayload(raw);
}

function drawingMetadataFromSvgDataUrl(raw: string): string | undefined {
  if (!raw.startsWith("data:image/svg+xml")) return undefined;
  const commaIndex = raw.indexOf(",");
  if (commaIndex === -1) return undefined;
  const encoded = raw.slice(commaIndex + 1);
  let svg = "";
  try {
    svg = raw.slice(0, commaIndex).includes(";base64")
      ? atob(encoded)
      : decodeURIComponent(encoded);
  } catch {
    return undefined;
  }
  const match = svg.match(/\sdata-qti3-strokes="([^"]*)"/);
  if (!match?.[1]) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return undefined;
  }
}

function drawingResponseImage(value: QtiValue): string | undefined {
  const raw = scalarString(value);
  return raw.startsWith("data:image/") ? raw : undefined;
}

export function parseDrawingStrokePayload(raw: string): ParsedDrawingStroke[] {
  return raw
    .split("|")
    .map((stroke) => parseDrawingStrokeSegment(stroke))
    .filter((stroke): stroke is ParsedDrawingStroke => stroke !== undefined);
}

function parseDrawingStrokeSegment(segment: string): ParsedDrawingStroke | undefined {
  const trimmed = segment.trim();
  if (!trimmed) return undefined;

  const { color, coordinateText } = splitStrokeColorPrefix(trimmed);

  const numbers = coordinateText
    .trim()
    .split(/\s+/)
    .map(Number)
    .filter((item) => Number.isFinite(item));
  const points: DrawingPoint[] = [];
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    points.push({ x: numbers[index]!, y: numbers[index + 1]! });
  }
  if (points.length === 0) return undefined;
  return { points, color };
}

export function drawingPaletteDisabled(interaction: QtiInteraction): boolean {
  const className = interaction.attributes.class ?? "";
  return className.split(/\s+/).includes("toolbar-palette-none");
}

export function penColorForInteraction(paletteDisabled: boolean, color: string): string {
  return paletteDisabled ? DRAWING_STROKE_COLOR : normalizeDrawingColor(color);
}

export function normalizeRestoredDrawingStrokes(
  strokes: ParsedDrawingStroke[],
  paletteDisabled: boolean,
): ParsedDrawingStroke[] {
  return strokes.map((stroke) => ({
    ...stroke,
    color: penColorForInteraction(paletteDisabled, stroke.color),
  }));
}

export function isDrawingColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/.test(value.trim().toLowerCase());
}

export function normalizeDrawingColor(value: string): string {
  const normalized = value.trim().toLowerCase();
  return isDrawingColor(normalized) ? normalized : DRAWING_STROKE_COLOR;
}

function splitStrokeColorPrefix(segment: string): { color: string; coordinateText: string } {
  const colonIndex = segment.indexOf(":");
  if (colonIndex > 0 && segment.startsWith("#")) {
    const colorCandidate = segment.slice(0, colonIndex);
    const coordinateText = segment.slice(colonIndex + 1);
    if (isDrawingColor(colorCandidate)) {
      return {
        color: normalizeDrawingColor(colorCandidate),
        coordinateText,
      };
    }
    return { color: DRAWING_STROKE_COLOR, coordinateText };
  }
  return { color: DRAWING_STROKE_COLOR, coordinateText: segment };
}

function drawingWidth(interaction: QtiInteraction): number {
  return dimension(interaction.object?.width, 640);
}

function drawingHeight(interaction: QtiInteraction): number {
  return dimension(interaction.object?.height, 360);
}

function svgPoint(surface: SVGSVGElement, event: PointerEvent): { x: number; y: number } {
  const rect = surface.getBoundingClientRect();
  const viewBox = surface.viewBox.baseVal;
  const width = viewBox.width || 160;
  const height = viewBox.height || 120;
  const x = Math.round(((event.clientX - rect.left) / rect.width) * width);
  const y = Math.round(((event.clientY - rect.top) / rect.height) * height);
  return {
    x: Math.max(0, Math.min(width, x)),
    y: Math.max(0, Math.min(height, y)),
  };
}

async function exportDrawingResponse(
  interaction: QtiInteraction,
  width: number,
  height: number,
  strokes: DrawingStroke[],
  backgroundHref: () => string | undefined,
): Promise<string> {
  const href = backgroundHref();
  const mime = drawingResponseMime(interaction.object);
  if (mime === "image/svg+xml") {
    return svgDrawingDataUrl(interaction, width, height, strokes, await portableImageHref(href));
  }
  return rasterDrawingDataUrl(interaction, width, height, strokes, href, mime);
}

function drawingResponseMime(
  object: QtiObjectAsset | undefined,
): "image/svg+xml" | "image/png" | "image/jpeg" | "image/webp" {
  const candidates = [
    object?.type,
    object?.data,
    ...(object?.sources.map((source) => source.type ?? source.src) ?? []),
  ];
  for (const candidate of candidates) {
    const mime = imageMime(candidate);
    if (mime) return mime;
  }
  return "image/svg+xml";
}

function imageMime(
  value: string | undefined,
): "image/svg+xml" | "image/png" | "image/jpeg" | "image/webp" | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase().split(";")[0] ?? "";
  if (normalized === "image/svg+xml") return "image/svg+xml";
  if (normalized === "image/png") return "image/png";
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "image/jpeg";
  if (normalized === "image/webp") return "image/webp";
  const dataMime = value.match(/^data:([^;,]+)/i)?.[1]?.toLowerCase();
  if (dataMime) return imageMime(dataMime);
  if (/\.svg(?:[?#].*)?$/i.test(value)) return "image/svg+xml";
  if (/\.png(?:[?#].*)?$/i.test(value)) return "image/png";
  if (/\.jpe?g(?:[?#].*)?$/i.test(value)) return "image/jpeg";
  if (/\.webp(?:[?#].*)?$/i.test(value)) return "image/webp";
  return undefined;
}

function svgDrawingDataUrl(
  interaction: QtiInteraction,
  width: number,
  height: number,
  strokes: DrawingStroke[],
  backgroundHref: string | undefined,
): string {
  const markup = svgDrawingMarkup(interaction, width, height, strokes, backgroundHref);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

function svgDrawingMarkup(
  interaction: QtiInteraction,
  width: number,
  height: number,
  strokes: DrawingStroke[],
  backgroundHref: string | undefined,
): string {
  const strokePayload = serializeDrawingStrokes(strokes);
  const background =
    backgroundHref && interaction.object && objectIsImage(interaction.object)
      ? `<image href="${xmlAttribute(backgroundHref)}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>`
      : "";
  const lines = strokes
    .map((stroke) => {
      return `<polyline points="${xmlAttribute(serializeSvgPoints(stroke.points))}" fill="none" stroke="${xmlAttribute(stroke.color)}" stroke-width="${DRAWING_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><metadata id="qti3-drawing-response" data-qti3-strokes="${xmlAttribute(encodeURIComponent(strokePayload))}"></metadata>${background}${lines}</svg>`;
}

async function rasterDrawingDataUrl(
  interaction: QtiInteraction,
  width: number,
  height: number,
  strokes: DrawingStroke[],
  backgroundHref: string | undefined,
  mime: "image/png" | "image/jpeg" | "image/webp",
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return svgDrawingDataUrl(interaction, width, height, strokes, backgroundHref);

  if (mime === "image/jpeg") {
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
  }

  if (backgroundHref && interaction.object && objectIsImage(interaction.object)) {
    try {
      const image = await loadCanvasImage(backgroundHref);
      context.drawImage(image, 0, 0, width, height);
    } catch {
      // Export the candidate marks even when the authored background cannot be rasterized.
    }
  }

  context.lineWidth = DRAWING_STROKE_WIDTH;
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const stroke of strokes) {
    const [first, ...rest] = stroke.points;
    if (!first) continue;
    context.strokeStyle = stroke.color;
    context.beginPath();
    context.moveTo(first.x, first.y);
    for (const point of rest) context.lineTo(point.x, point.y);
    context.stroke();
  }

  try {
    return canvas.toDataURL(mime);
  } catch {
    return svgDrawingDataUrl(interaction, width, height, strokes, backgroundHref);
  }
}

function loadCanvasImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error(`Unable to load ${src}`)), {
      once: true,
    });
    image.src = src;
  });
}

async function portableImageHref(href: string | undefined): Promise<string | undefined> {
  if (!href || href.startsWith("data:")) return href;
  try {
    const response = await fetch(href);
    if (!response.ok) return href;
    return await blobToDataUrl(await response.blob());
  } catch {
    return href;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("Unable to read drawing background."));
    });
    reader.readAsDataURL(blob);
  });
}

function drawingBackgroundHref(interaction: QtiInteraction): string | undefined {
  if (!interaction.object?.data || !objectIsImage(interaction.object)) return undefined;
  return parseAuthoredAssetUrl(interaction.object.data, "image");
}

function drawingImageElement(href: string, width: number, height: number): SVGImageElement {
  const image = document.createElementNS("http://www.w3.org/2000/svg", "image");
  image.setAttribute("href", href);
  image.setAttribute("width", String(width));
  image.setAttribute("height", String(height));
  image.setAttribute("preserveAspectRatio", "xMidYMid meet");
  image.setAttribute("aria-hidden", "true");
  return image;
}

function currentDrawingBackgroundHref(surface: SVGSVGElement): string | undefined {
  return surface.querySelector("image")?.getAttribute("href") ?? undefined;
}

function serializeSvgPoints(points: Array<{ x: number; y: number }>): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

export function serializeDrawingStrokes(
  strokes: Pick<ParsedDrawingStroke, "points" | "color">[],
): string {
  return strokes.map((stroke) => serializeDrawingStroke(stroke)).join(" | ");
}

function serializeDrawingStroke(stroke: Pick<ParsedDrawingStroke, "points" | "color">): string {
  const coordinates = stroke.points.map((point) => `${point.x} ${point.y}`).join(" ");
  return `${normalizeDrawingColor(stroke.color)}:${coordinates}`;
}

function xmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function polylineElement(points: DrawingPoint[], color: string): SVGPolylineElement {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  line.classList.add("qti3-drawing-stroke");
  line.setAttribute("points", serializeSvgPoints(points));
  line.setAttribute("stroke", normalizeDrawingColor(color));
  return line;
}
