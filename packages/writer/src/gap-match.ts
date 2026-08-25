import {
  duplicateDiagnostics,
  isNonNegativeInteger,
  throwIfDiagnostics,
  validateItemBase,
  validateQtiIdentifier,
  writerDiagnostic,
} from "./diagnostics.js";
import { renderGraphicObjectAttributes, validateGraphicObject } from "./graphic-object.js";
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
  Qti3GapMatchBuilderInput,
  Qti3GapMatchChoice,
  Qti3WriterDiagnostic,
} from "./types.js";
import { escapeXmlAttribute, escapeXmlText, xmlAttributeList } from "./xml.js";

export function buildQti3GapMatchItem(input: Qti3GapMatchBuilderInput): string {
  const diagnostics = validateQti3GapMatchItem(input);
  throwIfDiagnostics(diagnostics);
  return renderQti3GapMatchItem(input);
}

export function renderQti3GapMatchItem(input: Qti3GapMatchBuilderInput): string {
  const responseIdentifier = assertQtiIdentifier(
    resolveResponseIdentifier(input.responseIdentifier),
    "Gap match response identifier",
  );
  const escapedResponseIdentifier = escapeXmlAttribute(responseIdentifier);
  const declarationsXml = pairResponseDeclarationXml({
    responseIdentifier: escapedResponseIdentifier,
    baseType: "directedPair",
    pairs: input.correctResponse,
    scoring: input.scoring ?? "map_response",
  });
  const interactionAttrs = interactionAttributeList({
    responseIdentifier: escapedResponseIdentifier,
    sharedVocabulary: input.sharedVocabulary,
    interactionType: "gapMatch",
    classNames: input.classNames,
    extraAttributes: [
      input.shuffle === undefined ? "" : `shuffle="${input.shuffle ? "true" : "false"}"`,
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
    ],
  });
  const choicesXml = input.choices.map(gapChoiceXml).join("\n");
  const bodyFragment = input.bodyHtml
    .trim()
    .split("\n")
    .map((line) => `      ${line}`)
    .join("\n");
  const bodyXml = `    <qti-gap-match-interaction ${interactionAttrs}>
${optionalPromptSection(input.promptHtml)}${choicesXml}
${bodyFragment}
    </qti-gap-match-interaction>`;

  return assessmentItemShell({
    ...input,
    declarationsXml,
    bodyXml,
    responseProcessingXml: responseProcessingTemplateXml(input.scoring ?? "map_response"),
  });
}

