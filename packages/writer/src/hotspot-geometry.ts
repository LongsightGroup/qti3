import { isNonNegativeInteger, validateQtiIdentifier, writerDiagnostic } from "./diagnostics.js";
import type { Qti3HotspotShape, Qti3WriterDiagnostic } from "./types.js";

export interface Qti3HotspotGeometryLike {
  readonly identifier: string;
  readonly shape: Qti3HotspotShape;
  readonly coords: string;
  readonly matchMax?: number | undefined;
}

export interface HotspotGeometryValidationOptions {
  readonly identifierLabel: string;
  readonly itemLabel: string;
  readonly missingCoordsCode: string;
  readonly invalidShapeCode: string;
  readonly invalidMatchMaxCode?: string | undefined;
}

export function validateHotspotGeometry(
  hotspot: Qti3HotspotGeometryLike,
  path: string,
  diagnostics: Qti3WriterDiagnostic[],
  options: HotspotGeometryValidationOptions,
): void {
  const identifierDiagnostic = validateQtiIdentifier(
    `${path}.identifier`,
    options.identifierLabel,
    hotspot.identifier,
  );
  if (identifierDiagnostic) diagnostics.push(identifierDiagnostic);
  if (!hotspot.coords.trim()) {
    diagnostics.push(
      writerDiagnostic(
        options.missingCoordsCode,
        `${path}.coords`,
        `${options.itemLabel} "${hotspot.identifier}" must have coordinates.`,
      ),
    );
  }
  if (!["circle", "rect", "poly"].includes(hotspot.shape)) {
    diagnostics.push(
      writerDiagnostic(
        options.invalidShapeCode,
        `${path}.shape`,
        `${options.itemLabel} "${hotspot.identifier}" shape must be circle, rect, or poly.`,
        hotspot.shape,
      ),
    );
  }
  if (
    options.invalidMatchMaxCode &&
    hotspot.matchMax !== undefined &&
    !isNonNegativeInteger(hotspot.matchMax)
  ) {
    diagnostics.push(
      writerDiagnostic(
        options.invalidMatchMaxCode,
        `${path}.matchMax`,
        `${options.itemLabel} matchMax must be a non-negative integer.`,
        hotspot.matchMax,
      ),
    );
  }
}
