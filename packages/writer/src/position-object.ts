import { assertQtiIdentifier } from "./identifier.js";
import {
  isNonNegativeInteger,
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
  resolveResponseIdentifier,
} from "./interaction-shell.js";
import {
  dedupePointValues,
  isPointValue,
  pointCardinality,
  pointResponseDeclarationXml,
  validatePointAreaTargets,
  validatePointValues,
} from "./point-area.js";
import {
  mapResponsePointProcessingXml,
  responseProcessingTemplateXml,
} from "./response-processing.js";
import {
  buildPreparedItem,
  validatePreparedItem,
  composeAssessmentItem,
} from "./item-preparation.js";
import type { PreparedFeedback } from "./modal-feedback.js";
import type { Qti3PositionObjectBuilderInput, Qti3WriterDiagnostic } from "./types.js";
import { xmlAttributeList, escapeXmlAttribute } from "./xml.js";

export function buildQti3PositionObjectItem(input: Qti3PositionObjectBuilderInput): string {
  return buildPreparedItem(
    { ...input, interactionType: "positionObject" },
    validateQti3PositionObjectItemStructure,
    renderQti3PositionObjectItem,
  );
}

export function validateQti3PositionObjectItem(
  input: Qti3PositionObjectBuilderInput,
): Qti3WriterDiagnostic[] {
  return validatePreparedItem(
    { ...input, interactionType: "positionObject" },
    validateQti3PositionObjectItemStructure,
  );
}

export function renderQti3PositionObjectItem(
  input: Qti3PositionObjectBuilderInput,
  feedback: PreparedFeedback,
): string {
  const responseIdentifier = assertQtiIdentifier(
    resolveResponseIdentifier(input.responseIdentifier),
    "Position object response identifier",
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
    input.stageObject.longDescription,
  );
  const interactionAttrs = interactionAttributeList({
    responseIdentifier: escapedResponseIdentifier,
    sharedVocabulary: input.sharedVocabulary,
    interactionType: "positionObject",
    classNames: input.classNames,
    extraAttributes: [
      input.minChoices !== undefined ? `min-choices="${String(input.minChoices)}"` : "",
      input.maxChoices !== undefined ? `max-choices="${String(input.maxChoices)}"` : "",
      input.centerPoint?.trim()
        ? `center-point="${escapeXmlAttribute(input.centerPoint.trim())}"`
        : "",
      longDescription.attributeXml,
    ],
  });
  const promptXml = input.promptHtml?.trim() ? `<div>${input.promptHtml}</div>\n` : "";
  const bodyXml = `${optionalBodySection(input.bodyHtml)}${promptXml}${longDescription.blockXml}    <qti-position-object-stage>
      <object ${xmlAttributeList(renderGraphicObjectAttributes(input.stageObject))}/>
      <qti-position-object-interaction ${interactionAttrs}>
        <object ${xmlAttributeList(renderGraphicObjectAttributes(input.movableObject))}/>
      </qti-position-object-interaction>
    </qti-position-object-stage>`;

  return composeAssessmentItem(
    {
      ...input,
      declarationsXml,
      bodyXml,
      responseProcessingXml:
        responseIdentifier === "RESPONSE"
          ? responseProcessingTemplateXml("map_response_point")
          : mapResponsePointProcessingXml(responseIdentifier),
    },
    feedback,
  );
}

export function validateQti3PositionObjectItemStructure(
  input: Qti3PositionObjectBuilderInput,
): Qti3WriterDiagnostic[] {
  const diagnostics = validateItemBase(input);
  const responseIdentifier = resolveResponseIdentifier(input.responseIdentifier);
  const responseIdentifierDiagnostic = validateQtiIdentifier(
    "responseIdentifier",
    "Position object response identifier",
    responseIdentifier,
  );
  if (responseIdentifierDiagnostic) diagnostics.push(responseIdentifierDiagnostic);
  validateGraphicObject(input.stageObject, diagnostics, {
    codePrefix: "position_object_stage",
    label: "Position object stage",
    path: "stageObject",
  });
  validateGraphicObject(input.movableObject, diagnostics, {
    codePrefix: "position_object_movable",
    label: "Position object movable",
    path: "movableObject",
  });
  validateChoiceBounds(input, diagnostics);
  validateCorrectResponse(input, diagnostics);
  validateCenterPoint(input, diagnostics);
  validatePointAreaTargets(input.targets, diagnostics, {
    codePrefix: "position_object",
    label: "Position object",
    path: "targets",
    requireTargets: true,
  });
  return diagnostics;
}

function validateChoiceBounds(
  input: Qti3PositionObjectBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  if (input.minChoices !== undefined && !isNonNegativeInteger(input.minChoices)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_position_object_min_choices",
        "minChoices",
        "Position object minChoices must be a non-negative integer.",
        input.minChoices,
      ),
    );
  }
  if (input.maxChoices !== undefined && !isNonNegativeInteger(input.maxChoices)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_position_object_max_choices",
        "maxChoices",
        "Position object maxChoices must be a non-negative integer.",
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
        "invalid_position_object_bounds",
        "minChoices|maxChoices",
        "Position object minChoices must be less than or equal to maxChoices unless maxChoices is 0.",
        { minChoices: input.minChoices, maxChoices: input.maxChoices },
      ),
    );
  }
}

function validateCorrectResponse(
  input: Qti3PositionObjectBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  const points = input.correctResponse ?? [];
  validatePointValues(
    points,
    "correctResponse",
    "Position object correctResponse",
    "invalid_position_object_correct_response",
    diagnostics,
  );
  if ((input.maxChoices ?? 1) === 1 && dedupePointValues(points).length > 1) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_position_object_correct_response_count",
        "correctResponse",
        "Position object correctResponse cannot contain multiple points when maxChoices is 1 or omitted.",
        points,
      ),
    );
  }
  if (input.maxChoices !== undefined && input.maxChoices > 0 && points.length > input.maxChoices) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_position_object_correct_response_count",
        "correctResponse",
        "Position object correctResponse count cannot exceed maxChoices.",
        { correctResponse: points.length, maxChoices: input.maxChoices },
      ),
    );
  }
}

function validateCenterPoint(
  input: Qti3PositionObjectBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  if (input.centerPoint === undefined || input.centerPoint.trim() === "") return;
  if (isPointValue(input.centerPoint)) return;
  diagnostics.push(
    writerDiagnostic(
      "invalid_position_object_center_point",
      "centerPoint",
      'Position object centerPoint must be a QTI point value in the form "x y".',
      input.centerPoint,
    ),
  );
}
