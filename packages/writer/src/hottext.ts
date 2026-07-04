import { assertQtiIdentifier } from "./identifier.js";
import {
  dedupeNonemptyTrimmed,
  duplicateDiagnostics,
  isNonNegativeInteger,
  isPositiveInteger,
  throwIfDiagnostics,
  validateItemBase,
  validateQtiIdentifier,
  writerDiagnostic,
} from "./diagnostics.js";
import {
  interactionAttributeList,
  optionalPromptSection,
  resolveResponseIdentifier,
} from "./interaction-shell.js";
import { responseProcessingTemplateXml } from "./response-processing.js";
import { assessmentItemShell } from "./shell.js";
import type { Qti3HottextBuilderInput, Qti3HottextChoice, Qti3WriterDiagnostic } from "./types.js";
import { xmlEscape } from "./xml.js";

export function buildQti3HottextItem(input: Qti3HottextBuilderInput): string {
  const diagnostics = validateQti3HottextItem(input);
  throwIfDiagnostics(diagnostics);
  return renderQti3HottextItem(input);
}

export function renderQti3HottextItem(input: Qti3HottextBuilderInput): string {
  const responseIdentifier = assertQtiIdentifier(
    resolveResponseIdentifier(input.responseIdentifier),
    "Hottext response identifier",
  );
  const escapedResponseIdentifier = xmlEscape(responseIdentifier);
  const cardinality = input.maxChoices === 1 ? "single" : "multiple";
  const correctResponse = dedupeNonemptyTrimmed(input.correctResponse).map((value) =>
    assertQtiIdentifier(value, "Hottext correct response identifier"),
  );
  const correctXml = correctResponse.length
    ? `    <qti-correct-response>
${correctResponse.map((value) => `      <qti-value>${xmlEscape(value)}</qti-value>`).join("\n")}
    </qti-correct-response>
`
    : "";
  const declarationsXml = `  <qti-response-declaration identifier="${escapedResponseIdentifier}" cardinality="${cardinality}" base-type="identifier">
${correctXml}  </qti-response-declaration>`;
  const choiceById = new Map(input.choices.map((choice) => [choice.identifier.trim(), choice]));
  const bodyContent = replaceHottextPlaceholders(input.bodyHtml, (identifier) => {
    const choice = choiceById.get(identifier);
    if (!choice) return "";
    return choiceXml(choice);
  })
    .split("\n")
    .map((line) => `      ${line}`)
    .join("\n");
  const interactionAttrs = interactionAttributeList({
    responseIdentifier: escapedResponseIdentifier,
    sharedVocabulary: input.sharedVocabulary,
    interactionType: "hottext",
    classNames: input.classNames,
    extraAttributes: [
      input.minChoices !== undefined ? `min-choices="${String(input.minChoices)}"` : "",
      input.maxChoices !== undefined ? `max-choices="${String(input.maxChoices)}"` : "",
      input.minChoicesMessage?.trim()
        ? `data-min-selections-message="${xmlEscape(input.minChoicesMessage.trim())}"`
        : "",
      input.maxChoicesMessage?.trim()
        ? `data-max-selections-message="${xmlEscape(input.maxChoicesMessage.trim())}"`
        : "",
    ],
  });
  const bodyXml = `    <qti-hottext-interaction ${interactionAttrs}>
${optionalPromptSection(input.promptHtml)}${bodyContent}
    </qti-hottext-interaction>`;
  return assessmentItemShell({
    ...input,
    declarationsXml,
    bodyXml,
    responseProcessingXml: responseProcessingTemplateXml("match_correct"),
  });
}

function choiceXml(choice: Qti3HottextChoice): string {
  const identifier = xmlEscape(assertQtiIdentifier(choice.identifier, "Hottext identifier"));
  const body = choice.contentHtml?.trim() ? choice.contentHtml : xmlEscape(choice.text ?? "");
  return `<qti-hottext identifier="${identifier}">${body}</qti-hottext>`;
}

