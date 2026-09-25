import { prepareChoiceFeedback } from "./choice-feedback.js";
import { assertQtiIdentifier } from "./identifier.js";
import {
  duplicateDiagnostics,
  isNonNegativeInteger,
  validateItemBase,
  validateQtiIdentifier,
  writerDiagnostic,
} from "./diagnostics.js";
import {
  booleanAttribute,
  interactionAttributeList,
  optionalBodySection,
  optionalPromptSection,
  resolveResponseIdentifier,
  wrapInteractionBody,
} from "./interaction-shell.js";
import { choiceResponseProcessingXml } from "./response-processing.js";
import {
  itemSections,
  buildPreparedItem,
  validatePreparedItem,
  type RenderedItemSections,
} from "./item-preparation.js";
import type { Qti3ChoiceBuilderInput, Qti3WriterDiagnostic } from "./types.js";
import { escapeXmlAttribute, escapeXmlText } from "./xml.js";

export function buildQti3ChoiceItem(input: Qti3ChoiceBuilderInput): string {
  return buildPreparedItem(
    { ...input, interactionType: "choice" },
    validateQti3ChoiceItemStructure,
    renderQti3ChoiceItem,
    prepareChoiceFeedback(input),
  );
}

export function validateQti3ChoiceItem(input: Qti3ChoiceBuilderInput): Qti3WriterDiagnostic[] {
  return validatePreparedItem(
    { ...input, interactionType: "choice" },
    validateQti3ChoiceItemStructure,
    prepareChoiceFeedback(input),
  );
}

export function renderQti3ChoiceItem(input: Qti3ChoiceBuilderInput): RenderedItemSections {
  const responseIdentifier = assertQtiIdentifier(
    resolveResponseIdentifier(input.responseIdentifier),
    "Response identifier",
  );
  const escapedResponseIdentifier = escapeXmlAttribute(responseIdentifier);
  const scoring = input.scoring ?? "match_correct";
  const correctValues = input.correctResponse.map((value) =>
    assertQtiIdentifier(value, "Choice correct response identifier"),
  );
  const choices = input.choices.map((choice) => ({
    choice,
    identifier: assertQtiIdentifier(choice.identifier, "Choice identifier"),
  }));
  const declarationsXml = `  <qti-response-declaration identifier="${escapedResponseIdentifier}" cardinality="${input.responseCardinality}" base-type="identifier">
    <qti-correct-response>
${correctValues.map((value) => `      <qti-value>${escapeXmlText(value)}</qti-value>`).join("\n")}
    </qti-correct-response>
${choiceMappingXml(choices, scoring, correctValues)}  </qti-response-declaration>`;

  const maxChoices = choiceSelectionLimit(input.responseCardinality, input.maxChoices);
  const interactionAttrs = interactionAttributeList({
    responseIdentifier: escapedResponseIdentifier,
    sharedVocabulary: input.sharedVocabulary,
    interactionType: "choice",
    classNames: input.classNames,
    extraAttributes: [
      booleanAttribute("shuffle", input.shuffle ?? false),
      input.minChoices !== undefined ? `min-choices="${String(input.minChoices)}"` : "",
      maxChoices === undefined ? "" : `max-choices="${String(maxChoices)}"`,
    ],
  });
  const choicesXml = choices
    .map(({ choice, identifier }) => {
      const escapedIdentifier = escapeXmlAttribute(identifier);
      const fixedAttr = choice.fixed ? ' fixed="true"' : "";
      const visibilityAttr = input.choiceVisibility === "hide" ? ' show-hide="hide"' : "";
      const body = choice.contentHtml?.trim()
        ? choice.contentHtml
        : escapeXmlText(choice.text ?? "");
      return `      <qti-simple-choice identifier="${escapedIdentifier}"${fixedAttr}${visibilityAttr}>${body}</qti-simple-choice>`;
    })
    .join("\n");
  const bodyXml = wrapInteractionBody(
    "qti-choice-interaction",
    interactionAttrs,
    optionalPromptSection(input.promptHtml),
    choicesXml,
    optionalBodySection(input.bodyHtml),
  );

  return itemSections(input, {
    declarationsXml,
    bodyXml,
    responseProcessingXml: choiceResponseProcessingXml(responseIdentifier, scoring),
  });
}