function gapChoiceXml(choice: Qti3GapMatchChoice): string {
  const identifier = escapeXmlAttribute(
    assertQtiIdentifier(choice.identifier, "Gap match choice identifier"),
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

export function validateQti3GapMatchItem(input: Qti3GapMatchBuilderInput): Qti3WriterDiagnostic[] {
  const diagnostics = validateItemBase(input);
  const responseIdentifier = resolveResponseIdentifier(input.responseIdentifier);
  const responseIdentifierDiagnostic = validateQtiIdentifier(
    "responseIdentifier",
    "Gap match response identifier",
    responseIdentifier,
  );
  if (responseIdentifierDiagnostic) diagnostics.push(responseIdentifierDiagnostic);
  diagnostics.push(
    ...duplicateDiagnostics(
      [
        ...input.choices.map((choice) => choice.identifier),
        ...input.targets.map((target) => target.identifier),
      ],
      "choices|targets",
      "Gap match choice or target identifier",
    ),
  );
  validateChoices(input, diagnostics);
  validateTargets(input, diagnostics);
  validateAssociationBounds(input, diagnostics);
  validateCorrectResponse(input, diagnostics);
  return diagnostics;
}

function validateChoices(
  input: Qti3GapMatchBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  if (!input.choices.length) {
    diagnostics.push(
      writerDiagnostic(
        "missing_gap_match_choices",
        "choices",
        "Gap match items must include at least one choice.",
      ),
    );
  }
  diagnostics.push(
    ...duplicateDiagnostics(
      input.choices.map((choice) => choice.identifier),
      "choices",
      "Gap match choice identifier",
    ),
  );
  for (const [index, choice] of input.choices.entries()) {
    const path = `choices.${index}`;
    const identifierDiagnostic = validateQtiIdentifier(
      `${path}.identifier`,
      "Gap match choice identifier",
      choice.identifier,
    );
    if (identifierDiagnostic) diagnostics.push(identifierDiagnostic);
    if (choice.matchMax !== undefined && !isNonNegativeInteger(choice.matchMax)) {
      diagnostics.push(
        writerDiagnostic(
          "invalid_gap_match_choice_match_max",
          `${path}.matchMax`,
          "Gap match choice matchMax must be a non-negative integer.",
          choice.matchMax,
        ),
      );
    }
    if (choice.kind === "text") {
      if (!choice.contentHtml?.trim() && !(choice.text ?? "").trim()) {
        diagnostics.push(
          writerDiagnostic(
            "empty_gap_match_choice",
            path,
            `Gap match choice "${choice.identifier}" must include text or contentHtml.`,
            choice.identifier,
          ),
        );
      }
      continue;
    }
    validateGraphicObject(choice.object, diagnostics, {
      codePrefix: "gap_match_choice",
      label: "Gap match choice",
      path: `${path}.object`,
    });
  }
}

function validateTargets(
  input: Qti3GapMatchBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  if (!input.targets.length) {
    diagnostics.push(
      writerDiagnostic(
        "missing_gap_match_targets",
        "targets",
        "Gap match items must include at least one target.",
      ),
    );
  }
  diagnostics.push(
    ...duplicateDiagnostics(
      input.targets.map((target) => target.identifier),
      "targets",
      "Gap match target identifier",
    ),
  );
  for (const [index, target] of input.targets.entries()) {
    const identifierDiagnostic = validateQtiIdentifier(
      `targets.${index}.identifier`,
      "Gap match target identifier",
      target.identifier,
    );
    if (identifierDiagnostic) diagnostics.push(identifierDiagnostic);
  }
  validateBodyGaps(input, diagnostics);
}

function validateAssociationBounds(
  input: Qti3GapMatchBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  if (input.minAssociations !== undefined && !isNonNegativeInteger(input.minAssociations)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_gap_match_min_associations",
        "minAssociations",
        "Gap match minAssociations must be a non-negative integer.",
        input.minAssociations,
      ),
    );
  }
  if (input.maxAssociations !== undefined && !isNonNegativeInteger(input.maxAssociations)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_gap_match_max_associations",
        "maxAssociations",
        "Gap match maxAssociations must be a non-negative integer.",
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
        "invalid_gap_match_bounds",
        "minAssociations",
        "Gap match minAssociations must be less than or equal to maxAssociations.",
        { minAssociations: input.minAssociations, maxAssociations: input.maxAssociations },
      ),
    );
  }
}

function validateBodyGaps(
  input: Qti3GapMatchBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  const bodyHtml = input.bodyHtml.trim();
  if (!bodyHtml) {
    diagnostics.push(
      writerDiagnostic(
        "missing_gap_match_body",
        "bodyHtml",
        "Gap match bodyHtml must include qti-gap target elements.",
      ),
    );
    return;
  }
  const bodyGapIdentifiers = extractGapIdentifiers(bodyHtml);
  if (!bodyGapIdentifiers.length) {
    diagnostics.push(
      writerDiagnostic(
        "missing_gap_match_body_gaps",
        "bodyHtml",
        "Gap match bodyHtml must include at least one qti-gap target.",
      ),
    );
  }
  for (const index of extractGapMissingIdentifierIndexes(bodyHtml)) {
    diagnostics.push(
      writerDiagnostic(
        "missing_gap_match_gap_identifier",
        `bodyHtml.gaps.${index}`,
        "Gap match qti-gap elements must include an identifier attribute.",
      ),
    );
  }
  diagnostics.push(
    ...duplicateDiagnostics(bodyGapIdentifiers, "bodyHtml", "Gap match body target identifier"),
  );
  const targetIdentifiers = new Set(input.targets.map((target) => target.identifier.trim()));
  const bodyGapIdentifierSet = new Set(bodyGapIdentifiers);
  for (const target of input.targets) {
    const identifier = target.identifier.trim();
    if (!bodyGapIdentifierSet.has(identifier)) {
      diagnostics.push(
        writerDiagnostic(
          "missing_gap_match_body_gap",
          "bodyHtml",
          `Gap match target "${identifier}" has no matching qti-gap in bodyHtml.`,
          identifier,
        ),
      );
    }
  }
  for (const [index, identifier] of bodyGapIdentifiers.entries()) {
    if (!targetIdentifiers.has(identifier)) {
      diagnostics.push(
        writerDiagnostic(
          "unknown_gap_match_body_gap",
          `bodyHtml.gaps.${index}`,
          `Gap match bodyHtml contains undeclared qti-gap "${identifier}".`,
          identifier,
        ),
      );
    }
  }
}

