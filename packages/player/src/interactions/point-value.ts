import type { QtiObjectAsset, QtiValue } from "@longsightgroup/qti3-core";
import { valueToStrings } from "../interaction-support.js";

export function parsePointValue(value: QtiValue): { x: number; y: number } | undefined {
  const [raw] = valueToStrings(value);
  return parsePointString(raw);
}

export function parsePointValues(value: QtiValue): Array<{ x: number; y: number }> {
  return valueToStrings(value).flatMap((raw) => {
    const point = parsePointString(raw);
    return point ? [point] : [];
  });
}

function parsePointString(raw: string | undefined): { x: number; y: number } | undefined {
  if (!raw) return undefined;
  const values = raw.split(/\s+/).map(Number);
  const x = values[0];
  const y = values[1];
  if (typeof x !== "number" || typeof y !== "number") return undefined;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  return { x, y };
}

export function pointToString(point: { x: number; y: number } | undefined): string {
  return point ? `${point.x} ${point.y}` : "";
}

function dimension(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function objectAssetWidth(object: QtiObjectAsset | undefined, fallback: number): number {
  return dimension(object?.width, fallback);
}

export function objectAssetHeight(object: QtiObjectAsset | undefined, fallback: number): number {
  return dimension(object?.height, fallback);
}