export function validateQti3HottextItem(input: Qti3HottextBuilderInput): Qti3WriterDiagnostic[] {
  const diagnostics = validateItemBase(input);
  const responseIdentifier = resolveResponseIdentifier(input.responseIdentifier);
  const responseIdentifierDiagnostic = validateQtiIdentifier(
    "responseIdentifier",
    "Hottext response identifier",
    responseIdentifier,
  );
  if (responseIdentifierDiagnostic) diagnostics.push(responseIdentifierDiagnostic);

  if (!input.bodyHtml.trim()) {
    diagnostics.push(
      writerDiagnostic(
        "missing_hottext_body",
        "bodyHtml",
        "Hottext bodyHtml must contain qti-hottext placeholders.",
      ),
    );
  }
  if (!input.choices.length) {
    diagnostics.push(
      writerDiagnostic(
        "missing_hottext_choices",
        "choices",
        "Hottext items must include at least one hottext choice.",
      ),
    );
  }
  diagnostics.push(
    ...duplicateDiagnostics(
      input.choices.map((choice) => choice.identifier),
      "choices",
      "Hottext identifier",
    ),
  );
  for (const [index, choice] of input.choices.entries()) {
    const identifierDiagnostic = validateQtiIdentifier(
      `choices.${index}.identifier`,
      "Hottext identifier",
      choice.identifier,
    );
    if (identifierDiagnostic) diagnostics.push(identifierDiagnostic);
    if (!choice.text?.trim() && !choice.contentHtml?.trim()) {
      diagnostics.push(
        writerDiagnostic(
          "empty_hottext_choice",
          `choices.${index}`,
          "Hottext choices must include text or contentHtml.",
        ),
      );
    }
  }

  validateBounds(input, diagnostics);
  validateCorrectResponse(input, diagnostics);
  validatePlaceholders(input, diagnostics);
  return diagnostics;
}

function validateBounds(input: Qti3HottextBuilderInput, diagnostics: Qti3WriterDiagnostic[]): void {
  if (input.minChoices !== undefined && !isNonNegativeInteger(input.minChoices)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_hottext_min_choices",
        "minChoices",
        "Hottext minChoices must be a non-negative integer.",
        input.minChoices,
      ),
    );
  }
  if (input.maxChoices !== undefined && !isPositiveInteger(input.maxChoices)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_hottext_max_choices",
        "maxChoices",
        "Hottext maxChoices must be a positive integer.",
        input.maxChoices,
      ),
    );
  }
  if (
    input.minChoices !== undefined &&
    input.maxChoices !== undefined &&
    Number.isFinite(input.minChoices) &&
    Number.isFinite(input.maxChoices) &&
    input.minChoices > input.maxChoices
  ) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_hottext_choice_bounds",
        "minChoices",
        "Hottext minChoices must be less than or equal to maxChoices.",
        { minChoices: input.minChoices, maxChoices: input.maxChoices },
      ),
    );
  }
}

function validateCorrectResponse(
  input: Qti3HottextBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  diagnostics.push(
    ...duplicateDiagnostics(
      input.correctResponse,
      "correctResponse",
      "Hottext correct response identifier",
    ),
  );
  const choiceIdentifiers = new Set(input.choices.map((choice) => choice.identifier.trim()));
  const correctResponse = dedupeNonemptyTrimmed(input.correctResponse);
  if (correctResponse.length === 0) {
    diagnostics.push(
      writerDiagnostic(
        "missing_hottext_correct_response",
        "correctResponse",
        "Hottext items must include at least one correct response identifier.",
      ),
    );
  }
  if (input.maxChoices === 1 && correctResponse.length > 1) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_hottext_correct_response_count",
        "correctResponse",
        "Single-response hottext items can only have one correct selection.",
        correctResponse,
      ),
    );
  }
  if (
    input.maxChoices !== undefined &&
    Number.isFinite(input.maxChoices) &&
    correctResponse.length > input.maxChoices
  ) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_hottext_correct_response_max_choices",
        "correctResponse",
        "Hottext correct response count must not exceed maxChoices.",
        { correctResponse, maxChoices: input.maxChoices },
      ),
    );
  }
  for (const [index, identifier] of correctResponse.entries()) {
    const identifierDiagnostic = validateQtiIdentifier(
      `correctResponse.${index}`,
      "Hottext correct response identifier",
      identifier,
    );
    if (identifierDiagnostic) {
      diagnostics.push(identifierDiagnostic);
      continue;
    }
    if (!choiceIdentifiers.has(identifier)) {
      diagnostics.push(
        writerDiagnostic(
          "unknown_hottext_reference",
          `correctResponse.${index}`,
          `Hottext correct response references unknown choice "${identifier}".`,
          identifier,
        ),
      );
    }
  }
}

