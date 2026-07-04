import { assertQtiIdentifier } from "./identifier.js";
import { throwIfDiagnostics, validateItemBase, validateQtiIdentifier } from "./diagnostics.js";
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
import { assessmentItemShell } from "./shell.js";
import type { Qti3DrawingBuilderInput, Qti3WriterDiagnostic } from "./types.js";
import { xmlAttributeList, xmlEscape } from "./xml.js";

export function buildQti3DrawingItem(input: Qti3DrawingBuilderInput): string {
  const diagnostics = validateQti3DrawingItem(input);
  throwIfDiagnostics(diagnostics);
  return renderQti3DrawingItem(input);
}

export function renderQti3DrawingItem(input: Qti3DrawingBuilderInput): string {
  const responseIdentifier = assertQtiIdentifier(
    resolveResponseIdentifier(input.responseIdentifier),
    "Drawing response identifier",
  );
  const escapedResponseIdentifier = xmlEscape(responseIdentifier);
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

  return assessmentItemShell({
    ...input,
    declarationsXml,
    bodyXml,
    responseProcessingXml: trustedResponseProcessingXml(undefined),
    scoreDefaultZero: true,
  });
}

export function validateQti3DrawingItem(input: Qti3DrawingBuilderInput): Qti3WriterDiagnostic[] {
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
