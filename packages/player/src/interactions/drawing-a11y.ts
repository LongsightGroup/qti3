import type { PlayerMessageResolver } from "../player-message-resolver.js";

export function createDrawingStatusOutput(): HTMLOutputElement {
  const summary = document.createElement("output");
  summary.className = "qti3-coordinate-output qti-visually-hidden";
  summary.setAttribute("aria-live", "polite");
  return summary;
}

export function createDrawingPenColorAnnouncement(): HTMLParagraphElement {
  const announcement = document.createElement("p");
  announcement.className = "qti3-drawing-pen-color-announcement qti-visually-hidden";
  announcement.setAttribute("aria-live", "polite");
  return announcement;
}

export function announceDrawingStrokeStatus(
  summary: HTMLOutputElement,
  surface: SVGSVGElement,
  messages: PlayerMessageResolver,
  strokeCount: number,
  serialized: string,
): void {
  summary.value = serialized;
  summary.textContent =
    strokeCount === 0
      ? messages.message("drawingStatusEmpty")
      : messages.message("drawingStatusStrokeCount", { count: strokeCount });
  surface.setAttribute(
    "aria-label",
    strokeCount === 0
      ? messages.message("drawingSurfaceEmpty")
      : messages.message("drawingSurfaceStrokeCount", { count: strokeCount }),
  );
}

export function announceDrawingPenColor(
  announcement: HTMLElement,
  messages: PlayerMessageResolver,
  color: string,
): void {
  announcement.textContent = messages.message("drawingPenColorSelected", { color });
}
