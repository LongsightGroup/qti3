import { assertQtiIdentifier } from "./identifier.js";
import {
  duplicateDiagnostics,
  isNonNegativeInteger,
  throwIfDiagnostics,
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
import { responseProcessingTemplateXml } from "./response-processing.js";
import { assessmentItemShell } from "./shell.js";
import type { Qti3OrderBuilderInput, Qti3WriterDiagnostic } from "./types.js";
import { xmlEscape } from "./xml.js";

export function buildQti3OrderItem(input: Qti3OrderBuilderInput): string {
  const diagnostics = validateQti3OrderItem(input);
  throwIfDiagnostics(diagnostics);
  return renderQti3OrderItem(input);
}

export function renderQti3OrderItem(input: Qti3OrderBuilderInput): string {
  const responseIdentifier = assertQtiIdentifier(
    resolveResponseIdentifier(input.responseIdentifier),
    "Response identifier",
  );
  const escapedResponseIdentifier = xmlEscape(responseIdentifier);
  const correctValues = orderCorrectValues(input);
  const declarationsXml = `  <qti-response-declaration identifier="${escapedResponseIdentifier}" cardinality="ordered" base-type="identifier">
    <qti-correct-response>
${correctValues.map((value) => `      <qti-value>${xmlEscape(value)}</qti-value>`).join("\n")}
    </qti-correct-response>
  </qti-response-declaration>`;

  const interactionAttrs = interactionAttributeList({
    responseIdentifier: escapedResponseIdentifier,
    sharedVocabulary: input.sharedVocabulary,
    interactionType: "order",
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
      booleanAttribute("shuffle", input.shuffle ?? false),
    ],
  });
  const choicesXml = input.choices
    .map((choice) => {
      const identifier = xmlEscape(
        assertQtiIdentifier(choice.identifier, "Order choice identifier"),
      );
      const fixedAttr = choice.fixed ? ' fixed="true"' : "";
      const visibilityAttr = input.choiceVisibility === "hide" ? ' show-hide="hide"' : "";
      const body = choice.contentHtml?.trim() ? choice.contentHtml : xmlEscape(choice.text ?? "");
      return `      <qti-simple-choice identifier="${identifier}"${fixedAttr}${visibilityAttr}>${body}</qti-simple-choice>`;
    })
    .join("\n");
  const bodyXml = wrapInteractionBody(
    "qti-order-interaction",
    interactionAttrs,
    optionalPromptSection(input.promptHtml),
    choicesXml,
    optionalBodySection(input.bodyHtml),
  );

  return assessmentItemShell({
    ...input,
    declarationsXml,
    bodyXml,
    responseProcessingXml: responseProcessingTemplateXml("match_correct"),
  });
}

export function validateQti3OrderItem(input: Qti3OrderBuilderInput): Qti3WriterDiagnostic[] {
  const diagnostics = validateItemBase(input);
  const responseIdentifier = resolveResponseIdentifier(input.responseIdentifier);
  const responseIdentifierDiagnostic = validateQtiIdentifier(
    "responseIdentifier",
    "Response identifier",
    responseIdentifier,
  );
  if (responseIdentifierDiagnostic) diagnostics.push(responseIdentifierDiagnostic);
  if (input.choices.length < 2) {
    diagnostics.push(
      writerDiagnostic(
        "missing_order_choices",
        "choices",
        "Order items must include at least two choices.",
      ),
    );
  }
  diagnostics.push(
    ...duplicateDiagnostics(
      input.choices.map((choice) => choice.identifier),
      "choices",
      "Order choice identifier",
    ),
  );
  for (const [index, choice] of input.choices.entries()) {
    const identifierDiagnostic = validateQtiIdentifier(
      `choices.${index}.identifier`,
      "Order choice identifier",
      choice.identifier,
    );
    if (identifierDiagnostic) diagnostics.push(identifierDiagnostic);
    if (!choice.contentHtml?.trim() && !(choice.text ?? "").trim()) {
      diagnostics.push(
        writerDiagnostic(
          "empty_order_choice",
          `choices.${index}`,
          `Order choice "${choice.identifier}" must include text or contentHtml.`,
          choice.identifier,
        ),
      );
    }
  }

  if (input.minChoices !== undefined && !isNonNegativeInteger(input.minChoices)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_order_min_choices",
        "minChoices",
        "Order minChoices must be a non-negative integer.",
        input.minChoices,
      ),
    );
  }
  if (input.maxChoices !== undefined && !isNonNegativeInteger(input.maxChoices)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_order_max_choices",
        "maxChoices",
        "Order maxChoices must be a non-negative integer.",
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
        "invalid_order_bounds",
        "minChoices",
        "Order minChoices must be less than or equal to maxChoices.",
        { minChoices: input.minChoices, maxChoices: input.maxChoices },
      ),
    );
  }

  const correctOrder = orderCorrectValues(input);
  diagnostics.push(
    ...duplicateDiagnostics(correctOrder, "correctOrder", "Order correct response identifier"),
  );
  const choiceIdentifiers = new Set(input.choices.map((choice) => choice.identifier.trim()));
  const correctOrderIsExplicit = Boolean(input.correctOrder?.length);
  if (
    correctOrderIsExplicit &&
    !allowsSubsetOrdering(input) &&
    !sameIdentifierSet(correctOrder, choiceIdentifiers)
  ) {
    diagnostics.push(
      writerDiagnostic(
        "incomplete_order_correct_order",
        "correctOrder",
        "Order correctOrder must include every choice unless minChoices or maxChoices configures subset ordering.",
        correctOrder,
      ),
    );
  }
  for (const [index, identifier] of correctOrder.entries()) {
    const identifierDiagnostic = validateQtiIdentifier(
      `correctOrder.${index}`,
      "Order correct response identifier",
      identifier,
    );
    if (identifierDiagnostic) {
      diagnostics.push(identifierDiagnostic);
      continue;
    }
    if (!choiceIdentifiers.has(identifier.trim())) {
      diagnostics.push(
        writerDiagnostic(
          "unknown_order_reference",
          `correctOrder.${index}`,
          `Order correct response references unknown choice "${identifier}".`,
          identifier,
        ),
      );
    }
  }
  return diagnostics;
}

function orderCorrectValues(input: Qti3OrderBuilderInput): readonly string[] {
  return input.correctOrder?.length
    ? input.correctOrder
    : input.choices.map((choice) => choice.identifier);
}

function allowsSubsetOrdering(input: Qti3OrderBuilderInput): boolean {
  if (input.minChoices !== undefined && input.minChoices < input.choices.length) return true;
  if (
    input.maxChoices !== undefined &&
    input.maxChoices > 0 &&
    input.maxChoices < input.choices.length
  ) {
    return true;
  }
  return false;
}

function sameIdentifierSet(values: readonly string[], expected: ReadonlySet<string>): boolean {
  const valueSet = new Set(values.map((value) => value.trim()).filter(Boolean));
  if (valueSet.size !== expected.size) return false;
  for (const identifier of expected) {
    if (!valueSet.has(identifier)) return false;
  }
  return true;
}
