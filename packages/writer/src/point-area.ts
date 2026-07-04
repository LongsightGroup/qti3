import { writerDiagnostic } from "./diagnostics.js";
import type { Qti3WriterDiagnostic } from "./types.js";
import { xmlAttributeList, xmlEscape } from "./xml.js";

export type Qti3PointAreaShape = "circle" | "default" | "poly" | "rect";

export interface Qti3PointAreaTarget {
  readonly shape: Qti3PointAreaShape;
  readonly coords: string;
  readonly mappedValue?: number | undefined;
}

export interface PointAreaValidationOptions {
  readonly codePrefix: string;
  readonly label: string;
  readonly path: string;
  readonly requireTargets?: boolean | undefined;
}

export interface PointResponseDeclarationInput {
  readonly responseIdentifier: string;
  readonly cardinality: "single" | "multiple";
  readonly correctResponse?: readonly string[] | undefined;
  readonly targets?: readonly Qti3PointAreaTarget[] | undefined;
}

export function pointCardinality(input: {
  readonly minChoices?: number | undefined;
  readonly maxChoices?: number | undefined;
}): "single" | "multiple" {
  if ((input.maxChoices ?? 1) > 1 || (input.minChoices ?? 0) > 1) return "multiple";
  return "single";
}

export function pointResponseDeclarationXml(input: PointResponseDeclarationInput): string {
  const correctResponse = input.correctResponse ?? [];
  const correctResponseXml = correctResponse.length
    ? `    <qti-correct-response>
${correctResponse.map((point) => `      <qti-value>${xmlEscape(point.trim())}</qti-value>`).join("\n")}
    </qti-correct-response>
`
    : "";
  return `  <qti-response-declaration identifier="${xmlEscape(input.responseIdentifier)}" cardinality="${input.cardinality}" base-type="point">
${correctResponseXml}${areaMappingBlock(input.targets)}  </qti-response-declaration>`;
}

export function areaMappingBlock(targets: readonly Qti3PointAreaTarget[] | undefined): string {
  if (!targets?.length) return "";
  const entriesXml = targets
    .map((target) => {
      const attrs = [
        `shape="${target.shape}"`,
        `coords="${xmlEscape(target.coords.trim())}"`,
        `mapped-value="${String(target.mappedValue ?? 1)}"`,
      ];
      return `      <qti-area-map-entry ${xmlAttributeList(attrs)}/>`;
    })
    .join("\n");
  return `    <qti-area-mapping default-value="0">
${entriesXml}
    </qti-area-mapping>
`;
}

export function isPointValue(value: string): boolean {
  const parts = value.trim().split(/\s+/);
  return parts.length === 2 && parts.every((part) => Number.isFinite(Number(part)));
}

export function dedupePointValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const point = normalizedPointValue(value);
    if (!point || seen.has(point)) continue;
    seen.add(point);
    out.push(point);
  }
  return out;
}

export function duplicatePointValueDiagnostics(
  values: readonly string[],
  path: string,
  label: string,
): Qti3WriterDiagnostic[] {
  const seen = new Set<string>();
  const duplicateValues = new Set<string>();
  for (const value of values) {
    const point = normalizedPointValue(value);
    if (!point) continue;
    if (seen.has(point)) duplicateValues.add(point);
    else seen.add(point);
  }
  return Array.from(duplicateValues).map((value) =>
    writerDiagnostic("duplicate_identifier", path, `${label} "${value}" must be unique.`, value),
  );
}

export function validatePointValues(
  points: readonly string[],
  path: string,
  label: string,
  invalidCode: string,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  diagnostics.push(...duplicatePointValueDiagnostics(points, path, label));
  for (const [index, point] of points.entries()) {
    if (isPointValue(point)) continue;
    diagnostics.push(
      writerDiagnostic(
        invalidCode,
        `${path}.${index}`,
        `${label} values must be QTI point values in the form "x y".`,
        point,
      ),
    );
  }
}

function normalizedPointValue(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function validatePointAreaTargets(
  targets: readonly Qti3PointAreaTarget[] | undefined,
  diagnostics: Qti3WriterDiagnostic[],
  options: PointAreaValidationOptions,
): void {
  if (options.requireTargets && !targets?.length) {
    diagnostics.push(
      writerDiagnostic(
        `missing_${options.codePrefix}_targets`,
        options.path,
        `${options.label} must include at least one area mapping target for map_response_point scoring.`,
      ),
    );
  }
  for (const [index, target] of (targets ?? []).entries()) {
    const targetPath = `${options.path}.${index}`;
    if (!isPointAreaShape(target.shape)) {
      diagnostics.push(
        writerDiagnostic(
          `invalid_${options.codePrefix}_target_shape`,
          `${targetPath}.shape`,
          `${options.label} target shape must be circle, default, poly, or rect.`,
          target.shape,
        ),
      );
    }
    if (!target.coords.trim()) {
      diagnostics.push(
        writerDiagnostic(
          `missing_${options.codePrefix}_target_coords`,
          `${targetPath}.coords`,
          `${options.label} target coordinates are required.`,
        ),
      );
    } else if (!isNumericCsv(target.coords)) {
      diagnostics.push(
        writerDiagnostic(
          `invalid_${options.codePrefix}_target_coords`,
          `${targetPath}.coords`,
          `${options.label} target coordinates must be comma-separated finite numbers.`,
          target.coords,
        ),
      );
    } else if (!hasValidAreaCoordinateCount(target.shape, numericCsv(target.coords))) {
      diagnostics.push(
        writerDiagnostic(
          `invalid_${options.codePrefix}_target_coords`,
          `${targetPath}.coords`,
          `${options.label} target shape ${target.shape} has invalid coordinate arity.`,
          target.coords,
        ),
      );
    }
    if (target.mappedValue !== undefined && !Number.isFinite(target.mappedValue)) {
      diagnostics.push(
        writerDiagnostic(
          `invalid_${options.codePrefix}_mapped_value`,
          `${targetPath}.mappedValue`,
          `${options.label} target mappedValue must be a finite number when provided.`,
          target.mappedValue,
        ),
      );
    }
  }
}

function isPointAreaShape(value: string): value is Qti3PointAreaShape {
  return value === "circle" || value === "default" || value === "poly" || value === "rect";
}

function isNumericCsv(value: string): boolean {
  return value
    .split(",")
    .map((part) => part.trim())
    .every((part) => part.length > 0 && Number.isFinite(Number(part)));
}

function numericCsv(value: string): number[] {
  return value.split(",").map((part) => Number(part.trim()));
}

function hasValidAreaCoordinateCount(
  shape: Qti3PointAreaShape,
  coords: readonly number[],
): boolean {
  if (shape === "circle") return coords.length === 3;
  if (shape === "rect") return coords.length === 4;
  if (shape === "poly") return coords.length >= 6 && coords.length % 2 === 0;
  return true;
}
