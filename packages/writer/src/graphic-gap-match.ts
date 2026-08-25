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
import type {
  Qti3GraphicGapChoice,
  Qti3GraphicGapMatchBuilderInput,
  Qti3WriterDiagnostic,
} from "./types.js";
import { escapeXmlAttribute, escapeXmlText, xmlAttributeList } from "./xml.js";

export function buildQti3GraphicGapMatchItem(input: Qti3GraphicGapMatchBuilderInput): string {
  const diagnostics = validateQti3GraphicGapMatchItem(input);
  throwIfDiagnostics(diagnostics);
  return renderQti3GraphicGapMatchItem(input);
}

export function renderQti3GraphicGapMatchItem(input: Qti3GraphicGapMatchBuilderInput): string {
  const responseIdentifier = assertQtiIdentifier(
    resolveResponseIdentifier(input.responseIdentifier),
    "Graphic gap match response identifier",
  );
  const escapedResponseIdentifier = escapeXmlAttribute(responseIdentifier);
  const declarationsXml = pairResponseDeclarationXml({
    responseIdentifier: escapedResponseIdentifier,
    baseType: "directedPair",
    pairs: input.correctResponse,
    scoring: input.scoring ?? "match_correct",
  });
  const longDescription = optionalLongDescriptionBlock(
    input.identifier,
    input.object.longDescription,
  );
  const interactionAttrs = interactionAttributeList({
    responseIdentifier: escapedResponseIdentifier,
    sharedVocabulary: input.sharedVocabulary,
    interactionType: "graphicGapMatch",
    classNames: input.classNames,
    extraAttributes: [
      input.minAssociations !== undefined
        ? `min-associations="${String(input.minAssociations)}"`
        : "",
      input.maxAssociations !== undefined
        ? `max-associations="${String(input.maxAssociations)}"`
        : "",
      input.minAssociationsMessage?.trim()
        ? `data-min-selections-message="${escapeXmlAttribute(input.minAssociationsMessage.trim())}"`
        : "",
      input.maxAssociationsMessage?.trim()
        ? `data-max-selections-message="${escapeXmlAttribute(input.maxAssociationsMessage.trim())}"`
        : "",
      longDescription.attributeXml,
    ],
  });
  const choicesXml = input.choices.map(graphicGapChoiceXml).join("\n");
  const targetsXml = input.targets
    .flatMap((target) => {
      if (target.targetType === "inlineGap") return [];
      const identifier = escapeXmlAttribute(
        assertQtiIdentifier(target.identifier, "Graphic gap target identifier"),
      );
      const attrs = [
        `identifier="${identifier}"`,
        `shape="${target.shape}"`,
        `coords="${escapeXmlAttribute(target.coords.trim())}"`,
        `match-max="${String(target.matchMax ?? 1)}"`,
      ];
      return [`      <qti-associable-hotspot ${xmlAttributeList(attrs)}/>`];
    })
    .join("\n");
  const bodyFragment = input.bodyHtml?.trim()
    ? input.bodyHtml
        .trim()
        .split("\n")
        .map((line) => `      ${line}`)
        .join("\n")
    : "";
  const bodyXml = `${longDescription.blockXml}    <qti-graphic-gap-match-interaction ${interactionAttrs}>
${optionalPromptSection(input.promptHtml)}      <object ${xmlAttributeList(renderGraphicObjectAttributes(input.object))}/>
${choicesXml}
${targetsXml}
${bodyFragment}
    </qti-graphic-gap-match-interaction>`;

  return assessmentItemShell({
    ...input,
    declarationsXml,
    bodyXml,
    responseProcessingXml: responseProcessingTemplateXml(input.scoring ?? "match_correct"),
  });
}

export function validateQti3GraphicGapMatchItem(
  input: Qti3GraphicGapMatchBuilderInput,
): Qti3WriterDiagnostic[] {
  const diagnostics = validateItemBase(input);
  const responseIdentifier = resolveResponseIdentifier(input.responseIdentifier);
  const responseIdentifierDiagnostic = validateQtiIdentifier(
    "responseIdentifier",
    "Graphic gap match response identifier",
    responseIdentifier,
  );
  if (responseIdentifierDiagnostic) diagnostics.push(responseIdentifierDiagnostic);
  validateGraphicObject(input.object, diagnostics, {
    codePrefix: "graphic_gap_match",
    label: "Graphic gap match",
    path: "object",
  });
  diagnostics.push(
    ...duplicateDiagnostics(
      [
        ...input.choices.map((choice) => choice.identifier),
        ...input.targets.map((target) => target.identifier),
      ],
      "choices|targets",
      "Graphic gap choice or target identifier",
    ),
  );
  validateChoices(input, diagnostics);
  validateTargets(input, diagnostics);
  validateAssociationBounds(input, diagnostics);
  validateCorrectResponse(input, diagnostics);
  return diagnostics;
}

