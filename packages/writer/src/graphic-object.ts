import { isPositiveInteger, writerDiagnostic } from "./diagnostics.js";
import type { Qti3WriterDiagnostic } from "./types.js";
import { xmlEscape } from "./xml.js";

export interface Qti3GraphicObjectLike {
  readonly data: string;
  readonly alt?: string | undefined;
  readonly type?: string | undefined;
  readonly width?: number | undefined;
  readonly height?: number | undefined;
  readonly longDescription?: string | undefined;
}

export interface GraphicObjectValidationOptions {
  readonly codePrefix: string;
  readonly label: string;
  readonly path: string;
}

export interface GraphicObjectLongDescription {
  readonly blockXml: string;
  readonly attributeXml: string;
}

export function renderGraphicObjectAttributes(object: Qti3GraphicObjectLike): readonly string[] {
  return [
    `data="${xmlEscape(object.data.trim())}"`,
    `alt="${xmlEscape(object.alt?.trim() ?? "")}"`,
    `type="${xmlEscape(object.type ?? inferMimeFromSrc(object.data) ?? "")}"`,
    object.width !== undefined ? `width="${String(object.width)}"` : "",
    object.height !== undefined ? `height="${String(object.height)}"` : "",
  ];
}

export function optionalLongDescriptionBlock(
  identifier: string,
  longDescription: string | undefined,
): GraphicObjectLongDescription {
  const text = longDescription?.trim();
  if (!text) return { blockXml: "", attributeXml: "" };
  const id = `longdesc-${identifier}`;
  return {
    blockXml: `    <div id="${xmlEscape(id)}" class="qti-visually-hidden" data-qti-a11y-content-role="long-description">${xmlEscape(text)}</div>\n`,
    attributeXml: `data-qti-aria-describedby="${xmlEscape(id)}"`,
  };
}

export function validateGraphicObject(
  object: Qti3GraphicObjectLike,
  diagnostics: Qti3WriterDiagnostic[],
  options: GraphicObjectValidationOptions,
): void {
  if (!object.data.trim()) {
    diagnostics.push(
      writerDiagnostic(
        `missing_${options.codePrefix}_object_data`,
        `${options.path}.data`,
        `${options.label} object data is required.`,
      ),
    );
  }
  if (!object.alt?.trim()) {
    diagnostics.push(
      writerDiagnostic(
        `missing_${options.codePrefix}_object_alt`,
        `${options.path}.alt`,
        `${options.label} object alt text is required.`,
      ),
    );
  }
  if (object.type !== undefined && !object.type.trim()) {
    diagnostics.push(
      writerDiagnostic(
        `missing_${options.codePrefix}_object_type`,
        `${options.path}.type`,
        `${options.label} object type must not be empty when provided.`,
      ),
    );
  }
  if (object.type === undefined && object.data.trim() && !inferMimeFromSrc(object.data)) {
    diagnostics.push(
      writerDiagnostic(
        `unknown_${options.codePrefix}_object_type`,
        `${options.path}.type`,
        `${options.label} object type is required when it cannot be inferred from the image path.`,
        object.data,
      ),
    );
  }
  if (object.width !== undefined && !isPositiveInteger(object.width)) {
    diagnostics.push(
      writerDiagnostic(
        `invalid_${options.codePrefix}_object_width`,
        `${options.path}.width`,
        `${options.label} object width must be a positive integer when provided.`,
        object.width,
      ),
    );
  }
  if (object.height !== undefined && !isPositiveInteger(object.height)) {
    diagnostics.push(
      writerDiagnostic(
        `invalid_${options.codePrefix}_object_height`,
        `${options.path}.height`,
        `${options.label} object height must be a positive integer when provided.`,
        object.height,
      ),
    );
  }
}

export function inferMimeFromSrc(src: string): string | undefined {
  const path = src.toLowerCase();
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".svg") || path.endsWith(".svgz")) return "image/svg+xml";
  if (path.endsWith(".webp")) return "image/webp";
  return undefined;
}
