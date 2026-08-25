import { assertQtiIdentifier } from "./identifier.js";
import {
  classAttribute,
  uniqueTrimmed,
  validateCustomFamilyResponseDeclaration,
  validateXmlAttributeName,
} from "./custom-interaction-common.js";
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
import { indentXml, xmlAttributeList, escapeXmlAttribute } from "./xml.js";

const RESERVED_ATTRS = new Set(["response-identifier", "class", "definition"]);

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
  const escapedResponseIdentifier = escapeXmlAttribute(responseIdentifier);
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
  validateCustomFamilyResponseDeclaration(
    {
      responseBaseType: input.responseBaseType,
      responseCardinality: input.responseCardinality,
      codePrefix: "custom",
      label: "Custom interaction",
    },
    diagnostics,
  );
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
    input.definition?.trim() ? `definition="${escapeXmlAttribute(input.definition.trim())}"` : "",
    ...(input.attributes ?? []).map(
      (attribute) => `${attribute.name.trim()}="${escapeXmlAttribute(attribute.value.trim())}"`,
    ),
  ]);
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
    validateXmlAttributeName(
      name,
      `attributes.${index}.name`,
      "invalid_custom_attribute_name",
      "Custom interaction attribute",
      diagnostics,
    );
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