function choiceMappingXml(
  choices: readonly {
    readonly identifier: string;
  }[],
  scoring: "match_correct" | "map_response",
  correctValues: readonly string[],
): string {
  if (scoring !== "map_response") return "";
  const correctSet = new Set(correctValues);
  return `
  <qti-mapping default-value="0">
${choices
  .map(
    (choice) =>
      `    <qti-map-entry map-key="${escapeXmlAttribute(choice.identifier)}" mapped-value="${
        correctSet.has(choice.identifier) ? "1" : "0"
      }"/>`,
  )
  .join("\n")}
  </qti-mapping>
`;
}

export function validateQti3ChoiceItemStructure(
  input: Qti3ChoiceBuilderInput,
): Qti3WriterDiagnostic[] {
  const diagnostics = validateItemBase(input);
  const responseIdentifier = resolveResponseIdentifier(input.responseIdentifier);
  const responseIdentifierDiagnostic = validateQtiIdentifier(
    "responseIdentifier",
    "Response identifier",
    responseIdentifier,
  );
  if (responseIdentifierDiagnostic) diagnostics.push(responseIdentifierDiagnostic);
  if (!input.choices.length) {
    diagnostics.push(
      writerDiagnostic(
        "missing_choices",
        "choices",
        "Choice items must include at least one choice.",
      ),
    );
  }
  diagnostics.push(
    ...duplicateDiagnostics(
      input.choices.map((choice) => choice.identifier),
      "choices",
      "Choice identifier",
    ),
  );
  for (const [index, choice] of input.choices.entries()) {
    const identifierDiagnostic = validateQtiIdentifier(
      `choices.${index}.identifier`,
      "Choice identifier",
      choice.identifier,
    );
    if (identifierDiagnostic) diagnostics.push(identifierDiagnostic);
  }

  if (input.minChoices !== undefined && !isNonNegativeInteger(input.minChoices)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_choice_min_choices",
        "minChoices",
        "Choice minChoices must be a non-negative integer.",
        input.minChoices,
      ),
    );
  }
  if (input.maxChoices !== undefined && !isNonNegativeInteger(input.maxChoices)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_choice_max_choices",
        "maxChoices",
        "Choice maxChoices must be a non-negative integer.",
        input.maxChoices,
      ),
    );
  }
  if (
    input.minChoices !== undefined &&
    input.maxChoices !== undefined &&
    input.maxChoices > 0 &&
    input.minChoices > input.maxChoices
  ) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_choice_bounds",
        "minChoices",
        "Choice minChoices must be less than or equal to maxChoices.",
        { minChoices: input.minChoices, maxChoices: input.maxChoices },
      ),
    );
  }

  if (input.correctResponse.length === 0) {
    diagnostics.push(
      writerDiagnostic(
        "missing_correct_response",
        "correctResponse",
        "Choice items must include at least one correct response identifier.",
      ),
    );
  }
  if (input.responseCardinality === "single" && input.correctResponse.length !== 1) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_correct_response_count",
        "correctResponse",
        "Single-response choice items must include exactly one correct response identifier.",
        input.correctResponse,
      ),
    );
  }

  diagnostics.push(
    ...duplicateDiagnostics(
      input.correctResponse,
      "correctResponse",
      "Choice correct response identifier",
    ),
  );

  const choiceIdentifiers = new Set(input.choices.map((choice) => choice.identifier.trim()));
  for (const [index, identifier] of input.correctResponse.entries()) {
    const identifierDiagnostic = validateQtiIdentifier(
      `correctResponse.${index}`,
      "Choice correct response identifier",
      identifier,
    );
    if (identifierDiagnostic) {
      diagnostics.push(identifierDiagnostic);
      continue;
    }
    if (!choiceIdentifiers.has(identifier.trim())) {
      diagnostics.push(
        writerDiagnostic(
          "unknown_choice_reference",
          `correctResponse.${index}`,
          `Choice correct response references unknown choice "${identifier}".`,
          identifier,
        ),
      );
    }
  }
  return diagnostics;
}

/** QTI defaults to one selection; multiple responses default to unlimited unless explicitly capped. */
function choiceSelectionLimit(
  cardinality: "single" | "multiple",
  maximum: number | undefined,
): number | undefined {
  return maximum ?? (cardinality === "multiple" ? 0 : undefined);
}
