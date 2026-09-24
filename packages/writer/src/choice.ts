import { parseQtiXml } from "@longsightgroup/qti3-core";
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
import {
  choiceFeedbackProcessingXml,
  responseProcessingTemplateXml,
} from "./response-processing.js";
import { assessmentItemShell } from "./shell.js";
import type { Qti3ChoiceBuilderInput, Qti3WriterDiagnostic } from "./types.js";
import { escapeXmlAttribute, escapeXmlText } from "./xml.js";

export function buildQti3ChoiceItem(input: Qti3ChoiceBuilderInput): string {
  const diagnostics = validateQti3ChoiceItem(input);
  throwIfDiagnostics(diagnostics);
  return renderQti3ChoiceItem(input);
}

export function renderQti3ChoiceItem(input: Qti3ChoiceBuilderInput): string {
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

  const interactionAttrs = interactionAttributeList({
    responseIdentifier: escapedResponseIdentifier,
    sharedVocabulary: input.sharedVocabulary,
    interactionType: "choice",
    classNames: input.classNames,
    extraAttributes: [
      booleanAttribute("shuffle", input.shuffle ?? false),
      input.minChoices !== undefined ? `min-choices="${String(input.minChoices)}"` : "",
      input.maxChoices !== undefined
        ? `max-choices="${String(input.maxChoices)}"`
        : input.responseCardinality === "multiple"
          ? 'max-choices="0"'
          : "",
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

  const feedback = input.feedback;
  const feedbackOutcomeIdentifier =
    feedback === undefined
      ? undefined
      : assertQtiIdentifier(
          feedback.outcomeIdentifier ?? "FEEDBACK",
          "Feedback outcome identifier",
        );
  const escapedFeedbackOutcomeIdentifier =
    feedbackOutcomeIdentifier === undefined
      ? undefined
      : escapeXmlAttribute(feedbackOutcomeIdentifier);
  const outcomeDeclarationsXml =
    escapedFeedbackOutcomeIdentifier === undefined
      ? undefined
      : `  <qti-outcome-declaration identifier="${escapedFeedbackOutcomeIdentifier}" cardinality="${input.responseCardinality}" base-type="identifier"/>`;
  const modalFeedbackXml =
    feedback === undefined || escapedFeedbackOutcomeIdentifier === undefined
      ? undefined
      : feedback.entries
          .map((entry) => {
            const identifier = escapeXmlAttribute(
              assertQtiIdentifier(entry.identifier, "Modal feedback identifier"),
            );
            const content = entry.contentHtml?.trim()
              ? entry.contentHtml
              : escapeXmlText(entry.text ?? "");
            return `  <qti-modal-feedback outcome-identifier="${escapedFeedbackOutcomeIdentifier}" identifier="${identifier}" show-hide="show">${content}</qti-modal-feedback>`;
          })
          .join("\n");

  return assessmentItemShell({
    ...input,
    declarationsXml,
    bodyXml,
    outcomeDeclarationsXml,
    modalFeedbackXml,
    responseProcessingXml:
      feedback === undefined || feedbackOutcomeIdentifier === undefined
        ? responseProcessingTemplateXml(scoring)
        : choiceFeedbackProcessingXml(
            responseIdentifier,
            input.responseCardinality,
            scoring,
            feedbackOutcomeIdentifier,
            feedback.entries,
          ),
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

export function validateQti3ChoiceItem(input: Qti3ChoiceBuilderInput): Qti3WriterDiagnostic[] {
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
  if (input.feedback !== undefined) {
    if (input.modalFeedback !== undefined) {
      diagnostics.push(
        writerDiagnostic(
          "conflicting_feedback_models",
          "modalFeedback",
          "Use either choice feedback or item-level modalFeedback on one item.",
        ),
      );
    }
    const feedback = input.feedback;
    const outcomeIdentifier = feedback.outcomeIdentifier ?? "FEEDBACK";
    if (feedback.entries.length === 0) {
      diagnostics.push(
        writerDiagnostic(
          "missing_feedback_entries",
          "feedback.entries",
          "Modal feedback requires at least one entry.",
        ),
      );
    }
    const outcomeIdentifierDiagnostic = validateQtiIdentifier(
      "feedback.outcomeIdentifier",
      "Feedback outcome identifier",
      outcomeIdentifier,
    );
    if (outcomeIdentifierDiagnostic) diagnostics.push(outcomeIdentifierDiagnostic);
    const reservedOutcomeIdentifiers = new Set([
      "SCORE",
      responseIdentifier.trim(),
      "completionStatus",
      "numAttempts",
      "duration",
      "QTI_CONTEXT",
    ]);
    if (reservedOutcomeIdentifiers.has(outcomeIdentifier.trim())) {
      diagnostics.push(
        writerDiagnostic(
          "invalid_feedback_outcome",
          "feedback.outcomeIdentifier",
          "Feedback outcome identifier conflicts with an existing or built-in variable.",
          outcomeIdentifier,
        ),
      );
    }
    diagnostics.push(
      ...duplicateDiagnostics(
        feedback.entries.map((entry) => entry.choiceIdentifier),
        "feedback.entries.choiceIdentifier",
        "Feedback choice identifier",
      ),
      ...duplicateDiagnostics(
        feedback.entries.map((entry) => entry.identifier),
        "feedback.entries.identifier",
        "Modal feedback identifier",
      ),
    );
    for (const [index, entry] of feedback.entries.entries()) {
      const choiceIdentifierDiagnostic = validateQtiIdentifier(
        `feedback.entries.${index}.choiceIdentifier`,
        "Feedback choice identifier",
        entry.choiceIdentifier,
      );
      if (choiceIdentifierDiagnostic) diagnostics.push(choiceIdentifierDiagnostic);
      else if (!choiceIdentifiers.has(entry.choiceIdentifier.trim())) {
        diagnostics.push(
          writerDiagnostic(
            "unknown_choice_reference",
            `feedback.entries.${index}.choiceIdentifier`,
            `Modal feedback references unknown choice "${entry.choiceIdentifier}".`,
            entry.choiceIdentifier,
          ),
        );
      }
      const feedbackIdentifierDiagnostic = validateQtiIdentifier(
        `feedback.entries.${index}.identifier`,
        "Modal feedback identifier",
        entry.identifier,
      );
      if (feedbackIdentifierDiagnostic) diagnostics.push(feedbackIdentifierDiagnostic);
      const hasText = Boolean(entry.text?.trim());
      const hasContentHtml = Boolean(entry.contentHtml?.trim());
      if (
        hasText === hasContentHtml ||
        (hasContentHtml && !hasText && !hasVisibleFeedbackText(entry.contentHtml))
      ) {
        diagnostics.push(
          writerDiagnostic(
            "invalid_feedback_content",
            `feedback.entries.${index}`,
            "Modal feedback requires exactly one content source with visible text; contentHtml must be valid XML.",
          ),
        );
      }
    }
  }
  return diagnostics;
}

function hasVisibleFeedbackText(contentHtml: string | undefined): boolean {
  if (contentHtml === undefined) return false;
  const parsed =
    parseQtiXml(`<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="feedback-probe" title="Feedback" time-dependent="false">
    <qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier"/>
    <qti-item-body/>
    <qti-modal-feedback outcome-identifier="FEEDBACK" identifier="PROBE" show-hide="show">${contentHtml}</qti-modal-feedback>
  </qti-assessment-item>`);
  return parsed.ok && Boolean(parsed.document?.item.modalFeedback[0]?.text.trim());
}
