import { assertQtiIdentifier } from "./identifier.js";
import {
  duplicateDiagnostics,
  throwIfDiagnostics,
  validateItemBase,
  validateQtiIdentifier,
  writerDiagnostic,
} from "./diagnostics.js";
import {
  allOrNothingCorrectProcessingXml,
  sumMappedResponsesProcessingXml,
} from "./response-processing.js";
import { sharedVocabularyXmlAttributes } from "./shared-vocabulary.js";
import { assessmentItemShell } from "./shell.js";
import type {
  Qti3InlineChoiceBuilderInput,
  Qti3InlineChoiceOption,
  Qti3InlineChoiceSlot,
  Qti3WriterDiagnostic,
} from "./types.js";
import { xmlAttributeList, xmlEscape } from "./xml.js";

export function buildQti3InlineChoiceItem(input: Qti3InlineChoiceBuilderInput): string {
  const diagnostics = validateQti3InlineChoiceItem(input);
  throwIfDiagnostics(diagnostics);
  return renderQti3InlineChoiceItem(input);
}

export function renderQti3InlineChoiceItem(input: Qti3InlineChoiceBuilderInput): string {
  const scoring = input.scoring ?? "all_or_nothing";
  const declarationsXml = input.slots
    .map((slot) => responseDeclarationXml(slot, scoring))
    .join("\n");
  const slotById = new Map(input.slots.map((slot) => [slot.responseIdentifier.trim(), slot]));
  const bodyXml = `    ${replaceInlineChoicePlaceholders(input.bodyHtml, (responseIdentifier) => {
    const slot = slotById.get(responseIdentifier);
    if (!slot) return "";
    return interactionXml(slot, input);
  })
    .split("\n")
    .join("\n    ")}`;

  return assessmentItemShell({
    ...input,
    declarationsXml,
    bodyXml,
    responseProcessingXml:
      scoring === "map_response"
        ? sumMappedResponsesProcessingXml(input.slots.map((slot) => slot.responseIdentifier))
        : allOrNothingCorrectProcessingXml(
            input.slots.map((slot) => slot.responseIdentifier),
            input.slots.length,
          ),
    scoreDefaultZero: true,
  });
}

function responseDeclarationXml(
  slot: Qti3InlineChoiceSlot,
  scoring: "all_or_nothing" | "map_response",
): string {
  const responseIdentifier = xmlEscape(
    assertQtiIdentifier(slot.responseIdentifier, "Inline choice response identifier"),
  );
  const correctResponse = slot.correctResponse?.trim() ?? "";
  const correctResponseXml = correctResponse
    ? `    <qti-correct-response>
      <qti-value>${xmlEscape(correctResponse)}</qti-value>
    </qti-correct-response>
`
    : "";
  return `  <qti-response-declaration identifier="${responseIdentifier}" cardinality="single" base-type="identifier">
${correctResponseXml}${mappingXml(slot, scoring)}  </qti-response-declaration>`;
}

function mappingXml(
  slot: Qti3InlineChoiceSlot,
  scoring: "all_or_nothing" | "map_response",
): string {
  if (scoring !== "map_response") return "";
  const correctResponse = slot.correctResponse?.trim() ?? "";
  const entries = slot.options
    .map((option) => {
      const identifier = xmlEscape(
        assertQtiIdentifier(option.identifier, "Inline choice option identifier"),
      );
      const mappedValue =
        option.score !== undefined && Number.isFinite(option.score)
          ? option.score
          : option.identifier.trim() === correctResponse
            ? 1
            : 0;
      return `      <qti-map-entry map-key="${identifier}" mapped-value="${String(mappedValue)}"/>`;
    })
    .join("\n");
  return `    <qti-mapping default-value="0">
${entries}
    </qti-mapping>
`;
}

function interactionXml(slot: Qti3InlineChoiceSlot, input: Qti3InlineChoiceBuilderInput): string {
  const responseIdentifier = xmlEscape(
    assertQtiIdentifier(slot.responseIdentifier, "Inline choice response identifier"),
  );
  const attrs = xmlAttributeList([
    `response-identifier="${responseIdentifier}"`,
    `shuffle="${slot.shuffle ? "true" : "false"}"`,
    slot.required === undefined ? "" : `required="${slot.required ? "true" : "false"}"`,
    sharedVocabularyXmlAttributes(slot.sharedVocabulary ?? input.sharedVocabulary, "inlineChoice", [
      ...(input.classNames ?? []),
      ...(slot.classNames ?? []),
    ]).trim(),
  ]);
  const choices = slot.options.map(optionXml).join("\n");
  return `<qti-inline-choice-interaction ${attrs}>
${choices}
    </qti-inline-choice-interaction>`;
}