function validatePlaceholders(
  input: Qti3HottextBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  const allHottextIds = extractHottextIdentifiers(input.bodyHtml);
  const placeholderIds = extractHottextPlaceholderIdentifiers(input.bodyHtml);
  for (const index of extractHottextPlaceholderMissingIdentifierIndexes(input.bodyHtml)) {
    diagnostics.push(
      writerDiagnostic(
        "missing_hottext_placeholder_identifier",
        `bodyHtml.placeholders.${index}`,
        "Hottext placeholders must include an identifier attribute.",
      ),
    );
  }
  if (allHottextIds.length > placeholderIds.length) {
    diagnostics.push(
      writerDiagnostic(
        "non_empty_hottext_placeholder",
        "bodyHtml",
        "Hottext bodyHtml must contain empty qti-hottext placeholders for writer-owned choices.",
      ),
    );
  }
  if (!placeholderIds.length) {
    diagnostics.push(
      writerDiagnostic(
        "missing_hottext_placeholder",
        "bodyHtml",
        "Hottext bodyHtml must contain at least one qti-hottext placeholder.",
      ),
    );
  }
  diagnostics.push(
    ...duplicateDiagnostics(placeholderIds, "bodyHtml", "Hottext placeholder identifier"),
  );

  const choiceIds = new Set(input.choices.map((choice) => choice.identifier.trim()));
  const placeholderIdSet = new Set(placeholderIds);
  for (const [index, identifier] of placeholderIds.entries()) {
    if (!choiceIds.has(identifier)) {
      diagnostics.push(
        writerDiagnostic(
          "unknown_hottext_placeholder",
          `bodyHtml.placeholders.${index}`,
          `Hottext placeholder references undeclared choice "${identifier}".`,
          identifier,
        ),
      );
    }
  }
  for (const [index, choice] of input.choices.entries()) {
    if (!placeholderIdSet.has(choice.identifier.trim())) {
      diagnostics.push(
        writerDiagnostic(
          "missing_hottext_placeholder_for_choice",
          `choices.${index}.identifier`,
          `Hottext choice "${choice.identifier}" has no matching placeholder in bodyHtml.`,
          choice.identifier,
        ),
      );
    }
  }
}

function replaceHottextPlaceholders(
  bodyHtml: string,
  render: (identifier: string) => string,
): string {
  return bodyHtml.replace(
    /<qti-hottext\b([^>]*)\/>|<qti-hottext\b([^>]*)>\s*<\/qti-hottext>/gi,
    (match, selfClosingAttrs: string | undefined, pairedAttrs: string | undefined) => {
      const attrs = selfClosingAttrs ?? pairedAttrs ?? "";
      const identifier = extractIdentifier(attrs);
      return identifier ? render(identifier) : match;
    },
  );
}

function extractHottextPlaceholderIdentifiers(bodyHtml: string): string[] {
  const identifiers: string[] = [];
  const placeholderPattern = /<qti-hottext\b([^>]*)\/>|<qti-hottext\b([^>]*)>\s*<\/qti-hottext>/gi;
  for (const match of bodyHtml.matchAll(placeholderPattern)) {
    const identifier = extractIdentifier(match[1] ?? match[2] ?? "");
    if (identifier) identifiers.push(identifier);
  }
  return identifiers;
}

function extractHottextPlaceholderMissingIdentifierIndexes(bodyHtml: string): number[] {
  const indexes: number[] = [];
  const placeholderPattern = /<qti-hottext\b([^>]*)\/>|<qti-hottext\b([^>]*)>\s*<\/qti-hottext>/gi;
  let index = 0;
  for (const match of bodyHtml.matchAll(placeholderPattern)) {
    if (!extractIdentifier(match[1] ?? match[2] ?? "")) indexes.push(index);
    index += 1;
  }
  return indexes;
}

function extractHottextIdentifiers(bodyHtml: string): string[] {
  const identifiers: string[] = [];
  const hottextPattern = /<qti-hottext\b([^>]*)>/gi;
  for (const match of bodyHtml.matchAll(hottextPattern)) {
    const identifier = extractIdentifier(match[1] ?? "");
    if (identifier) identifiers.push(identifier);
  }
  return identifiers;
}

function extractIdentifier(attrs: string): string | undefined {
  return /\bidentifier\s*=\s*(["'])(.*?)\1/i.exec(attrs)?.[2]?.trim();
}
