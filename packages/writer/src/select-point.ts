import { assertQtiIdentifier } from "./identifier.js";
import {
  isNonNegativeInteger,
  throwIfDiagnostics,
  validateItemBase,
  validateQtiIdentifier,
  writerDiagnostic,
} from "./diagnostics.js";
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
import {
  mapResponsePointProcessingXml,
  responseProcessingTemplateXml,
} from "./response-processing.js";
import {
  dedupePointValues,
  pointCardinality,
  pointResponseDeclarationXml,
  validatePointAreaTargets,
  validatePointValues,
} from "./point-area.js";
import { assessmentItemShell } from "./shell.js";
import type { Qti3SelectPointBuilderInput, Qti3WriterDiagnostic } from "./types.js";
import { xmlAttributeList, escapeXmlAttribute } from "./xml.js";

export function buildQti3SelectPointItem(input: Qti3SelectPointBuilderInput): string {
  const diagnostics = validateQti3SelectPointItem(input);
  throwIfDiagnostics(diagnostics);
  return renderQti3SelectPointItem(input);
}

export function renderQti3SelectPointItem(input: Qti3SelectPointBuilderInput): string {
  const responseIdentifier = assertQtiIdentifier(
    resolveResponseIdentifier(input.responseIdentifier),
    "Select point response identifier",
  );
  const escapedResponseIdentifier = escapeXmlAttribute(responseIdentifier);
  const declarationsXml = pointResponseDeclarationXml({
    responseIdentifier,
    cardinality: pointCardinality(input),
    correctResponse: input.correctResponse,
    targets: input.targets,
  });
  const longDescription = optionalLongDescriptionBlock(
    input.identifier,
    input.object.longDescription,
  );
  const interactionAttrs = interactionAttributeList({
    responseIdentifier: escapedResponseIdentifier,
    sharedVocabulary: input.sharedVocabulary,
    interactionType: "selectPoint",
    classNames: input.classNames,
    extraAttributes: [
      input.minChoices !== undefined ? `min-choices="${String(input.minChoices)}"` : "",
      input.maxChoices !== undefined ? `max-choices="${String(input.maxChoices)}"` : "",
      longDescription.attributeXml,
    ],
  });
  const bodyXml = `${optionalBodySection(input.bodyHtml)}${longDescription.blockXml}    <qti-select-point-interaction ${interactionAttrs}>
${optionalPromptSection(input.promptHtml)}      <object ${xmlAttributeList(renderGraphicObjectAttributes(input.object))}/>
    </qti-select-point-interaction>`;

  return assessmentItemShell({
    ...input,
    declarationsXml,
    bodyXml,
    responseProcessingXml:
      responseIdentifier === "RESPONSE"
        ? responseProcessingTemplateXml("map_response_point")
        : mapResponsePointProcessingXml(responseIdentifier),
  });
}

export function validateQti3SelectPointItem(
  input: Qti3SelectPointBuilderInput,
): Qti3WriterDiagnostic[] {
  const diagnostics = validateItemBase(input);
  const responseIdentifier = resolveResponseIdentifier(input.responseIdentifier);
  const responseIdentifierDiagnostic = validateQtiIdentifier(
    "responseIdentifier",
    "Select point response identifier",
    responseIdentifier,
  );
  if (responseIdentifierDiagnostic) diagnostics.push(responseIdentifierDiagnostic);
  validateGraphicObject(input.object, diagnostics, {
    codePrefix: "select_point",
    label: "Select point",
    path: "object",
  });
  validateChoiceBounds(input, diagnostics);
  validateCorrectResponse(input, diagnostics);
  validateTargets(input, diagnostics);
  return diagnostics;
}

function validateChoiceBounds(
  input: Qti3SelectPointBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  if (input.minChoices !== undefined && !isNonNegativeInteger(input.minChoices)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_select_point_min_choices",
        "minChoices",
        "Select point minChoices must be a non-negative integer.",
        input.minChoices,
      ),
    );
  }
  if (input.maxChoices !== undefined && !isNonNegativeInteger(input.maxChoices)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_select_point_max_choices",
        "maxChoices",
        "Select point maxChoices must be a non-negative integer.",
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
        "invalid_select_point_bounds",
        "minChoices|maxChoices",
        "Select point minChoices must be less than or equal to maxChoices unless maxChoices is 0.",
        { minChoices: input.minChoices, maxChoices: input.maxChoices },
      ),
    );
  }
}

function validateCorrectResponse(
  input: Qti3SelectPointBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  const points = input.correctResponse ?? [];
  validatePointValues(
    points,
    "correctResponse",
    "Select point correctResponse",
    "invalid_select_point_correct_response",
    diagnostics,
  );
  if ((input.maxChoices ?? 1) === 1 && dedupePointValues(points).length > 1) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_select_point_correct_response_count",
        "correctResponse",
        "Select point correctResponse cannot contain multiple points when maxChoices is 1 or omitted.",
        points,
      ),
    );
  }
  if (input.maxChoices !== undefined && input.maxChoices > 0 && points.length > input.maxChoices) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_select_point_correct_response_count",
        "correctResponse",
        "Select point correctResponse count cannot exceed maxChoices.",
        { correctResponse: points.length, maxChoices: input.maxChoices },
      ),
    );
  }
}

function validateTargets(
  input: Qti3SelectPointBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  validatePointAreaTargets(input.targets, diagnostics, {
    codePrefix: "select_point",
    label: "Select point",
    path: "targets",
    requireTargets: true,
  });
}