function optionXml(option: Qti3InlineChoiceOption): string {
  const identifier = xmlEscape(assertQtiIdentifier(option.identifier, "Inline choice option"));
  const fixed = option.fixed ? ' fixed="true"' : "";
  const body = option.contentHtml?.trim() ? option.contentHtml : xmlEscape(option.text ?? "");
  return `      <qti-inline-choice identifier="${identifier}"${fixed}>${body}</qti-inline-choice>`;
}

export function validateQti3InlineChoiceItem(
  input: Qti3InlineChoiceBuilderInput,
): Qti3WriterDiagnostic[] {
  const diagnostics = validateItemBase(input);
  if (!input.bodyHtml.trim()) {
    diagnostics.push(
      writerDiagnostic(
        "missing_inline_choice_body",
        "bodyHtml",
        "Inline choice bodyHtml must contain qti-inline-choice-interaction placeholders.",
      ),
    );
  }
  if (!input.slots.length) {
    diagnostics.push(
      writerDiagnostic(
        "missing_inline_choice_slots",
        "slots",
        "Inline choice items must include at least one slot.",
      ),
    );
  }
  diagnostics.push(
    ...duplicateDiagnostics(
      input.slots.map((slot) => slot.responseIdentifier),
      "slots",
      "Inline choice response identifier",
    ),
  );

  for (const [slotIndex, slot] of input.slots.entries()) {
    validateSlot(slot, slotIndex, diagnostics);
  }

  const allInteractionIds = extractInlineChoiceInteractionIdentifiers(input.bodyHtml);
  const placeholderIds = extractInlineChoicePlaceholderIdentifiers(input.bodyHtml);
  if (allInteractionIds.length > placeholderIds.length) {
    diagnostics.push(
      writerDiagnostic(
        "non_empty_inline_choice_placeholder",
        "bodyHtml",
        "Inline choice bodyHtml must contain empty qti-inline-choice-interaction placeholders for writer-owned slots.",
      ),
    );
  }
  if (!placeholderIds.length) {
    diagnostics.push(
      writerDiagnostic(
        "missing_inline_choice_placeholder",
        "bodyHtml",
        "Inline choice bodyHtml must contain at least one qti-inline-choice-interaction placeholder.",
      ),
    );
  }
  diagnostics.push(
    ...duplicateDiagnostics(
      placeholderIds,
      "bodyHtml",
      "Inline choice placeholder response identifier",
    ),
  );
  const slotIds = new Set(input.slots.map((slot) => slot.responseIdentifier.trim()));
  const placeholderIdSet = new Set(placeholderIds);
  for (const [index, responseIdentifier] of placeholderIds.entries()) {
    if (!slotIds.has(responseIdentifier)) {
      diagnostics.push(
        writerDiagnostic(
          "unknown_inline_choice_placeholder",
          `bodyHtml.placeholders.${index}`,
          `Inline choice placeholder references undeclared response "${responseIdentifier}".`,
          responseIdentifier,
        ),
      );
    }
  }
  for (const [index, slot] of input.slots.entries()) {
    if (!placeholderIdSet.has(slot.responseIdentifier.trim())) {
      diagnostics.push(
        writerDiagnostic(
          "missing_inline_choice_placeholder_for_slot",
          `slots.${index}.responseIdentifier`,
          `Inline choice response "${slot.responseIdentifier}" has no matching placeholder in bodyHtml.`,
          slot.responseIdentifier,
        ),
      );
    }
  }

  return diagnostics;
}

