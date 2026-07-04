import { assertQtiIdentifier } from "./identifier.js";
import {
  dedupeNonemptyTrimmed,
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
import {
  interactionAttributeList,
  optionalBodySection,
  optionalPromptSection,
  resolveResponseIdentifier,
} from "./interaction-shell.js";
import { responseProcessingTemplateXml } from "./response-processing.js";
import { assessmentItemShell } from "./shell.js";
import type { Qti3GraphicOrderBuilderInput, Qti3WriterDiagnostic } from "./types.js";
import { xmlAttributeList, xmlEscape } from "./xml.js";

export function buildQti3GraphicOrderItem(input: Qti3GraphicOrderBuilderInput): string {
  const diagnostics = validateQti3GraphicOrderItem(input);
  throwIfDiagnostics(diagnostics);
  return renderQti3GraphicOrderItem(input);
}

export function renderQti3GraphicOrderItem(input: Qti3GraphicOrderBuilderInput): string {
  const responseIdentifier = assertQtiIdentifier(
    resolveResponseIdentifier(input.responseIdentifier),
    "Graphic order response identifier",
  );
  const escapedResponseIdentifier = xmlEscape(responseIdentifier);
  const correctOrder = resolvedCorrectOrder(input).map((value) =>
    assertQtiIdentifier(value, "Graphic order correct identifier"),
  );
  const declarationsXml = `  <qti-response-declaration identifier="${escapedResponseIdentifier}" cardinality="ordered" base-type="identifier">
    <qti-correct-response>
${correctOrder.map((value) => `      <qti-value>${xmlEscape(value)}</qti-value>`).join("\n")}
    </qti-correct-response>
  </qti-response-declaration>`;
  const longDescription = optionalLongDescriptionBlock(
    input.identifier,
    input.object.longDescription,
  );
  const interactionAttrs = interactionAttributeList({
    responseIdentifier: escapedResponseIdentifier,
    sharedVocabulary: input.sharedVocabulary,
    interactionType: "graphicOrder",
    classNames: input.classNames,
    extraAttributes: [
      input.minChoices !== undefined ? `min-choices="${String(input.minChoices)}"` : "",
      input.maxChoices !== undefined ? `max-choices="${String(input.maxChoices)}"` : "",
      longDescription.attributeXml,
    ],
  });
  const hotspotsXml = input.hotspots
    .map((hotspot) => {
      const identifier = xmlEscape(
        assertQtiIdentifier(hotspot.identifier, "Graphic order hotspot identifier"),
      );
      const attrs = [
        `identifier="${identifier}"`,
        `shape="${hotspot.shape}"`,
        `coords="${xmlEscape(hotspot.coords.trim())}"`,
        hotspot.hotspotLabel?.trim()
          ? `hotspot-label="${xmlEscape(hotspot.hotspotLabel.trim())}"`
          : "",
      ];
      return `      <qti-hotspot-choice ${xmlAttributeList(attrs)}/>`;
    })
    .join("\n");
  const bodyXml = `${optionalBodySection(input.bodyHtml)}${longDescription.blockXml}    <qti-graphic-order-interaction ${interactionAttrs}>
${optionalPromptSection(input.promptHtml)}      <object ${xmlAttributeList(renderGraphicObjectAttributes(input.object))}/>
${hotspotsXml}
    </qti-graphic-order-interaction>`;

  return assessmentItemShell({
    ...input,
    declarationsXml,
    bodyXml,
    responseProcessingXml: responseProcessingTemplateXml("match_correct"),
  });
}

export function validateQti3GraphicOrderItem(
  input: Qti3GraphicOrderBuilderInput,
): Qti3WriterDiagnostic[] {
  const diagnostics = validateItemBase(input);
  const responseIdentifier = resolveResponseIdentifier(input.responseIdentifier);
  const responseIdentifierDiagnostic = validateQtiIdentifier(
    "responseIdentifier",
    "Graphic order response identifier",
    responseIdentifier,
  );
  if (responseIdentifierDiagnostic) diagnostics.push(responseIdentifierDiagnostic);
  validateGraphicObject(input.object, diagnostics, {
    codePrefix: "graphic_order",
    label: "Graphic order",
    path: "object",
  });
  validateHotspots(input, diagnostics);
  validateChoiceBounds(input, diagnostics);
  validateCorrectOrder(input, diagnostics);
  return diagnostics;
}

function validateHotspots(
  input: Qti3GraphicOrderBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  if (input.hotspots.length < 2) {
    diagnostics.push(
      writerDiagnostic(
        "missing_graphic_order_hotspots",
        "hotspots",
        "Graphic order items must include at least two hotspots.",
      ),
    );
  }
  diagnostics.push(
    ...duplicateDiagnostics(
      input.hotspots.map((hotspot) => hotspot.identifier),
      "hotspots",
      "Graphic order hotspot identifier",
    ),
  );
  for (const [index, hotspot] of input.hotspots.entries()) {
    validateHotspotGeometry(hotspot, `hotspots.${index}`, diagnostics, {
      identifierLabel: "Graphic order hotspot identifier",
      itemLabel: "Graphic order hotspot",
      missingCoordsCode: "missing_graphic_order_coords",
      invalidShapeCode: "invalid_graphic_order_shape",
    });
  }
}

function validateChoiceBounds(
  input: Qti3GraphicOrderBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  if (input.minChoices !== undefined && !isNonNegativeInteger(input.minChoices)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_graphic_order_min_choices",
        "minChoices",
        "Graphic order minChoices must be a non-negative integer.",
        input.minChoices,
      ),
    );
  }
  if (input.maxChoices !== undefined && !isNonNegativeInteger(input.maxChoices)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_graphic_order_max_choices",
        "maxChoices",
        "Graphic order maxChoices must be a non-negative integer.",
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
        "invalid_graphic_order_bounds",
        "minChoices|maxChoices",
        "Graphic order minChoices must be less than or equal to maxChoices unless maxChoices is 0.",
        { minChoices: input.minChoices, maxChoices: input.maxChoices },
      ),
    );
  }
  if (input.maxChoices !== undefined && input.maxChoices > input.hotspots.length) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_graphic_order_max_choices",
        "maxChoices",
        "Graphic order maxChoices cannot exceed hotspot count.",
        { maxChoices: input.maxChoices, hotspots: input.hotspots.length },
      ),
    );
  }
}

