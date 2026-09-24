import { assertQtiIdentifier } from "./identifier.js";
import { validateItemBase, validateQtiIdentifier } from "./diagnostics.js";
import {
  optionalLongDescriptionBlock,
  renderGraphicObjectAttributes,
  validateGraphicObject,
} from "./graphic-object.js";
import {
  interactionAttributeList,
  optionalBodySection,
  optionalPromptSection,
  resolveResponseIdentifier,
} from "./interaction-shell.js";
import { trustedResponseProcessingXml } from "./response-processing.js";
import {
  buildPreparedItem,
  validatePreparedItem,
  composeAssessmentItem,
} from "./item-preparation.js";
import type { PreparedFeedback } from "./modal-feedback.js";
import type { Qti3DrawingBuilderInput, Qti3WriterDiagnostic } from "./types.js";
import { xmlAttributeList, escapeXmlAttribute } from "./xml.js";

export function buildQti3DrawingItem(input: Qti3DrawingBuilderInput): string {
  return buildPreparedItem(
    { ...input, interactionType: "drawing" },
    validateQti3DrawingItemStructure,
    renderQti3DrawingItem,
  );
}

export function validateQti3DrawingItem(input: Qti3DrawingBuilderInput): Qti3WriterDiagnostic[] {
  return validatePreparedItem(
    { ...input, interactionType: "drawing" },
    validateQti3DrawingItemStructure,
  );
}

export function renderQti3DrawingItem(
  input: Qti3DrawingBuilderInput,
  feedback: PreparedFeedback,
): string {
  const responseIdentifier = assertQtiIdentifier(
    resolveResponseIdentifier(input.responseIdentifier),
    "Drawing response identifier",
  );
  const escapedResponseIdentifier = escapeXmlAttribute(responseIdentifier);
  const declarationsXml = `  <qti-response-declaration identifier="${escapedResponseIdentifier}" cardinality="single" base-type="file"/>`;
  const longDescription = optionalLongDescriptionBlock(
    input.identifier,
    input.object.longDescription,
  );
  const interactionAttrs = interactionAttributeList({
    responseIdentifier: escapedResponseIdentifier,
    sharedVocabulary: input.sharedVocabulary,
    interactionType: "drawing",
    classNames: input.classNames,
    extraAttributes: [longDescription.attributeXml],
  });
  const bodyXml = `${optionalBodySection(input.bodyHtml)}${longDescription.blockXml}    <qti-drawing-interaction ${interactionAttrs}>
${optionalPromptSection(input.promptHtml)}      <object ${xmlAttributeList(renderGraphicObjectAttributes(input.object))}/>
    </qti-drawing-interaction>`;

  return composeAssessmentItem(
    {
      ...input,
      declarationsXml,
      bodyXml,
      responseProcessingXml: trustedResponseProcessingXml(undefined),
      scoreDefaultZero: true,
    },
    feedback,
  );
}

export function validateQti3DrawingItemStructure(
  input: Qti3DrawingBuilderInput,
): Qti3WriterDiagnostic[] {
  const diagnostics = validateItemBase(input);
  const responseIdentifier = resolveResponseIdentifier(input.responseIdentifier);
  const responseIdentifierDiagnostic = validateQtiIdentifier(
    "responseIdentifier",
    "Drawing response identifier",
    responseIdentifier,
  );
  if (responseIdentifierDiagnostic) diagnostics.push(responseIdentifierDiagnostic);
  validateGraphicObject(input.object, diagnostics, {
    codePrefix: "drawing",
    label: "Drawing",
    path: "object",
  });
  return diagnostics;
}
