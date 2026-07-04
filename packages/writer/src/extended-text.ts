import {
  isNonNegativeInteger,
  throwIfDiagnostics,
  validateItemBase,
  validateQtiIdentifier,
  writerDiagnostic,
} from "./diagnostics.js";
import { assertQtiIdentifier } from "./identifier.js";
import {
  interactionAttributeList,
  optionalBodySection,
  optionalPromptSection,
  resolveResponseIdentifier,
} from "./interaction-shell.js";
import { assessmentItemShell } from "./shell.js";
import type { Qti3ExtendedTextBuilderInput, Qti3WriterDiagnostic } from "./types.js";
import { indentXml, xmlEscape } from "./xml.js";

const FORMAT_VALUES = new Set(["plain", "preformatted", "xhtml"]);

export function buildQti3ExtendedTextItem(input: Qti3ExtendedTextBuilderInput): string {
  const diagnostics = validateQti3ExtendedTextItem(input);
  throwIfDiagnostics(diagnostics);
  return renderQti3ExtendedTextItem(input);
}

export function renderQti3ExtendedTextItem(input: Qti3ExtendedTextBuilderInput): string {
  const responseIdentifier = assertQtiIdentifier(
    resolveResponseIdentifier(input.responseIdentifier),
    "Extended text response identifier",
  );
  const escapedResponseIdentifier = xmlEscape(responseIdentifier);
  const declarationsXml = `  <qti-response-declaration identifier="${escapedResponseIdentifier}" cardinality="${
    input.responseCardinality ?? "single"
  }" base-type="${input.responseBaseType ?? "string"}"/>`;
  const interactionAttrs = interactionAttributeList({
    responseIdentifier: escapedResponseIdentifier,
    sharedVocabulary: input.sharedVocabulary,
    interactionType: "extendedText",
    classNames: input.classNames,
    extraAttributes: [
      numberAttribute("base", input.base),
      input.stringIdentifier?.trim()
        ? `string-identifier="${xmlEscape(
            assertQtiIdentifier(input.stringIdentifier, "Extended text string identifier"),
          )}"`
        : "",
      numberAttribute("expected-length", input.expectedLength),
      numberAttribute("expected-lines", input.expectedLines),
      numberAttribute("min-strings", input.minStrings),
      numberAttribute("max-strings", input.maxStrings),
      input.placeholderText?.trim()
        ? `placeholder-text="${xmlEscape(input.placeholderText.trim())}"`
        : "",
      input.patternMask?.trim() ? `pattern-mask="${xmlEscape(input.patternMask.trim())}"` : "",
      input.patternMessage?.trim()
        ? `data-patternmask-message="${xmlEscape(input.patternMessage.trim())}"`
        : "",
      `format="${input.format ?? "plain"}"`,
    ],
  });
  const interactionXml = `    <qti-extended-text-interaction ${interactionAttrs}>
${optionalPromptSection(input.promptHtml)}    </qti-extended-text-interaction>`;
  const rubricBlock = input.rubricHtml?.trim()
    ? `    <qti-rubric-block view="scorer" use="scoring">
      <qti-content-body>
${indentXml(input.rubricHtml, 8)}
      </qti-content-body>
    </qti-rubric-block>`
    : "";

  return assessmentItemShell({
    ...input,
    declarationsXml,
    bodyXml: [optionalBodySection(input.bodyHtml).trimEnd(), interactionXml, rubricBlock]
      .filter(Boolean)
      .join("\n"),
    responseProcessingXml: "",
  });
}

export function validateQti3ExtendedTextItem(
  input: Qti3ExtendedTextBuilderInput,
): Qti3WriterDiagnostic[] {
  const diagnostics = validateItemBase(input);
  const responseIdentifier = resolveResponseIdentifier(input.responseIdentifier);
  const responseIdentifierDiagnostic = validateQtiIdentifier(
    "responseIdentifier",
    "Extended text response identifier",
    responseIdentifier,
  );
  if (responseIdentifierDiagnostic) diagnostics.push(responseIdentifierDiagnostic);

  if (input.stringIdentifier !== undefined && input.stringIdentifier.trim()) {
    const stringIdentifierDiagnostic = validateQtiIdentifier(
      "stringIdentifier",
      "Extended text string identifier",
      input.stringIdentifier,
    );
    if (stringIdentifierDiagnostic) diagnostics.push(stringIdentifierDiagnostic);
  }

  validateResponseShape(input, diagnostics);
  validateFormat(input, diagnostics);
  validateNumericAttributes(input, diagnostics);
  validatePatternMask(input, diagnostics);
  return diagnostics;
}

function validateResponseShape(
  input: Qti3ExtendedTextBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  if (input.responseBaseType !== undefined && input.responseBaseType !== "string") {
    diagnostics.push(
      writerDiagnostic(
        "invalid_extended_text_response_base_type",
        "responseBaseType",
        "Extended text response base-type must be string.",
        input.responseBaseType,
      ),
    );
  }
  if (input.responseCardinality !== undefined && input.responseCardinality !== "single") {
    diagnostics.push(
      writerDiagnostic(
        "invalid_extended_text_response_cardinality",
        "responseCardinality",
        "Extended text response cardinality must be single.",
        input.responseCardinality,
      ),
    );
  }
}

function validateFormat(
  input: Qti3ExtendedTextBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  if (input.format === undefined || FORMAT_VALUES.has(input.format)) return;
  diagnostics.push(
    writerDiagnostic(
      "invalid_extended_text_format",
      "format",
      "Extended text format must be plain, preformatted, or xhtml.",
      input.format,
    ),
  );
}

function validateNumericAttributes(
  input: Qti3ExtendedTextBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  const attributes = [
    ["base", input.base],
    ["expectedLength", input.expectedLength],
    ["expectedLines", input.expectedLines],
    ["minStrings", input.minStrings],
    ["maxStrings", input.maxStrings],
  ] as const;
  for (const [path, value] of attributes) {
    if (value === undefined || isNonNegativeInteger(value)) continue;
    diagnostics.push(
      writerDiagnostic(
        "invalid_extended_text_numeric_attribute",
        path,
        "Extended text numeric attributes must be non-negative integers.",
        value,
      ),
    );
  }
  if (
    input.minStrings !== undefined &&
    input.maxStrings !== undefined &&
    isNonNegativeInteger(input.minStrings) &&
    isNonNegativeInteger(input.maxStrings) &&
    input.minStrings > input.maxStrings
  ) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_extended_text_string_bounds",
        "minStrings|maxStrings",
        "Extended text minStrings must be less than or equal to maxStrings.",
        { minStrings: input.minStrings, maxStrings: input.maxStrings },
      ),
    );
  }
}

function validatePatternMask(
  input: Qti3ExtendedTextBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  const patternMask = input.patternMask?.trim();
  if (!patternMask) return;
  try {
    RegExp(patternMask);
  } catch {
    diagnostics.push(
      writerDiagnostic(
        "invalid_extended_text_pattern_mask",
        "patternMask",
        "Extended text patternMask must be a valid regular expression.",
        input.patternMask,
      ),
    );
  }
}

function numberAttribute(name: string, value: number | undefined): string {
  return value === undefined ? "" : `${name}="${String(value)}"`;
}
