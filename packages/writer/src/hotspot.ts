import { assertQtiIdentifier } from "./identifier.js";
import {
  dedupeNonemptyTrimmed,
  duplicateDiagnostics,
  isNonNegativeInteger,
  isPositiveInteger,
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
import {
  interactionAttributeList,
  optionalBodySection,
  optionalPromptSection,
  resolveResponseIdentifier,
} from "./interaction-shell.js";
import { responseProcessingTemplateXml } from "./response-processing.js";
import { assessmentItemShell } from "./shell.js";
import type { Qti3HotspotBuilderInput, Qti3WriterDiagnostic } from "./types.js";
import { xmlAttributeList, xmlEscape } from "./xml.js";

export function buildQti3HotspotItem(input: Qti3HotspotBuilderInput): string {
  const diagnostics = validateQti3HotspotItem(input);
  throwIfDiagnostics(diagnostics);
  return renderQti3HotspotItem(input);
}

export function renderQti3HotspotItem(input: Qti3HotspotBuilderInput): string {
  const responseIdentifier = assertQtiIdentifier(
    resolveResponseIdentifier(input.responseIdentifier),
    "Hotspot response identifier",
  );
  const escapedResponseIdentifier = xmlEscape(responseIdentifier);
  const maxChoices = input.maxChoices ?? 1;
  const minChoices = normalizeBound(input.minChoices, 0);
  const cardinality = maxChoices === 1 ? "single" : "multiple";
  const correctResponse = dedupeNonemptyTrimmed(input.correctResponse ?? []).map((value) =>
    assertQtiIdentifier(value, "Hotspot correct identifier"),
  );
  const correctXml = correctResponse.length
    ? `    <qti-correct-response>
${correctResponse.map((value) => `      <qti-value>${xmlEscape(value)}</qti-value>`).join("\n")}
    </qti-correct-response>\n`
    : "";
  const declarationsXml = `  <qti-response-declaration identifier="${escapedResponseIdentifier}" cardinality="${cardinality}" base-type="identifier">
${correctXml}  </qti-response-declaration>`;
  const longDescription = optionalLongDescriptionBlock(
    input.identifier,
    input.object.longDescription,
  );
  const interactionAttrs = interactionAttributeList({
    responseIdentifier: escapedResponseIdentifier,
    sharedVocabulary: input.sharedVocabulary,
    interactionType: "hotspot",
    classNames: input.classNames,
    extraAttributes: [
      minChoices !== null ? `min-choices="${String(minChoices)}"` : "",
      `max-choices="${String(maxChoices)}"`,
      input.minChoicesMessage?.trim()
        ? `data-min-selections-message="${xmlEscape(input.minChoicesMessage.trim())}"`
        : "",
      input.maxChoicesMessage?.trim()
        ? `data-max-selections-message="${xmlEscape(input.maxChoicesMessage.trim())}"`
        : "",
      longDescription.attributeXml,
    ],
  });
  const objectAttrs = renderGraphicObjectAttributes(input.object);
  const choicesXml = input.choices
    .map((choice) => {
      const identifier = xmlEscape(assertQtiIdentifier(choice.identifier, "Hotspot identifier"));
      const coords = choice.coords.trim();
      return `      <qti-hotspot-choice identifier="${identifier}" shape="${choice.shape}" coords="${xmlEscape(coords)}"/>`;
    })
    .join("\n");
  const bodyXml = `${optionalBodySection(input.bodyHtml)}${longDescription.blockXml}    <qti-hotspot-interaction ${interactionAttrs}>
${optionalPromptSection(input.promptHtml)}      <object ${xmlAttributeList(objectAttrs)}/>
${choicesXml}
    </qti-hotspot-interaction>`;
  return assessmentItemShell({
    ...input,
    declarationsXml,
    bodyXml,
    responseProcessingXml: responseProcessingTemplateXml("match_correct"),
  });
}

function normalizeBound(value: number | undefined, min: number): number | null {
  if (value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  const integer = Math.trunc(value);
  if (integer === 0) return null;
  if (integer < min) return min;
  return integer;
}

export function validateQti3HotspotItem(input: Qti3HotspotBuilderInput): Qti3WriterDiagnostic[] {
  const diagnostics = validateItemBase(input);
  const responseIdentifier = resolveResponseIdentifier(input.responseIdentifier);
  const responseIdentifierDiagnostic = validateQtiIdentifier(
    "responseIdentifier",
    "Hotspot response identifier",
    responseIdentifier,
  );
  if (responseIdentifierDiagnostic) diagnostics.push(responseIdentifierDiagnostic);
  validateGraphicObject(input.object, diagnostics, {
    codePrefix: "hotspot",
    label: "Hotspot",
    path: "object",
  });
  if (!input.choices.length) {
    diagnostics.push(
      writerDiagnostic(
        "missing_hotspot_choices",
        "choices",
        "Hotspot items must include at least one choice.",
      ),
    );
  }
  diagnostics.push(
    ...duplicateDiagnostics(
      input.choices.map((choice) => choice.identifier),
      "choices",
      "Hotspot identifier",
    ),
  );
  for (const [index, choice] of input.choices.entries()) {
    validateHotspotGeometry(choice, `choices.${index}`, diagnostics, {
      identifierLabel: "Hotspot identifier",
      itemLabel: "Hotspot",
      missingCoordsCode: "missing_hotspot_coords",
      invalidShapeCode: "invalid_hotspot_shape",
    });
  }

  const maxChoices = input.maxChoices ?? 1;
  if (!isPositiveInteger(maxChoices)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_hotspot_max_choices",
        "maxChoices",
        "Hotspot maxChoices must be a positive integer.",
        input.maxChoices,
      ),
    );
  }
  if (input.minChoices !== undefined && !isNonNegativeInteger(input.minChoices)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_hotspot_min_choices",
        "minChoices",
        "Hotspot minChoices must be a non-negative integer.",
        input.minChoices,
      ),
    );
  }
  if (
    input.minChoices !== undefined &&
    Number.isFinite(input.minChoices) &&
    Number.isFinite(maxChoices) &&
    input.minChoices > maxChoices
  ) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_hotspot_choice_bounds",
        "minChoices",
        "Minimum choices must be less than or equal to maximum choices.",
        { minChoices: input.minChoices, maxChoices },
      ),
    );
  }

  const choiceIdentifiers = new Set(input.choices.map((choice) => choice.identifier.trim()));
  const correctResponse = input.correctResponse ?? [];
  diagnostics.push(
    ...duplicateDiagnostics(
      correctResponse,
      "correctResponse",
      "Hotspot correct response identifier",
    ),
  );
  const dedupedCorrectResponse = dedupeNonemptyTrimmed(correctResponse);
  if (maxChoices === 1 && dedupedCorrectResponse.length > 1) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_hotspot_correct_response_count",
        "correctResponse",
        "Single-response hotspot items can only have one correct selection.",
        dedupedCorrectResponse,
      ),
    );
  }
  for (const [index, identifier] of dedupedCorrectResponse.entries()) {
    const identifierDiagnostic = validateQtiIdentifier(
      `correctResponse.${index}`,
      "Hotspot correct response identifier",
      identifier,
    );
    if (identifierDiagnostic) {
      diagnostics.push(identifierDiagnostic);
      continue;
    }
    if (!choiceIdentifiers.has(identifier)) {
      diagnostics.push(
        writerDiagnostic(
          "unknown_hotspot_reference",
          `correctResponse.${index}`,
          `Hotspot correct response references unknown choice "${identifier}".`,
          identifier,
        ),
      );
    }
  }
  return diagnostics;
}