function validateCorrectResponse(
  input: Qti3GapMatchBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  if (!input.correctResponse.length) {
    diagnostics.push(
      writerDiagnostic(
        "missing_gap_match_correct_response",
        "correctResponse",
        "Gap match items must include at least one correct pair.",
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
    sourceLabel: "Gap match pair choice identifier",
    targetLabel: "Gap match pair target identifier",
    unknownSourceCode: "unknown_gap_match_choice_reference",
    unknownTargetCode: "unknown_gap_match_target_reference",
    unknownSourceMessage: (identifier) =>
      `Gap match correct response references unknown choice "${identifier}".`,
    unknownTargetMessage: (identifier) =>
      `Gap match correct response references unknown target "${identifier}".`,
    duplicateLabel: "Gap match correct pair",
  });
  validatePairMatchMax({
    pairs: input.correctResponse,
    matchMaxByIdentifier: new Map(
      input.choices.map((choice) => [choice.identifier.trim(), choice.matchMax]),
    ),
    diagnostics,
    path: "correctResponse",
    code: "gap_match_match_max_exceeded",
    label: "Gap match choice",
  });
  validateGapTargetSingleUse(input, diagnostics);
}

function validateGapTargetSingleUse(
  input: Qti3GapMatchBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  const targetUseCounts = new Map<string, number>();
  for (const pair of input.correctResponse) {
    const targetIdentifier = pair.targetIdentifier.trim();
    if (!targetIdentifier) continue;
    targetUseCounts.set(targetIdentifier, (targetUseCounts.get(targetIdentifier) ?? 0) + 1);
  }
  for (const [identifier, useCount] of targetUseCounts.entries()) {
    if (useCount <= 1) continue;
    diagnostics.push(
      writerDiagnostic(
        "gap_match_target_multiple_correct_choices",
        "correctResponse",
        `Gap match target "${identifier}" is used ${useCount} times, but qti-gap targets can have at most one associated choice.`,
        { identifier, useCount },
      ),
    );
  }
}

function extractGapIdentifiers(bodyHtml: string): string[] {
  const identifiers: string[] = [];
  const gapPattern = /<qti-gap\b[^>]*>/gi;
  for (const match of bodyHtml.matchAll(gapPattern)) {
    const identifier = extractIdentifier(match[0]);
    if (identifier) identifiers.push(identifier);
  }
  return identifiers;
}

function extractGapMissingIdentifierIndexes(bodyHtml: string): number[] {
  const indexes: number[] = [];
  const gapPattern = /<qti-gap\b[^>]*>/gi;
  let index = 0;
  for (const match of bodyHtml.matchAll(gapPattern)) {
    if (!extractIdentifier(match[0])) indexes.push(index);
    index += 1;
  }
  return indexes;
}

function extractIdentifier(tag: string): string | undefined {
  return /\bidentifier\s*=\s*(["'])(.*?)\1/i.exec(tag)?.[2]?.trim();
}
