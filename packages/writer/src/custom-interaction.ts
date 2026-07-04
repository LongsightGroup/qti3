import { assertQtiIdentifier } from "./identifier.js";
import {
  duplicateDiagnostics,
  throwIfDiagnostics,
  validateItemBase,
  validateQtiIdentifier,
  writerDiagnostic,
} from "./diagnostics.js";
import {
  optionalBodySection,
  optionalPromptSection,
  resolveResponseIdentifier,
} from "./interaction-shell.js";
import { trustedResponseProcessingXml } from "./response-processing.js";
import { assessmentItemShell } from "./shell.js";
import type { Qti3CustomInteractionBuilderInput, Qti3WriterDiagnostic } from "./types.js";
import { indentXml, xmlAttributeList, xmlEscape } from "./xml.js";

const BASE_TYPES = new Set([
  "identifier",
  "boolean",
  "integer",
  "float",
  "string",
  "point",
  "pair",
  "directedPair",
  "duration",
  "file",
  "uri",
]);
const CARDINALITIES = new Set(["single", "multiple", "ordered", "record"]);
const RESERVED_ATTRS = new Set(["response-identifier", "class", "definition"]);
const ATTR_NAME_RE = /^[A-Za-z_][A-Za-z0-9:._-]*$/;

export function buildQti3CustomInteractionItem(input: Qti3CustomInteractionBuilderInput): string {
  const diagnostics = validateQti3CustomInteractionItem(input);
  throwIfDiagnostics(diagnostics);
  return renderQti3CustomInteractionItem(input);
}

export function renderQti3CustomInteractionItem(input: Qti3CustomInteractionBuilderInput): string {
  const responseIdentifier = assertQtiIdentifier(
    resolveResponseIdentifier(input.responseIdentifier),
    "Custom interaction response identifier",
  );
  const escapedResponseIdentifier = xmlEscape(responseIdentifier);
  const declarationsXml = `  <qti-response-declaration identifier="${escapedResponseIdentifier}" cardinality="${
    input.responseCardinality ?? "single"
  }" base-type="${input.responseBaseType ?? "string"}"/>`;
  const interactionAttrs = customInteractionAttributes(input, escapedResponseIdentifier);
  const promptSection = optionalPromptSection(input.promptHtml);
  const markup = indentXml(input.interactionMarkupHtml.trim(), 6);
  const bodyXml = `${optionalBodySection(input.bodyHtml)}    <qti-custom-interaction ${interactionAttrs}>
${promptSection}${markup}
    </qti-custom-interaction>`;

  return assessmentItemShell({
    ...input,
    declarationsXml,
    bodyXml,
    responseProcessingXml: trustedResponseProcessingXml(input.responseProcessingXml),
    scoreDefaultZero: true,
  });
}

export function validateQti3CustomInteractionItem(
  input: Qti3CustomInteractionBuilderInput,
): Qti3WriterDiagnostic[] {
  const diagnostics = validateItemBase(input);
  const responseIdentifier = resolveResponseIdentifier(input.responseIdentifier);
  const responseIdentifierDiagnostic = validateQtiIdentifier(
    "responseIdentifier",
    "Custom interaction response identifier",
    responseIdentifier,
  );
  if (responseIdentifierDiagnostic) diagnostics.push(responseIdentifierDiagnostic);
  validateResponseDeclaration(input, diagnostics);
  validateCustomAttributes(input, diagnostics);
  if (!input.interactionMarkupHtml.trim()) {
    diagnostics.push(
      writerDiagnostic(
        "missing_custom_interaction_markup",
        "interactionMarkupHtml",
        "Custom interaction markup is required.",
      ),
    );
  }
  return diagnostics;
}

function customInteractionAttributes(
  input: Qti3CustomInteractionBuilderInput,
  escapedResponseIdentifier: string,
): string {
  return xmlAttributeList([
    `response-identifier="${escapedResponseIdentifier}"`,
    classAttribute(input.classNames ?? []),
    input.definition?.trim() ? `definition="${xmlEscape(input.definition.trim())}"` : "",
    ...(input.attributes ?? []).map(
      (attribute) => `${attribute.name.trim()}="${xmlEscape(attribute.value.trim())}"`,
    ),
  ]);
}

function classAttribute(classNames: readonly string[]): string {
  const tokens = uniqueTrimmed(classNames);
  return tokens.length ? `class="${xmlEscape(tokens.join(" "))}"` : "";
}

function validateResponseDeclaration(
  input: Qti3CustomInteractionBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  if (input.responseBaseType !== undefined && !BASE_TYPES.has(input.responseBaseType)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_custom_response_base_type",
        "responseBaseType",
        "Custom interaction response base-type must be a QTI base type.",
        input.responseBaseType,
      ),
    );
  }
  if (input.responseCardinality !== undefined && !CARDINALITIES.has(input.responseCardinality)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_custom_response_cardinality",
        "responseCardinality",
        "Custom interaction response cardinality must be single, multiple, ordered, or record.",
        input.responseCardinality,
      ),
    );
  }
}

function validateCustomAttributes(
  input: Qti3CustomInteractionBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  diagnostics.push(
    ...duplicateDiagnostics(
      [
        ...(input.attributes ?? []).map((attribute) => attribute.name),
        ...(uniqueTrimmed(input.classNames ?? []).length ? ["class"] : []),
        ...(input.definition?.trim() ? ["definition"] : []),
      ],
      "attributes",
      "Custom interaction attribute",
    ),
  );
  for (const [index, attribute] of (input.attributes ?? []).entries()) {
    const name = attribute.name.trim();
    if (!name) {
      diagnostics.push(
        writerDiagnostic(
          "missing_custom_attribute_name",
          `attributes.${index}.name`,
          "Custom interaction attribute names must not be empty.",
        ),
      );
      continue;
    }
    if (!ATTR_NAME_RE.test(name)) {
      diagnostics.push(
        writerDiagnostic(
          "invalid_custom_attribute_name",
          `attributes.${index}.name`,
          `Custom interaction attribute "${name}" is not a valid XML attribute name.`,
          name,
        ),
      );
    }
    if (RESERVED_ATTRS.has(name)) {
      diagnostics.push(
        writerDiagnostic(
          "reserved_custom_attribute_name",
          `attributes.${index}.name`,
          `Custom interaction attribute "${name}" is reserved by the writer API.`,
          name,
        ),
      );
    }
  }
}

function uniqueTrimmed(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}