function graphicGapChoiceXml(choice: Qti3GraphicGapChoice): string {
  const identifier = escapeXmlAttribute(
    assertQtiIdentifier(choice.identifier, "Graphic gap choice identifier"),
  );
  const attrs = [
    `identifier="${identifier}"`,
    `match-max="${String(choice.matchMax ?? 1)}"`,
    choice.fixed ? `fixed="true"` : "",
  ];
  if (choice.kind === "text") {
    const body = choice.contentHtml?.trim() ? choice.contentHtml : escapeXmlText(choice.text ?? "");
    return `      <qti-gap-text ${xmlAttributeList(attrs)}>${body}</qti-gap-text>`;
  }
  return `      <qti-gap-img ${xmlAttributeList(attrs)}>
        <object ${xmlAttributeList(renderGraphicObjectAttributes(choice.object))}/>
      </qti-gap-img>`;
}

function validateChoices(
  input: Qti3GraphicGapMatchBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  if (!input.choices.length) {
    diagnostics.push(
      writerDiagnostic(
        "missing_graphic_gap_match_choices",
        "choices",
        "Graphic gap match items must include at least one choice.",
      ),
    );
  }
  diagnostics.push(
    ...duplicateDiagnostics(
      input.choices.map((choice) => choice.identifier),
      "choices",
      "Graphic gap choice identifier",
    ),
  );
  for (const [index, choice] of input.choices.entries()) {
    const path = `choices.${index}`;
    const identifierDiagnostic = validateQtiIdentifier(
      `${path}.identifier`,
      "Graphic gap choice identifier",
      choice.identifier,
    );
    if (identifierDiagnostic) diagnostics.push(identifierDiagnostic);
    if (choice.matchMax !== undefined && !isNonNegativeInteger(choice.matchMax)) {
      diagnostics.push(
        writerDiagnostic(
          "invalid_graphic_gap_match_choice_match_max",
          `${path}.matchMax`,
          "Graphic gap choice matchMax must be a non-negative integer.",
          choice.matchMax,
        ),
      );
    }
    if (choice.kind === "text") {
      if (!choice.contentHtml?.trim() && !(choice.text ?? "").trim()) {
        diagnostics.push(
          writerDiagnostic(
            "empty_graphic_gap_match_choice",
            path,
            `Graphic gap choice "${choice.identifier}" must include text or contentHtml.`,
            choice.identifier,
          ),
        );
      }
      continue;
    }
    validateGraphicObject(choice.object, diagnostics, {
      codePrefix: "graphic_gap_match_choice",
      label: "Graphic gap choice",
      path: `${path}.object`,
    });
  }
}

function validateTargets(
  input: Qti3GraphicGapMatchBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  if (!input.targets.length) {
    diagnostics.push(
      writerDiagnostic(
        "missing_graphic_gap_match_targets",
        "targets",
        "Graphic gap match items must include at least one target.",
      ),
    );
  }
  diagnostics.push(
    ...duplicateDiagnostics(
      input.targets.map((target) => target.identifier),
      "targets",
      "Graphic gap target identifier",
    ),
  );
  for (const [index, target] of input.targets.entries()) {
    const path = `targets.${index}`;
    if (target.targetType === "inlineGap") {
      const identifierDiagnostic = validateQtiIdentifier(
        `${path}.identifier`,
        "Graphic gap target identifier",
        target.identifier,
      );
      if (identifierDiagnostic) diagnostics.push(identifierDiagnostic);
      if (target.matchMax !== undefined && !isNonNegativeInteger(target.matchMax)) {
        diagnostics.push(
          writerDiagnostic(
            "invalid_graphic_gap_match_target_match_max",
            `${path}.matchMax`,
            "Graphic gap target matchMax must be a non-negative integer.",
            target.matchMax,
          ),
        );
      }
      continue;
    }
    validateHotspotGeometry(target, path, diagnostics, {
      identifierLabel: "Graphic gap target identifier",
      itemLabel: "Graphic gap target",
      missingCoordsCode: "missing_graphic_gap_match_target_coords",
      invalidShapeCode: "invalid_graphic_gap_match_target_shape",
      invalidMatchMaxCode: "invalid_graphic_gap_match_target_match_max",
    });
  }
  validateInlineGapTargets(input, diagnostics);
}

