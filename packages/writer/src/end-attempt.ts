import { assertQtiIdentifier } from "./identifier.js";
import { validateItemBase, validateQtiIdentifier, writerDiagnostic } from "./diagnostics.js";
import {
  interactionAttributeList,
  optionalBodySection,
  optionalBooleanAttribute,
  resolveResponseIdentifier,
} from "./interaction-shell.js";
import { trustedResponseProcessingXml } from "./response-processing.js";
import {
  itemSections,
  buildPreparedItem,
  validatePreparedItem,
  type RenderedItemSections,
} from "./item-preparation.js";
import type { Qti3EndAttemptBuilderInput, Qti3WriterDiagnostic } from "./types.js";
import { escapeXmlAttribute } from "./xml.js";

export function buildQti3EndAttemptItem(input: Qti3EndAttemptBuilderInput): string {
  return buildPreparedItem(
    { ...input, interactionType: "endAttempt" },
    validateQti3EndAttemptItemStructure,
    renderQti3EndAttemptItem,
  );
}

export function validateQti3EndAttemptItem(
  input: Qti3EndAttemptBuilderInput,
): Qti3WriterDiagnostic[] {
  return validatePreparedItem(
    { ...input, interactionType: "endAttempt" },
    validateQti3EndAttemptItemStructure,
  );
}

export function renderQti3EndAttemptItem(input: Qti3EndAttemptBuilderInput): RenderedItemSections {
  const responseIdentifier = assertQtiIdentifier(
    resolveResponseIdentifier(input.responseIdentifier),
    "End attempt response identifier",
  );
  const escapedResponseIdentifier = escapeXmlAttribute(responseIdentifier);
  const declarationsXml = `  <qti-response-declaration identifier="${escapedResponseIdentifier}" cardinality="single" base-type="boolean"/>`;
  const interactionAttrs = interactionAttributeList({
    responseIdentifier: escapedResponseIdentifier,
    sharedVocabulary: input.sharedVocabulary,
    interactionType: "endAttempt",
    classNames: input.classNames,
    extraAttributes: [
      `title="${escapeXmlAttribute(input.buttonTitle.trim())}"`,
      optionalBooleanAttribute("count-attempt", input.countAttempt),
    ],
  });
  const promptXml = input.promptHtml?.trim() ? `    <p>${input.promptHtml}</p>\n` : "";
  const bodyXml = `${promptXml}${optionalBodySection(input.bodyHtml)}    <p><qti-end-attempt-interaction ${interactionAttrs}/></p>`;

  return itemSections(input, {
    declarationsXml,
    bodyXml,
    responseProcessingXml: trustedResponseProcessingXml(undefined),
    scoreDefaultZero: true,
  });
}

export function validateQti3EndAttemptItemStructure(
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
