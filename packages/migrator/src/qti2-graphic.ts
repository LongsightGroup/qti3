import { attr, toNumber, type XmlElement } from "./xml.js";

export function graphicObject(object: XmlElement | null, coords: readonly string[]) {
  const dimensions = inferImageDimensions(coords);
  return {
    data: attr(object, "data") ?? "",
    alt: attr(object, "alt") ?? attr(object, "label") ?? "Image",
    type: attr(object, "type") ?? undefined,
    width: toNumber(attr(object, "width")) ?? dimensions.width,
    height: toNumber(attr(object, "height")) ?? dimensions.height,
  };
}

export function hotspotShape(value: string | null): "circle" | "rect" | "poly" {
  return value === "circle" || value === "poly" ? value : "rect";
}

function inferImageDimensions(coords: readonly string[]): { width: number; height: number } {
  let maxX = 1;
  let maxY = 1;
  for (const entry of coords) {
    const coordinateValues = entry
      .split(/[\s,]+/)
      .map(Number)
      .filter(Number.isFinite);
    for (let index = 0; index < coordinateValues.length; index += 2) {
      maxX = Math.max(maxX, coordinateValues[index] ?? 1);
      maxY = Math.max(maxY, coordinateValues[index + 1] ?? 1);
    }
  }
  return { width: Math.ceil(maxX), height: Math.ceil(maxY) };
}
