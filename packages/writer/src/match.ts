import { assertQtiIdentifier } from "./identifier.js";
import {
  duplicateDiagnostics,
  throwIfDiagnostics,
  validateItemBase,
  validateQtiIdentifier,
  writerDiagnostic,
} from "./diagnostics.js";
import { associableChoiceXml, validateAssociableChoice } from "./associable-choice.js";
import {
  interactionAttributeList,
  optionalBodySection,
  optionalPromptSection,
  optionalBooleanAttribute,
  resolveResponseIdentifier,
  wrapInteractionBody,
} from "./interaction-shell.js";
import { responseProcessingTemplateXml } from "./response-processing.js";
import { assessmentItemShell } from "./shell.js";
import type { Qti3MatchBuilderInput, Qti3WriterDiagnostic } from "./types.js";
import {
  pairResponseDeclarationXml,
  validatePairMatchMax,
  validatePairReferences,
} from "./pair-declaration.js";
import { escapeXmlAttribute } from "./xml.js";

export function buildQti3MatchItem(input: Qti3MatchBuilderInput): string {
  const diagnostics = validateQti3MatchItem(input);
  throwIfDiagnostics(diagnostics);
  return renderQti3MatchItem(input);
}

export function renderQti3MatchItem(input: Qti3MatchBuilderInput): string {
  const responseIdentifier = assertQtiIdentifier(
    resolveResponseIdentifier(input.responseIdentifier),
    "Response identifier",
  );
  const escapedResponseIdentifier = escapeXmlAttribute(responseIdentifier);
  const declarationsXml = pairResponseDeclarationXml({
    responseIdentifier: escapedResponseIdentifier,
    baseType: "directedPair",
    pairs: input.correctResponse,
  });
  const interactionAttrs = interactionAttributeList({
    responseIdentifier: escapedResponseIdentifier,
    sharedVocabulary: input.sharedVocabulary,
    interactionType: "match",
    classNames: input.classNames,
    extraAttributes: [
      input.minAssociations !== undefined
        ? `min-associations="${String(input.minAssociations)}"`
        : "",
      input.maxAssociations !== undefined
        ? `max-associations="${String(input.maxAssociations)}"`
        : "",
      optionalBooleanAttribute("shuffle", input.shuffle),
    ],
  });
  const bodyXml = wrapInteractionBody(
    "qti-match-interaction",
    interactionAttrs,
    optionalPromptSection(input.promptHtml),
    `      <qti-simple-match-set>
${input.sources
  .map((choice) =>
    associableChoiceXml(choice, {
      identifierLabel: "Match choice identifier",
      indent: "      ",
    }),
  )
  .join("\n")}
      </qti-simple-match-set>
      <qti-simple-match-set>
${input.targets
  .map((choice) =>
    associableChoiceXml(choice, {
      identifierLabel: "Match choice identifier",
      indent: "      ",
    }),
  )
  .join("\n")}
      </qti-simple-match-set>`,
    optionalBodySection(input.bodyHtml),
  );
  return assessmentItemShell({
    ...input,
    declarationsXml,
    bodyXml,
    responseProcessingXml: responseProcessingTemplateXml("match_correct"),
  });
}

export function validateQti3MatchItem(input: Qti3MatchBuilderInput): Qti3WriterDiagnostic[] {
  const diagnostics = validateItemBase(input);
  const responseIdentifier = resolveResponseIdentifier(input.responseIdentifier);
  const responseIdentifierDiagnostic = validateQtiIdentifier(
    "responseIdentifier",
    "Response identifier",
    responseIdentifier,
  );
  if (responseIdentifierDiagnostic) diagnostics.push(responseIdentifierDiagnostic);
  if (!input.sources.length) {
    diagnostics.push(
      writerDiagnostic(
        "missing_match_sources",
        "sources",
        "Match items must include at least one source.",
      ),
    );
  }
  if (!input.targets.length) {
    diagnostics.push(
      writerDiagnostic(
        "missing_match_targets",
        "targets",
        "Match items must include at least one target.",
      ),
    );
  }

  const identifiers = [
    ...input.sources.map((choice) => choice.identifier),
    ...input.targets.map((choice) => choice.identifier),
  ];
  diagnostics.push(
    ...duplicateDiagnostics(identifiers, "sources|targets", "Match choice identifier"),
  );

  for (const [index, choice] of input.sources.entries()) {
    validateAssociableChoice(choice, `sources.${index}`, diagnostics, {
      identifierLabel: "Match choice identifier",
      emptyCode: "empty_match_choice",
      matchMaxCode: "invalid_match_max",
      requireContent: false,
    });
  }
  for (const [index, choice] of input.targets.entries()) {
    validateAssociableChoice(choice, `targets.${index}`, diagnostics, {
      identifierLabel: "Match choice identifier",
      emptyCode: "empty_match_choice",
      matchMaxCode: "invalid_match_max",
      requireContent: false,
    });
  }

  const sourceIdentifiers = new Set(input.sources.map((choice) => choice.identifier.trim()));
  const targetIdentifiers = new Set(input.targets.map((choice) => choice.identifier.trim()));
  validatePairReferences({
    pairs: input.correctResponse,
    sourceIdentifiers,
    targetIdentifiers,
    diagnostics,
    path: "correctResponse",
    sourceLabel: "Match pair source identifier",
    targetLabel: "Match pair target identifier",
    unknownSourceCode: "unknown_match_source_reference",
    unknownTargetCode: "unknown_match_target_reference",
    unknownSourceMessage: (identifier) =>
      `Match correct response references unknown source "${identifier}".`,
    unknownTargetMessage: (identifier) =>
      `Match correct response references unknown target "${identifier}".`,
  });
  validatePairMatchMax({
    pairs: input.correctResponse,
    matchMaxByIdentifier: new Map(
      [...input.sources, ...input.targets].map((choice) => [
        choice.identifier.trim(),
        choice.matchMax,
      ]),
    ),
    diagnostics,
    path: "correctResponse",
    code: "match_match_max_exceeded",
    label: "Match choice",
  });
  return diagnostics;
}
