import {
  duplicateDiagnostics,
  isNonNegativeInteger,
  throwIfDiagnostics,
  validateItemBase,
  validateQtiIdentifier,
  writerDiagnostic,
} from "./diagnostics.js";
import { associableChoiceXml, validateAssociableChoice } from "./associable-choice.js";
import { assertQtiIdentifier } from "./identifier.js";
import {
  interactionAttributeList,
  optionalBodySection,
  optionalBooleanAttribute,
  optionalPromptSection,
  resolveResponseIdentifier,
  wrapInteractionBody,
} from "./interaction-shell.js";
import { responseProcessingTemplateXml } from "./response-processing.js";
import { assessmentItemShell } from "./shell.js";
import type { Qti3AssociateBuilderInput, Qti3WriterDiagnostic } from "./types.js";
import {
  pairResponseDeclarationXml,
  validatePairMatchMax,
  validatePairReferences,
} from "./pair-declaration.js";
import { escapeXmlAttribute } from "./xml.js";

export function buildQti3AssociateItem(input: Qti3AssociateBuilderInput): string {
  const diagnostics = validateQti3AssociateItem(input);
  throwIfDiagnostics(diagnostics);
  return renderQti3AssociateItem(input);
}

export function renderQti3AssociateItem(input: Qti3AssociateBuilderInput): string {
  const responseIdentifier = assertQtiIdentifier(
    resolveResponseIdentifier(input.responseIdentifier),
    "Response identifier",
  );
  const escapedResponseIdentifier = escapeXmlAttribute(responseIdentifier);
  const scoring = input.scoring ?? "match_correct";
  const declarationsXml = pairResponseDeclarationXml({
    responseIdentifier: escapedResponseIdentifier,
    baseType: "pair",
    pairs: input.correctResponse,
    scoring,
  });
  const interactionAttrs = interactionAttributeList({
    responseIdentifier: escapedResponseIdentifier,
    sharedVocabulary: input.sharedVocabulary,
    interactionType: "associate",
    classNames: input.classNames,
    extraAttributes: [
      optionalBooleanAttribute("shuffle", input.shuffle),
      input.minAssociations !== undefined
        ? `min-associations="${String(input.minAssociations)}"`
        : "",
      input.maxAssociations !== undefined
        ? `max-associations="${String(input.maxAssociations)}"`
        : "",
    ],
  });
  const choicesXml = input.choices
    .map((choice) =>
      associableChoiceXml(choice, {
        identifierLabel: "Associate choice identifier",
        indent: "      ",
      }),
    )
    .join("\n");
  const bodyXml = wrapInteractionBody(
    "qti-associate-interaction",
    interactionAttrs,
    optionalPromptSection(input.promptHtml),
    choicesXml,
    optionalBodySection(input.bodyHtml),
  );

  return assessmentItemShell({
    ...input,
    declarationsXml,
    bodyXml,
    responseProcessingXml: responseProcessingTemplateXml(scoring),
  });
}

export function validateQti3AssociateItem(
  input: Qti3AssociateBuilderInput,
): Qti3WriterDiagnostic[] {
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
        "missing_associate_choices",
        "choices",
        "Associate items must include at least two choices.",
      ),
    );
  }
  diagnostics.push(
    ...duplicateDiagnostics(
      input.choices.map((choice) => choice.identifier),
      "choices",
      "Associate choice identifier",
    ),
  );
  for (const [index, choice] of input.choices.entries()) {
    validateAssociableChoice(choice, `choices.${index}`, diagnostics, {
      identifierLabel: "Associate choice identifier",
      emptyCode: "empty_associate_choice",
      matchMaxCode: "invalid_associate_match_max",
      requireContent: true,
    });
  }

  if (input.minAssociations !== undefined && !isNonNegativeInteger(input.minAssociations)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_associate_min_associations",
        "minAssociations",
        "Associate minAssociations must be a non-negative integer.",
        input.minAssociations,
      ),
    );
  }
  if (input.maxAssociations !== undefined && !isNonNegativeInteger(input.maxAssociations)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_associate_max_associations",
        "maxAssociations",
        "Associate maxAssociations must be a non-negative integer.",
        input.maxAssociations,
      ),
    );
  }
  if (
    input.minAssociations !== undefined &&
    input.maxAssociations !== undefined &&
    input.maxAssociations > 0 &&
    input.minAssociations > input.maxAssociations
  ) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_associate_bounds",
        "minAssociations",
        "Associate minAssociations must be less than or equal to maxAssociations.",
        { minAssociations: input.minAssociations, maxAssociations: input.maxAssociations },
      ),
    );
  }

  if (!input.correctResponse.length) {
    diagnostics.push(
      writerDiagnostic(
        "missing_associate_correct_response",
        "correctResponse",
        "Associate items must include at least one correct pair.",
      ),
    );
  }
  const choiceIdentifiers = new Set(input.choices.map((choice) => choice.identifier.trim()));
  validatePairReferences({
    pairs: input.correctResponse,
    sourceIdentifiers: choiceIdentifiers,
    targetIdentifiers: choiceIdentifiers,
    diagnostics,
    path: "correctResponse",
    sourceLabel: "Associate pair source identifier",
    targetLabel: "Associate pair target identifier",
    unknownSourceCode: "unknown_associate_reference",
    unknownTargetCode: "unknown_associate_reference",
    unknownSourceMessage: (identifier) =>
      `Associate correct response references unknown choice "${identifier}".`,
    unknownTargetMessage: (identifier) =>
      `Associate correct response references unknown choice "${identifier}".`,
    disallowSelfPair: true,
    selfPairCode: "invalid_associate_self_pair",
    selfPairMessage: () => "Associate correct pairs must reference two different choices.",
    duplicateLabel: "Associate correct pair",
    duplicateUnordered: true,
  });
  validatePairMatchMax({
    pairs: input.correctResponse,
    matchMaxByIdentifier: new Map(
      input.choices.map((choice) => [choice.identifier.trim(), choice.matchMax]),
    ),
    diagnostics,
    path: "correctResponse",
    code: "associate_match_max_exceeded",
    label: "Associate choice",
  });
  return diagnostics;
}
