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
  interactionAttributeList,
  optionalBodySection,
  optionalPromptSection,
  optionalBooleanAttribute,
  resolveResponseIdentifier,
  wrapInteractionBody,
} from "./interaction-shell.js";
import { responseProcessingTemplateXml } from "./response-processing.js";
import { assessmentItemShell } from "./shell.js";
import type { Qti3MatchBuilderInput, Qti3MatchChoice, Qti3WriterDiagnostic } from "./types.js";
import { xmlEscape } from "./xml.js";

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
  const escapedResponseIdentifier = xmlEscape(responseIdentifier);
  const correct = input.correctResponse
    .map(
      (pair) =>
        `      <qti-value>${xmlEscape(pair.sourceIdentifier)} ${xmlEscape(pair.targetIdentifier)}</qti-value>`,
    )
    .join("\n");
  const declarationsXml = `  <qti-response-declaration identifier="${escapedResponseIdentifier}" cardinality="multiple" base-type="directedPair">
    <qti-correct-response>
${correct}
    </qti-correct-response>
  </qti-response-declaration>`;
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
  .map(choiceXml)
  .map((xml) => `      ${xml}`)
  .join("\n")}
      </qti-simple-match-set>
      <qti-simple-match-set>
${input.targets
  .map(choiceXml)
  .map((xml) => `      ${xml}`)
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

function choiceXml(choice: Qti3MatchChoice): string {
  const identifier = xmlEscape(assertQtiIdentifier(choice.identifier, "Match choice identifier"));
  const body = choice.contentHtml?.trim() ? choice.contentHtml : xmlEscape(choice.text ?? "");
  return `<qti-simple-associable-choice identifier="${identifier}" match-max="${String(
    choice.matchMax ?? 1,
  )}">${body}</qti-simple-associable-choice>`;
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
    validateMatchChoice(choice, `sources.${index}`, diagnostics);
  }
  for (const [index, choice] of input.targets.entries()) {
    validateMatchChoice(choice, `targets.${index}`, diagnostics);
  }

  const sourceIdentifiers = new Set(input.sources.map((choice) => choice.identifier.trim()));
  const targetIdentifiers = new Set(input.targets.map((choice) => choice.identifier.trim()));
  for (const [index, pair] of input.correctResponse.entries()) {
    if (!sourceIdentifiers.has(pair.sourceIdentifier.trim())) {
      diagnostics.push(
        writerDiagnostic(
          "unknown_match_source_reference",
          `correctResponse.${index}.sourceIdentifier`,
          `Match correct response references unknown source "${pair.sourceIdentifier}".`,
          pair.sourceIdentifier,
        ),
      );
    }
    if (!targetIdentifiers.has(pair.targetIdentifier.trim())) {
      diagnostics.push(
        writerDiagnostic(
          "unknown_match_target_reference",
          `correctResponse.${index}.targetIdentifier`,
          `Match correct response references unknown target "${pair.targetIdentifier}".`,
          pair.targetIdentifier,
        ),
      );
    }
  }
  return diagnostics;
}

function validateMatchChoice(
  choice: Qti3MatchChoice,
  path: string,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  const identifierDiagnostic = validateQtiIdentifier(
    `${path}.identifier`,
    "Match choice identifier",
    choice.identifier,
  );
  if (identifierDiagnostic) diagnostics.push(identifierDiagnostic);
  if (choice.matchMax !== undefined && !isNonNegativeInteger(choice.matchMax)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_match_max",
        `${path}.matchMax`,
        "Match choice matchMax must be a non-negative integer.",
        choice.matchMax,
      ),
    );
  }
}
