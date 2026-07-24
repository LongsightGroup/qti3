import type { Qti3AuthoringItem } from "@longsightgroup/qti3-writer";

import { normalizeIdentifier } from "./text.js";
import type {
  QtiMigrationDiagnostic,
  QtiMigrationSourceFormat,
  ResolvedQtiMigrationOptions,
} from "./types.js";
import { attr, type XmlElement } from "./xml.js";

export interface Qti2Context {
  readonly identifier: string;
  readonly title: string;
  readonly body: XmlElement;
  readonly responseDecls: readonly XmlElement[];
  readonly responseDeclMap: ReadonlyMap<string, XmlElement>;
  readonly sourceFormat: QtiMigrationSourceFormat;
  readonly path: string;
  readonly options: ResolvedQtiMigrationOptions;
  readonly diagnostics: QtiMigrationDiagnostic[];
  blocked?: readonly QtiMigrationDiagnostic[] | undefined;
}

export type Qti2ItemMapper = (context: Qti2Context) => Qti3AuthoringItem | undefined;

export type Qti2InteractionMapper = (
  interaction: XmlElement,
  context: Qti2Context,
) => Qti3AuthoringItem | undefined;

export function responseIdentifierFor(interaction: XmlElement, fallback = "RESPONSE"): string {
  return normalizeIdentifier(
    attr(interaction, "responseIdentifier") ?? attr(interaction, "response-identifier"),
    fallback,
  );
}

export function baseType(value: string | null): "string" | "integer" | "float" {
  const normalized = value?.toLowerCase();
  return normalized === "integer" || normalized === "float" ? normalized : "string";
}

export function responseCardinality(value: string | null): "single" | "multiple" | "ordered" {
  const normalized = value?.toLowerCase();
  return normalized === "multiple" || normalized === "ordered" ? normalized : "single";
}

export function extendedTextFormat(value: string | null): "plain" | "preformatted" | "xhtml" {
  return value === "preformatted" || value === "xhtml" ? value : "plain";
}
