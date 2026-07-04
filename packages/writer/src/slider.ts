import { assertQtiIdentifier } from "./identifier.js";
import {
  throwIfDiagnostics,
  validateItemBase,
  validateQtiIdentifier,
  writerDiagnostic,
} from "./diagnostics.js";
import {
  interactionAttributeList,
  optionalBodySection,
  optionalBooleanAttribute,
  optionalPromptSection,
  resolveResponseIdentifier,
  wrapInteractionBody,
} from "./interaction-shell.js";
import {
  mapResponseProcessingXml,
  matchCorrectProcessingXml,
  responseProcessingTemplateXml,
} from "./response-processing.js";
import { assessmentItemShell } from "./shell.js";
import type {
  Qti3SliderBaseType,
  Qti3SliderBuilderInput,
  Qti3SliderScoring,
  Qti3WriterDiagnostic,
} from "./types.js";
import { xmlEscape } from "./xml.js";

export function buildQti3SliderItem(input: Qti3SliderBuilderInput): string {
  const diagnostics = validateQti3SliderItem(input);
  throwIfDiagnostics(diagnostics);
  return renderQti3SliderItem(input);
}

export function renderQti3SliderItem(input: Qti3SliderBuilderInput): string {
  const responseIdentifier = assertQtiIdentifier(
    resolveResponseIdentifier(input.responseIdentifier),
    "Slider response identifier",
  );
  const escapedResponseIdentifier = xmlEscape(responseIdentifier);
  const baseType = sliderBaseType(input);
  const scoring = sliderScoring(input);
  const declarationsXml = `  <qti-response-declaration identifier="${escapedResponseIdentifier}" cardinality="single" base-type="${baseType}">
    <qti-correct-response>
      <qti-value>${formatNumber(input.correctResponse)}</qti-value>
    </qti-correct-response>
${sliderMappingXml(input, scoring)}  </qti-response-declaration>`;
  const interactionAttrs = interactionAttributeList({
    responseIdentifier: escapedResponseIdentifier,
    sharedVocabulary: input.sharedVocabulary,
    interactionType: "slider",
    classNames: input.classNames,
    extraAttributes: [
      `lower-bound="${formatNumber(input.lowerBound)}"`,
      `upper-bound="${formatNumber(input.upperBound)}"`,
      input.step !== undefined ? `step="${formatNumber(input.step)}"` : "",
      optionalBooleanAttribute("step-label", input.stepLabel),
      input.orientation !== undefined ? `orientation="${input.orientation}"` : "",
      optionalBooleanAttribute("reverse", input.reverse),
    ],
  });
  const bodyXml = wrapInteractionBody(
    "qti-slider-interaction",
    interactionAttrs,
    optionalPromptSection(input.promptHtml),
    "",
    optionalBodySection(input.bodyHtml),
  );

  return assessmentItemShell({
    ...input,
    declarationsXml,
    bodyXml,
    responseProcessingXml: sliderResponseProcessingXml(scoring, responseIdentifier),
  });
}

export function validateQti3SliderItem(input: Qti3SliderBuilderInput): Qti3WriterDiagnostic[] {
  const diagnostics = validateItemBase(input);
  const responseIdentifier = resolveResponseIdentifier(input.responseIdentifier);
  const responseIdentifierDiagnostic = validateQtiIdentifier(
    "responseIdentifier",
    "Slider response identifier",
    responseIdentifier,
  );
  if (responseIdentifierDiagnostic) diagnostics.push(responseIdentifierDiagnostic);
  validateBounds(input, diagnostics);
  validateCorrectResponse(input, diagnostics);
  validateMappings(input, diagnostics);
  return diagnostics;
}

function sliderMappingXml(input: Qti3SliderBuilderInput, scoring: Qti3SliderScoring): string {
  if (scoring !== "map_response") return "";
  const mappings = input.mappings ?? [];
  if (!mappings.length) return "";
  return `    <qti-mapping default-value="0">
${mappings
  .map(
    (entry) =>
      `      <qti-map-entry map-key="${formatNumber(entry.mapKey)}" mapped-value="${formatNumber(
        entry.mappedValue,
      )}"/>`,
  )
  .join("\n")}
    </qti-mapping>