function validateAssociationBounds(
  input: Qti3GraphicGapMatchBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  if (input.minAssociations !== undefined && !isNonNegativeInteger(input.minAssociations)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_graphic_gap_match_min_associations",
        "minAssociations",
        "Graphic gap match minAssociations must be a non-negative integer.",
        input.minAssociations,
      ),
    );
  }
  if (input.maxAssociations !== undefined && !isNonNegativeInteger(input.maxAssociations)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_graphic_gap_match_max_associations",
        "maxAssociations",
        "Graphic gap match maxAssociations must be a non-negative integer.",
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
        "invalid_graphic_gap_match_bounds",
        "minAssociations",
        "Graphic gap match minAssociations must be less than or equal to maxAssociations.",
        { minAssociations: input.minAssociations, maxAssociations: input.maxAssociations },
      ),
    );
  }
}

function validateInlineGapTargets(
  input: Qti3GraphicGapMatchBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  const inlineTargets = input.targets.filter((target) => target.targetType === "inlineGap");
  if (!inlineTargets.length) return;
  const gapIdentifiers = extractInlineGapIdentifiers(input.bodyHtml?.trim() ?? "");
  if (!gapIdentifiers.length) {
    diagnostics.push(
      writerDiagnostic(
        "missing_graphic_gap_match_body_gaps",
        "bodyHtml",
        "Graphic gap match inline targets require bodyHtml with qti-gap elements.",
      ),
    );
  }
  diagnostics.push(
    ...duplicateDiagnostics(gapIdentifiers, "bodyHtml", "Graphic gap body target identifier"),
  );
  const gapIdentifierSet = new Set(gapIdentifiers);
  const inlineTargetIdentifiers = new Set(inlineTargets.map((target) => target.identifier.trim()));
  for (const target of inlineTargets) {
    const identifier = target.identifier.trim();
    if (!gapIdentifierSet.has(identifier)) {
      diagnostics.push(
        writerDiagnostic(
          "missing_graphic_gap_match_inline_gap",
          "bodyHtml",
          `Graphic gap inline target "${identifier}" has no matching qti-gap in bodyHtml.`,
          identifier,
        ),
      );
    }
  }
  for (const [index, gapIdentifier] of gapIdentifiers.entries()) {
    if (!inlineTargetIdentifiers.has(gapIdentifier)) {
      diagnostics.push(
        writerDiagnostic(
          "unknown_graphic_gap_match_body_gap",
          `bodyHtml.gaps.${index}`,
          `Graphic gap bodyHtml contains undeclared qti-gap "${gapIdentifier}".`,
          gapIdentifier,
        ),
      );
    }
  }
}

function validateCorrectResponse(
  input: Qti3GraphicGapMatchBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  if (!input.correctResponse.length) {
    diagnostics.push(
      writerDiagnostic(
        "missing_graphic_gap_match_correct_response",
        "correctResponse",
        "Graphic gap match items must include at least one correct pair.",
      ),
    );
  }
  const choiceIdentifiers = new Set(input.choices.map((choice) => choice.identifier.trim()));
  const targetIdentifiers = new Set(input.targets.map((target) => target.identifier.trim()));
  validatePairReferences({
    pairs: input.correctResponse,
    sourceIdentifiers: choiceIdentifiers,
    targetIdentifiers,
    diagnostics,
    path: "correctResponse",
    sourceLabel: "Graphic gap pair choice identifier",
    targetLabel: "Graphic gap pair target identifier",
    unknownSourceCode: "unknown_graphic_gap_match_choice_reference",
    unknownTargetCode: "unknown_graphic_gap_match_target_reference",
    unknownSourceMessage: (identifier) =>
      `Graphic gap match correct response references unknown choice "${identifier}".`,
    unknownTargetMessage: (identifier) =>
      `Graphic gap match correct response references unknown target "${identifier}".`,
    duplicateLabel: "Graphic gap correct pair",
  });
  validatePairMatchMax({
    pairs: input.correctResponse,
    matchMaxByIdentifier: new Map(
      [...input.choices, ...input.targets].map((entry) => [
        entry.identifier.trim(),
        entry.matchMax,
      ]),
    ),
    diagnostics,
    path: "correctResponse",
    code: "graphic_gap_match_match_max_exceeded",
    label: "Graphic gap match choice or target",
  });
}

function extractInlineGapIdentifiers(bodyHtml: string): string[] {
  const identifiers: string[] = [];
  const gapPattern = /<qti-gap\b[^>]*>/gi;
  const identifierPattern = /\bidentifier\s*=\s*(["'])(.*?)\1/i;
  for (const match of bodyHtml.matchAll(gapPattern)) {
    const tag = match[0];
    const identifier = identifierPattern.exec(tag)?.[2]?.trim();
    if (identifier) identifiers.push(identifier);
  }
  return identifiers;
}
