import { assertQtiIdentifier } from "./identifier.js";
import {
  throwIfDiagnostics,
  validateItemBase,
  validateQtiIdentifier,
  writerDiagnostic,
} from "./diagnostics.js";
import {
  interactionAttributeList,
  optionalBodySection,
  optionalBooleanAttribute,
  resolveResponseIdentifier,
} from "./interaction-shell.js";
import { trustedResponseProcessingXml } from "./response-processing.js";
import { assessmentItemShell } from "./shell.js";
import type { Qti3EndAttemptBuilderInput, Qti3WriterDiagnostic } from "./types.js";
import { xmlEscape } from "./xml.js";

export function buildQti3EndAttemptItem(input: Qti3EndAttemptBuilderInput): string {
  const diagnostics = validateQti3EndAttemptItem(input);
  throwIfDiagnostics(diagnostics);
  return renderQti3EndAttemptItem(input);
}

export function renderQti3EndAttemptItem(input: Qti3EndAttemptBuilderInput): string {
  const responseIdentifier = assertQtiIdentifier(
    resolveResponseIdentifier(input.responseIdentifier),
    "End attempt response identifier",
  );
  const escapedResponseIdentifier = xmlEscape(responseIdentifier);
  const declarationsXml = `  <qti-response-declaration identifier="${escapedResponseIdentifier}" cardinality="single" base-type="boolean"/>`;
  const interactionAttrs = interactionAttributeList({
    responseIdentifier: escapedResponseIdentifier,
    sharedVocabulary: input.sharedVocabulary,
    interactionType: "endAttempt",
    classNames: input.classNames,
    extraAttributes: [
      `title="${xmlEscape(input.buttonTitle.trim())}"`,
      optionalBooleanAttribute("count-attempt", input.countAttempt),
    ],
  });
  const promptXml = input.promptHtml?.trim() ? `    <p>${input.promptHtml}</p>\n` : "";
  const bodyXml = `${promptXml}${optionalBodySection(input.bodyHtml)}    <p><qti-end-attempt-interaction ${interactionAttrs}/></p>`;

  return assessmentItemShell({
    ...input,
    declarationsXml,
    bodyXml,
    responseProcessingXml: trustedResponseProcessingXml(undefined),
    scoreDefaultZero: true,
  });
}

export function validateQti3EndAttemptItem(
  input: Qti3EndAttemptBuilderInput,
): Qti3WriterDiagnostic[] {
  const diagnostics = validateItemBase(input);
  const responseIdentifier = resolveResponseIdentifier(input.responseIdentifier);
  const responseIdentifierDiagnostic = validateQtiIdentifier(
    "responseIdentifier",
    "End attempt response identifier",
    responseIdentifier,
  );
  if (responseIdentifierDiagnostic) diagnostics.push(responseIdentifierDiagnostic);
  if (!input.buttonTitle.trim()) {
    diagnostics.push(
      writerDiagnostic(
        "missing_end_attempt_button_title",
        "buttonTitle",
        "End attempt button title is required.",
      ),
    );
  }
  return diagnostics;
}
