import { describe, expect, it } from "vitest";
import {
  DRAWING_STROKE_COLOR,
  isDrawingColor,
  normalizeDrawingColor,
  normalizeRestoredDrawingStrokes,
  parseDrawingStrokePayload,
  penColorForInteraction,
  serializeDrawingStrokes,
} from "./drawing-interaction.js";

describe("drawing stroke serialization", () => {
  it("accepts six-digit hex colors case-insensitively", () => {
    expect(isDrawingColor("#CC0000")).toBe(true);
    expect(normalizeDrawingColor("#CC0000")).toBe("#cc0000");
  });

  it("rejects invalid and three-digit hex colors", () => {
    expect(isDrawingColor("#abc")).toBe(false);
    expect(isDrawingColor("cc0000")).toBe(false);
    expect(isDrawingColor("")).toBe(false);
    expect(normalizeDrawingColor("#abc")).toBe(DRAWING_STROKE_COLOR);
    expect(normalizeDrawingColor("not-a-color")).toBe(DRAWING_STROKE_COLOR);
  });

  it("does not treat three-digit hex prefixes as stroke colors", () => {
    expect(parseDrawingStrokePayload("#abc:10 10 90 90")).toEqual([
      {
        color: DRAWING_STROKE_COLOR,
        points: [
          { x: 10, y: 10 },
          { x: 90, y: 90 },
        ],
      },
    ]);
  });

  it("serializes strokes with color prefixes", () => {
    expect(
      serializeDrawingStrokes([
        {
          color: "#cc0000",
          points: [
            { x: 10, y: 10 },
            { x: 90, y: 90 },
          ],
        },
      ]),
    ).toBe("#cc0000:10 10 90 90");
  });

  it("parses legacy coordinate-only strokes as black", () => {
    expect(parseDrawingStrokePayload("10 10 90 90")).toEqual([
      {
        color: DRAWING_STROKE_COLOR,
        points: [
          { x: 10, y: 10 },
          { x: 90, y: 90 },
        ],
      },
    ]);
  });

  it("forces black when the palette is disabled", () => {
    expect(penColorForInteraction(true, "#cc0000")).toBe(DRAWING_STROKE_COLOR);
    expect(
      normalizeRestoredDrawingStrokes(
        [
          {
            color: "#cc0000",
            points: [
              { x: 10, y: 10 },
              { x: 90, y: 90 },
            ],
          },
        ],
        true,
      ),
    ).toEqual([
      {
        color: DRAWING_STROKE_COLOR,
        points: [
          { x: 10, y: 10 },
          { x: 90, y: 90 },
        ],
      },
    ]);
  });

  it("round-trips colored strokes", () => {
    const payload = serializeDrawingStrokes([
      {
        color: "#cc0000",
        points: [
          { x: 10, y: 10 },
          { x: 90, y: 90 },
        ],
      },
      {
        color: "#ffcc00",
        points: [
          { x: 20, y: 20 },
          { x: 40, y: 40 },
        ],
      },
    ]);

    expect(parseDrawingStrokePayload(payload)).toEqual([
      {
        color: "#cc0000",
        points: [
          { x: 10, y: 10 },
          { x: 90, y: 90 },
        ],
      },
      {
        color: "#ffcc00",
        points: [
          { x: 20, y: 20 },
          { x: 40, y: 40 },
        ],
      },
    ]);
  });
});