function validateCorrectOrder(
  input: Qti3GraphicOrderBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  const order = input.correctOrder ?? [];
  diagnostics.push(
    ...duplicateDiagnostics(order, "correctOrder", "Graphic order correct response identifier"),
  );
  const hotspotIdentifiers = new Set(input.hotspots.map((hotspot) => hotspot.identifier.trim()));
  const correctOrder = dedupeNonemptyTrimmed(order);
  if (
    order.length > 0 &&
    !allowsSubsetOrdering(input) &&
    !sameIdentifierSet(correctOrder, hotspotIdentifiers)
  ) {
    diagnostics.push(
      writerDiagnostic(
        "incomplete_graphic_order_correct_order",
        "correctOrder",
        "Graphic order correctOrder must include every hotspot unless minChoices or maxChoices configures subset ordering.",
        correctOrder,
      ),
    );
  }
  for (const [index, identifier] of correctOrder.entries()) {
    const identifierDiagnostic = validateQtiIdentifier(
      `correctOrder.${index}`,
      "Graphic order correct response identifier",
      identifier,
    );
    if (identifierDiagnostic) {
      diagnostics.push(identifierDiagnostic);
      continue;
    }
    if (!hotspotIdentifiers.has(identifier)) {
      diagnostics.push(
        writerDiagnostic(
          "unknown_graphic_order_reference",
          `correctOrder.${index}`,
          `Graphic order correct response references unknown hotspot "${identifier}".`,
          identifier,
        ),
      );
    }
  }
}

function resolvedCorrectOrder(input: Qti3GraphicOrderBuilderInput): string[] {
  const order = dedupeNonemptyTrimmed(input.correctOrder ?? []);
  return order.length ? order : input.hotspots.map((hotspot) => hotspot.identifier.trim());
}

function allowsSubsetOrdering(input: Qti3GraphicOrderBuilderInput): boolean {
  if (input.minChoices !== undefined && input.minChoices < input.hotspots.length) return true;
  if (
    input.maxChoices !== undefined &&
    input.maxChoices > 0 &&
    input.maxChoices < input.hotspots.length
  ) {
    return true;
  }
  return false;
}

function sameIdentifierSet(values: readonly string[], expected: ReadonlySet<string>): boolean {
  const valueSet = new Set(values.map((value) => value.trim()).filter(Boolean));
  if (valueSet.size !== expected.size) return false;
  for (const identifier of expected) {
    if (!valueSet.has(identifier)) return false;
  }
  return true;
}