function validateSlot(
  slot: Qti3InlineChoiceSlot,
  slotIndex: number,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  const responseIdentifierDiagnostic = validateQtiIdentifier(
    `slots.${slotIndex}.responseIdentifier`,
    "Inline choice response identifier",
    slot.responseIdentifier,
  );
  if (responseIdentifierDiagnostic) diagnostics.push(responseIdentifierDiagnostic);
  if (slot.options.length < 2) {
    diagnostics.push(
      writerDiagnostic(
        "missing_inline_choice_options",
        `slots.${slotIndex}.options`,
        "Inline choice slots must include at least two options.",
      ),
    );
  }
  diagnostics.push(
    ...duplicateDiagnostics(
      slot.options.map((option) => option.identifier),
      `slots.${slotIndex}.options`,
      "Inline choice option identifier",
    ),
  );
  for (const [optionIndex, option] of slot.options.entries()) {
    const identifierDiagnostic = validateQtiIdentifier(
      `slots.${slotIndex}.options.${optionIndex}.identifier`,
      "Inline choice option identifier",
      option.identifier,
    );
    if (identifierDiagnostic) diagnostics.push(identifierDiagnostic);
    if (!option.text?.trim() && !option.contentHtml?.trim()) {
      diagnostics.push(
        writerDiagnostic(
          "empty_inline_choice_option",
          `slots.${slotIndex}.options.${optionIndex}`,
          "Inline choice options must include text or contentHtml.",
        ),
      );
    }
    if (option.score !== undefined && !Number.isFinite(option.score)) {
      diagnostics.push(
        writerDiagnostic(
          "invalid_inline_choice_score",
          `slots.${slotIndex}.options.${optionIndex}.score`,
          "Inline choice option score must be finite when provided.",
          option.score,
        ),
      );
    }
  }
  const correctResponse = slot.correctResponse?.trim() ?? "";
  if (!correctResponse) {
    diagnostics.push(
      writerDiagnostic(
        "missing_inline_choice_correct_response",
        `slots.${slotIndex}.correctResponse`,
        "Inline choice slots must include a correct response.",
      ),
    );
    return;
  }
  const correctResponseDiagnostic = validateQtiIdentifier(
    `slots.${slotIndex}.correctResponse`,
    "Inline choice correct response identifier",
    correctResponse,
  );
  if (correctResponseDiagnostic) {
    diagnostics.push(correctResponseDiagnostic);
    return;
  }
  const optionIds = new Set(slot.options.map((option) => option.identifier.trim()));
  if (!optionIds.has(correctResponse)) {
    diagnostics.push(
      writerDiagnostic(
        "unknown_inline_choice_correct_response",
        `slots.${slotIndex}.correctResponse`,
        `Inline choice correct response references unknown option "${correctResponse}".`,
        correctResponse,
      ),
    );
  }
}

function replaceInlineChoicePlaceholders(
  bodyHtml: string,
  render: (responseIdentifier: string) => string,
): string {
  return bodyHtml.replace(
    /<qti-inline-choice-interaction\b([^>]*)\/>|<qti-inline-choice-interaction\b([^>]*)>\s*<\/qti-inline-choice-interaction>/gi,
    (match, selfClosingAttrs: string | undefined, pairedAttrs: string | undefined) => {
      const attrs = selfClosingAttrs ?? pairedAttrs ?? "";
      const responseIdentifier = extractResponseIdentifier(attrs);
      return responseIdentifier ? render(responseIdentifier) : match;
    },
  );
}

function extractInlineChoicePlaceholderIdentifiers(bodyHtml: string): string[] {
  const identifiers: string[] = [];
  const placeholderPattern =
    /<qti-inline-choice-interaction\b([^>]*)\/>|<qti-inline-choice-interaction\b([^>]*)>\s*<\/qti-inline-choice-interaction>/gi;
  for (const match of bodyHtml.matchAll(placeholderPattern)) {
    const attrs = match[1] ?? match[2] ?? "";
    const responseIdentifier = extractResponseIdentifier(attrs);
    if (responseIdentifier) identifiers.push(responseIdentifier);
  }
  return identifiers;
}

function extractInlineChoiceInteractionIdentifiers(bodyHtml: string): string[] {
  const identifiers: string[] = [];
  const interactionPattern = /<qti-inline-choice-interaction\b([^>]*)>/gi;
  for (const match of bodyHtml.matchAll(interactionPattern)) {
    const responseIdentifier = extractResponseIdentifier(match[1] ?? "");
    if (responseIdentifier) identifiers.push(responseIdentifier);
  }
  return identifiers;
}

function extractResponseIdentifier(attrs: string): string | undefined {
  return /\bresponse-identifier\s*=\s*(["'])(.*?)\1/i.exec(attrs)?.[2]?.trim();
}
