import type { QtiInteraction, QtiObjectAsset, QtiValue } from "@longsightgroup/qti3-core";
import { applyResponsiveGraphicSize, objectIsImage } from "../interaction-support.js";
import type { PlayerMessageResolver } from "../player-message-resolver.js";

export const DRAWING_STROKE_COLOR = "#000";
export const DRAWING_STROKE_WIDTH = 3;

export function renderDrawingResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  currentValue: QtiValue,
  messages: PlayerMessageResolver,
): HTMLElement {
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
  const width = drawingWidth(interaction);
  const height = drawingHeight(interaction);
  surface.setAttribute("viewBox", `0 0 ${width} ${height}`);
  applyResponsiveGraphicSize(surface, width, height);
  surface.style.touchAction = "none";
  const restoredStrokes = parseDrawingValue(currentValue);
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

  const summary = document.createElement("output");
  summary.className = "qti3-coordinate-output qti-visually-hidden";
  summary.setAttribute("aria-live", "polite");
  const strokes: DrawingStroke[] = [];
  let activeStroke: DrawingStroke | undefined;
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
    const count = strokes.length;
    summary.value = serializeDrawingStrokes(strokes);
    summary.textContent =
      count === 0
        ? messages.message("drawingStatusEmpty")
        : messages.message("drawingStatusStrokeCount", { count });
    surface.setAttribute(
      "aria-label",
      count === 0
        ? messages.message("drawingSurfaceEmpty")
        : messages.message("drawingSurfaceStrokeCount", { count }),
    );
  };
  for (const points of restoredStrokes) {
    const element = polylineElement(points);
    strokes.push({ points, element });
    surface.append(element);
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
    const element = polylineElement([point]);
    activeStroke = { points: [point], element };
    strokes.push(activeStroke);
    surface.append(element);
    surface.setPointerCapture(event.pointerId);
  });
  surface.addEventListener("pointermove", addPoint);
  surface.addEventListener("pointerup", finishStroke);
  surface.addEventListener("pointercancel", () => {
    activeStroke = undefined;
  });
  surface.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    const points = [
      { x: 10, y: 10 },
      { x: 90, y: 90 },
    ];
    const element = polylineElement(points);
    strokes.push({ points, element });
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

  const tools = document.createElement("div");
  tools.className = "qti3-drawing-tools";
  tools.append(clear);
  commit(false);
  group.append(surface, summary, tools);
  return group;
}

type DrawingPoint = { x: number; y: number };
type DrawingStroke = { points: DrawingPoint[]; element: SVGPolylineElement };

function dimension(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function scalarString(value: QtiValue): string {
  if (value === null || Array.isArray(value) || typeof value === "object") return "";
  return String(value);
}

function parseDrawingValue(value: QtiValue): DrawingPoint[][] {
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
  return raw?.startsWith("data:image/") ? raw : undefined;
}

function parseDrawingStrokePayload(raw: string): DrawingPoint[][] {
  return raw
    .split("|")
    .map((stroke) => {
      const numbers = stroke
        .trim()
        .split(/\s+/)
        .map(Number)
        .filter((item) => Number.isFinite(item));
      const points: DrawingPoint[] = [];
      for (let index = 0; index + 1 < numbers.length; index += 2) {
        points.push({ x: numbers[index]!, y: numbers[index + 1]! });
      }
      return points;
    })
    .filter((points) => points.length > 0);
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
      return `<polyline points="${xmlAttribute(serializeSvgPoints(stroke.points))}" fill="none" stroke="${DRAWING_STROKE_COLOR}" stroke-width="${DRAWING_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>`;
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

  context.strokeStyle = DRAWING_STROKE_COLOR;
  context.lineWidth = DRAWING_STROKE_WIDTH;
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const stroke of strokes) {
    const [first, ...rest] = stroke.points;
    if (!first) continue;
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
  return interaction.object.data;
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

function serializeDrawingStrokes(strokes: Pick<DrawingStroke, "points">[]): string {
  return strokes.map((stroke) => serializeDrawingStroke(stroke.points)).join(" | ");
}

function serializeDrawingStroke(points: DrawingPoint[]): string {
  return points.map((point) => `${point.x} ${point.y}`).join(" ");
}

function xmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function polylineElement(points: DrawingPoint[]): SVGPolylineElement {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  line.classList.add("qti3-drawing-stroke");
  line.setAttribute("points", serializeSvgPoints(points));
  return line;
}