`;
}

function sliderResponseProcessingXml(
  scoring: Qti3SliderScoring,
  responseIdentifier: string,
): string {
  if (responseIdentifier === "RESPONSE") return responseProcessingTemplateXml(scoring);
  return scoring === "map_response"
    ? mapResponseProcessingXml(responseIdentifier)
    : matchCorrectProcessingXml(responseIdentifier);
}

function sliderScoring(input: Qti3SliderBuilderInput): Qti3SliderScoring {
  return input.scoring ?? (input.mappings?.length ? "map_response" : "match_correct");
}

function sliderBaseType(input: Qti3SliderBuilderInput): Qti3SliderBaseType {
  if (input.baseType) return input.baseType;
  const values = [
    input.lowerBound,
    input.upperBound,
    input.step ?? 1,
    input.correctResponse,
    ...(input.mappings ?? []).map((entry) => entry.mapKey),
  ];
  return values.every(isWholeNumber) ? "integer" : "float";
}

function validateBounds(input: Qti3SliderBuilderInput, diagnostics: Qti3WriterDiagnostic[]): void {
  if (!Number.isFinite(input.lowerBound)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_slider_lower_bound",
        "lowerBound",
        "Slider lowerBound must be a finite number.",
        input.lowerBound,
      ),
    );
  }
  if (!Number.isFinite(input.upperBound)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_slider_upper_bound",
        "upperBound",
        "Slider upperBound must be a finite number.",
        input.upperBound,
      ),
    );
  }
  if (
    Number.isFinite(input.lowerBound) &&
    Number.isFinite(input.upperBound) &&
    input.lowerBound >= input.upperBound
  ) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_slider_bounds",
        "lowerBound|upperBound",
        "Slider lowerBound must be less than upperBound.",
        { lowerBound: input.lowerBound, upperBound: input.upperBound },
      ),
    );
  }
  if (input.step !== undefined && (!Number.isFinite(input.step) || input.step <= 0)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_slider_step",
        "step",
        "Slider step must be a positive finite number when provided.",
        input.step,
      ),
    );
  }
  validateIntegerBaseTypeValue(input, input.lowerBound, "lowerBound", diagnostics);
  validateIntegerBaseTypeValue(input, input.upperBound, "upperBound", diagnostics);
  if (input.step !== undefined) {
    validateIntegerBaseTypeValue(input, input.step, "step", diagnostics);
  }
}

function validateCorrectResponse(
  input: Qti3SliderBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  if (!Number.isFinite(input.correctResponse)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_slider_correct_response",
        "correctResponse",
        "Slider correctResponse must be a finite number.",
        input.correctResponse,
      ),
    );
    return;
  }
  if (
    Number.isFinite(input.lowerBound) &&
    Number.isFinite(input.upperBound) &&
    (input.correctResponse < input.lowerBound || input.correctResponse > input.upperBound)
  ) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_slider_correct_response_bounds",
        "correctResponse",
        "Slider correctResponse must be within lowerBound and upperBound.",
        input.correctResponse,
      ),
    );
  }
  validateIntegerBaseTypeValue(input, input.correctResponse, "correctResponse", diagnostics);
}

function validateMappings(
  input: Qti3SliderBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  if (sliderScoring(input) === "map_response" && !(input.mappings ?? []).length) {
    diagnostics.push(
      writerDiagnostic(
        "missing_slider_mappings",
        "mappings",
        "Slider map_response scoring requires at least one mapping entry.",
      ),
    );
  }
  const seenMapKeys = new Set<string>();
  const duplicateMapKeys = new Set<string>();
  for (const [index, entry] of (input.mappings ?? []).entries()) {
    const mapKeyPath = `mappings.${index}.mapKey`;
    if (!Number.isFinite(entry.mapKey)) {
      diagnostics.push(
        writerDiagnostic(
          "invalid_slider_map_key",
          mapKeyPath,
          "Slider mapping mapKey must be a finite number.",
          entry.mapKey,
        ),
      );
    } else {
      const key = formatNumber(entry.mapKey);
      if (seenMapKeys.has(key)) duplicateMapKeys.add(key);
      else seenMapKeys.add(key);
      validateIntegerBaseTypeValue(input, entry.mapKey, mapKeyPath, diagnostics);
    }
    if (!Number.isFinite(entry.mappedValue)) {
      diagnostics.push(
        writerDiagnostic(
          "invalid_slider_mapped_value",
          `mappings.${index}.mappedValue`,
          "Slider mapping mappedValue must be a finite number.",
          entry.mappedValue,
        ),
      );
    }
  }
  for (const mapKey of duplicateMapKeys) {
    diagnostics.push(
      writerDiagnostic(
        "duplicate_slider_map_key",
        "mappings",
        `Slider mapping mapKey "${mapKey}" must be unique.`,
        mapKey,
      ),
    );
  }
}

function validateIntegerBaseTypeValue(
  input: Qti3SliderBuilderInput,
  value: number,
  path: string,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  if (sliderBaseType(input) !== "integer" || !Number.isFinite(value) || isWholeNumber(value))
    return;
  diagnostics.push(
    writerDiagnostic(
      "invalid_slider_integer_value",
      path,
      "Slider integer baseType requires whole-number bounds, step, correctResponse, and mapping keys.",
      value,
    ),
  );
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? String(value) : "";
}

function isWholeNumber(value: number): boolean {
  return Number.isFinite(value) && Math.trunc(value) === value;
}
