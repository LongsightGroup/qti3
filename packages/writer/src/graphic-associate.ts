import {
  duplicateDiagnostics,
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
import { validateHotspotGeometry } from "./hotspot-geometry.js";
import { assertQtiIdentifier } from "./identifier.js";
import {
  interactionAttributeList,
  optionalBodySection,
  optionalPromptSection,
  resolveResponseIdentifier,
} from "./interaction-shell.js";
import {
  pairResponseDeclarationXml,
  validatePairMatchMax,
  validatePairReferences,
} from "./pair-declaration.js";
import { responseProcessingTemplateXml } from "./response-processing.js";
import { assessmentItemShell } from "./shell.js";
import type { Qti3GraphicAssociateBuilderInput, Qti3WriterDiagnostic } from "./types.js";
import { xmlAttributeList, xmlEscape } from "./xml.js";

export function buildQti3GraphicAssociateItem(input: Qti3GraphicAssociateBuilderInput): string {
  const diagnostics = validateQti3GraphicAssociateItem(input);
  throwIfDiagnostics(diagnostics);
  return renderQti3GraphicAssociateItem(input);
}

export function renderQti3GraphicAssociateItem(input: Qti3GraphicAssociateBuilderInput): string {
  const responseIdentifier = assertQtiIdentifier(
    resolveResponseIdentifier(input.responseIdentifier),
    "Graphic associate response identifier",
  );
  const escapedResponseIdentifier = xmlEscape(responseIdentifier);
  const scoring = input.scoring ?? "match_correct";
  const declarationsXml = pairResponseDeclarationXml({
    responseIdentifier: escapedResponseIdentifier,
    baseType: "pair",
    pairs: input.correctResponse,
    scoring,
  });
  const longDescription = optionalLongDescriptionBlock(
    input.identifier,
    input.object.longDescription,
  );
  const interactionAttrs = interactionAttributeList({
    responseIdentifier: escapedResponseIdentifier,
    sharedVocabulary: input.sharedVocabulary,
    interactionType: "graphicAssociate",
    classNames: input.classNames,
    extraAttributes: [
      input.minAssociations !== undefined
        ? `min-associations="${String(input.minAssociations)}"`
        : "",
      input.maxAssociations !== undefined
        ? `max-associations="${String(input.maxAssociations)}"`
        : "",
      longDescription.attributeXml,
    ],
  });
  const objectAttrs = renderGraphicObjectAttributes(input.object);
  const hotspotsXml = input.hotspots
    .map((hotspot) => {
      const identifier = xmlEscape(
        assertQtiIdentifier(hotspot.identifier, "Graphic associate hotspot identifier"),
      );
      const attrs = [
        `identifier="${identifier}"`,
        hotspot.hotspotLabel?.trim()
          ? `hotspot-label="${xmlEscape(hotspot.hotspotLabel.trim())}"`
          : "",
        `shape="${hotspot.shape}"`,
        `coords="${xmlEscape(hotspot.coords.trim())}"`,
        `match-max="${String(hotspot.matchMax ?? 1)}"`,
      ];
      return `      <qti-associable-hotspot ${xmlAttributeList(attrs)}/>`;
    })
    .join("\n");
  const bodyXml = `${optionalBodySection(input.bodyHtml)}${longDescription.blockXml}    <qti-graphic-associate-interaction ${interactionAttrs}>
${optionalPromptSection(input.promptHtml)}      <object ${xmlAttributeList(objectAttrs)}/>
${hotspotsXml}
    </qti-graphic-associate-interaction>`;

  return assessmentItemShell({
    ...input,
    declarationsXml,
    bodyXml,
    responseProcessingXml: responseProcessingTemplateXml(scoring),
  });
}

export function validateQti3GraphicAssociateItem(
  input: Qti3GraphicAssociateBuilderInput,
): Qti3WriterDiagnostic[] {
  const diagnostics = validateItemBase(input);
  const responseIdentifier = resolveResponseIdentifier(input.responseIdentifier);
  const responseIdentifierDiagnostic = validateQtiIdentifier(
    "responseIdentifier",
    "Graphic associate response identifier",
    responseIdentifier,
  );
  if (responseIdentifierDiagnostic) diagnostics.push(responseIdentifierDiagnostic);
  validateGraphicObject(input.object, diagnostics, {
    codePrefix: "graphic_associate",
    label: "Graphic associate",
    path: "object",
  });

  if (input.hotspots.length < 2) {
    diagnostics.push(
      writerDiagnostic(
        "missing_graphic_associate_hotspots",
        "hotspots",
        "Graphic associate items must include at least two hotspots.",
      ),
    );
  }
  diagnostics.push(
    ...duplicateDiagnostics(
      input.hotspots.map((hotspot) => hotspot.identifier),
      "hotspots",
      "Graphic associate hotspot identifier",
    ),
  );
  for (const [index, hotspot] of input.hotspots.entries()) {
    validateHotspotGeometry(hotspot, `hotspots.${index}`, diagnostics, {
      identifierLabel: "Graphic associate hotspot identifier",
      itemLabel: "Graphic associate hotspot",
      missingCoordsCode: "missing_graphic_associate_coords",
      invalidShapeCode: "invalid_graphic_associate_shape",
      invalidMatchMaxCode: "invalid_graphic_associate_match_max",
    });
  }
  validateAssociationBounds(input, diagnostics);

  if (!input.correctResponse.length) {
    diagnostics.push(
      writerDiagnostic(
        "missing_graphic_associate_correct_response",
        "correctResponse",
        "Graphic associate items must include at least one correct pair.",
      ),
    );
  }
  const hotspotIdentifiers = new Set(input.hotspots.map((hotspot) => hotspot.identifier.trim()));
  validatePairReferences({
    pairs: input.correctResponse,
    sourceIdentifiers: hotspotIdentifiers,
    targetIdentifiers: hotspotIdentifiers,
    diagnostics,
    path: "correctResponse",
    sourceLabel: "Graphic associate pair source identifier",
    targetLabel: "Graphic associate pair target identifier",
    unknownSourceCode: "unknown_graphic_associate_reference",
    unknownTargetCode: "unknown_graphic_associate_reference",
    unknownSourceMessage: (identifier) =>
      `Graphic associate correct response references unknown hotspot "${identifier}".`,
    unknownTargetMessage: (identifier) =>
      `Graphic associate correct response references unknown hotspot "${identifier}".`,
    disallowSelfPair: true,
    selfPairCode: "invalid_graphic_associate_self_pair",
    selfPairMessage: () => "Graphic associate correct pairs must reference two different hotspots.",
    duplicateLabel: "Graphic associate correct pair",
    duplicateUnordered: true,
  });
  validatePairMatchMax({
    pairs: input.correctResponse,
    matchMaxByIdentifier: new Map(
      input.hotspots.map((hotspot) => [hotspot.identifier.trim(), hotspot.matchMax]),
    ),
    diagnostics,
    path: "correctResponse",
    code: "graphic_associate_match_max_exceeded",
    label: "Graphic associate hotspot",
  });
  return diagnostics;
}

function validateAssociationBounds(
  input: Qti3GraphicAssociateBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  if (input.minAssociations !== undefined && !isNonNegativeInteger(input.minAssociations)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_graphic_associate_min_associations",
        "minAssociations",
        "Graphic associate minAssociations must be a non-negative integer.",
        input.minAssociations,
      ),
    );
  }
  if (input.maxAssociations !== undefined && !isNonNegativeInteger(input.maxAssociations)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_graphic_associate_max_associations",
        "maxAssociations",
        "Graphic associate maxAssociations must be a non-negative integer.",
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
        "invalid_graphic_associate_bounds",
        "minAssociations",
        "Graphic associate minAssociations must be less than or equal to maxAssociations.",
        { minAssociations: input.minAssociations, maxAssociations: input.maxAssociations },
      ),
    );
  }
}
