import { parseXmlBoolean } from "./parser-values.js";
import type { QtiDiagnostic, QtiInteraction } from "./types.js";

declare const qtiSliderDefinitionBrand: unique symbol;

/** The axis used to present a refined QTI slider interaction. */
export type QtiSliderOrientation = "horizontal" | "vertical";

/** The movement policy and interval shape for a refined QTI slider interaction. */
export type QtiSliderStep =
  | { readonly kind: "continuous" }
  | {
      readonly kind: "aligned";
      readonly value: number;
      readonly intervalCount: number;
    }
  | {
      readonly kind: "detachedUpper";
      readonly value: number;
      readonly regularIntervalCount: number;
    };

/** A validated slider value domain and presentation policy. */
export interface QtiSliderDefinition {
  readonly [qtiSliderDefinitionBrand]: true;
  readonly lowerBound: number;
  readonly upperBound: number;
  readonly step: QtiSliderStep;
  readonly orientation: QtiSliderOrientation;
  readonly reverse: boolean;
  readonly stepLabels: boolean;
  readonly responseBaseType: "integer" | "float";
}

/** The typed result of refining raw slider interaction attributes. */
export type QtiSliderDefinitionResult =
  | { readonly ok: true; readonly value: QtiSliderDefinition }
  | { readonly ok: false; readonly diagnostics: readonly QtiDiagnostic[] };

/** The reason a candidate value does not belong to a refined slider domain. */
export type QtiSliderValueFailureReason =
  | "notNumeric"
  | "notInteger"
  | "outsideBounds"
  | "outsideStepSequence";

/** The typed result of parsing a candidate value against a refined slider domain. */
export type QtiSliderValueResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly reason: QtiSliderValueFailureReason };

type ParsedSliderStep =
  | { readonly kind: "continuous" }
  | { readonly kind: "discrete"; readonly value: number };

const MAX_REGULAR_INTERVAL_COUNT = Number.MAX_SAFE_INTEGER - 2;

function diagnostic(interaction: QtiInteraction, code: string, message: string): QtiDiagnostic {
  return {
    code,
    severity: "error",
    message,
    path: interaction.source?.path,
    source: interaction.source,
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function decimalPlaces(value: number): number {
  const [coefficient = "", exponentText] = String(value).toLowerCase().split("e");
  const fractionLength = coefficient.split(".")[1]?.length ?? 0;
  const exponent = Number(exponentText ?? "0");
  return Math.max(0, fractionLength - exponent);
}

function steppedValue(lowerBound: number, step: number, index: number): number {
  const value = lowerBound + index * step;
  if (value === 0) return 0;
  const decimalPrecision = Math.max(decimalPlaces(lowerBound), decimalPlaces(step));
  const integerDigits = Math.floor(Math.log10(Math.abs(value))) + 1;
  const significantDigits = Math.min(100, Math.max(1, integerDigits + decimalPrecision));
  return Number(value.toPrecision(significantDigits));
}

function discreteStep(
  interaction: QtiInteraction,
  lowerBound: number,
  upperBound: number,
  step: number,
  diagnostics: QtiDiagnostic[],
): QtiSliderStep | undefined {
  const intervalRatio = (upperBound - lowerBound) / step;
  const nearestInteger = Math.round(intervalRatio);
  const canTestAlignedUpper =
    Number.isSafeInteger(nearestInteger) && nearestInteger <= MAX_REGULAR_INTERVAL_COUNT;
  const alignedUpper =
    canTestAlignedUpper && steppedValue(lowerBound, step, nearestInteger) === upperBound;
  const regularIntervalCount = alignedUpper ? nearestInteger : Math.floor(intervalRatio);
  if (
    !Number.isSafeInteger(regularIntervalCount) ||
    regularIntervalCount > MAX_REGULAR_INTERVAL_COUNT ||
    (regularIntervalCount > 0 && steppedValue(lowerBound, step, 1) === lowerBound)
  ) {
    diagnostics.push(
      diagnostic(
        interaction,
        "interaction.slider.resolution",
        `${interaction.qtiName} step ${step} cannot be represented safely across bounds ${lowerBound} to ${upperBound}.`,
      ),
    );
    return undefined;
  }
  if (alignedUpper) {
    return { kind: "aligned", value: step, intervalCount: regularIntervalCount };
  }
  return { kind: "detachedUpper", value: step, regularIntervalCount };
}

function requiredNumber(
  interaction: QtiInteraction,
  attribute: "lower-bound" | "upper-bound",
  missingCode: string,
  diagnostics: QtiDiagnostic[],
): number | undefined {
  const raw = interaction.attributes[attribute];
  if (raw === undefined || raw.trim() === "") {
    diagnostics.push(
      diagnostic(interaction, missingCode, `${interaction.qtiName} requires ${attribute}.`),
    );
    return undefined;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    diagnostics.push(
      diagnostic(
        interaction,
        "interaction.numericAttribute",
        `${interaction.qtiName} requires non-negative numeric ${attribute}, got ${raw}.`,
      ),
    );
    return undefined;
  }
  return value;
}

function optionalBoolean(
  interaction: QtiInteraction,
  attribute: "reverse" | "step-label",
  diagnostics: QtiDiagnostic[],
): boolean {
  const raw = interaction.attributes[attribute];
  if (raw === undefined) return false;
  const value = parseXmlBoolean(raw);
  if (value !== undefined) return value;
  diagnostics.push(
    diagnostic(
      interaction,
      "interaction.booleanAttribute",
      `${interaction.qtiName} requires boolean ${attribute}, got ${raw}.`,
    ),
  );
  return false;
}

function sliderOrientation(
  interaction: QtiInteraction,
  diagnostics: QtiDiagnostic[],
): QtiSliderOrientation {
  const raw = interaction.attributes.orientation;
  if (raw === undefined || raw === "horizontal") return "horizontal";
  if (raw === "vertical") return "vertical";
  diagnostics.push(
    diagnostic(
      interaction,
      "interaction.slider.orientation",
      `${interaction.qtiName} requires horizontal or vertical orientation, got ${raw}.`,
    ),
  );
  return "horizontal";
}

function sliderStep(
  interaction: QtiInteraction,
  responseBaseType: "integer" | "float" | undefined,
  diagnostics: QtiDiagnostic[],
): ParsedSliderStep | undefined {
  const raw = interaction.attributes.step;
  if (raw === undefined) {
    if (responseBaseType === "float") return { kind: "continuous" };
    if (responseBaseType === "integer") return { kind: "discrete", value: 1 };
    return undefined;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    diagnostics.push(
      diagnostic(
        interaction,
        "interaction.numericAttribute",
        `${interaction.qtiName} requires positive numeric step, got ${raw}.`,
      ),
    );
    return undefined;
  }
  if (responseBaseType === "integer" && !Number.isInteger(value)) {
    diagnostics.push(
      diagnostic(
        interaction,
        "interaction.slider.integerStep",
        `${interaction.qtiName} requires an integer step when its response has integer base type, got ${raw}.`,
      ),
    );
  }
  return { kind: "discrete", value };
}

function sliderResponseBaseType(
  interaction: QtiInteraction,
  diagnostics: QtiDiagnostic[],
): "integer" | "float" | undefined {
  const baseType = interaction.responseBaseType;
  if (baseType === "integer" || baseType === "float") return baseType;
  diagnostics.push(
    diagnostic(
      interaction,
      "interaction.baseType",
      baseType === undefined
        ? `${interaction.qtiName} requires an integer or float response base type.`
        : `${interaction.qtiName} expects integer or float base type, got ${baseType}.`,
    ),
  );
  return undefined;
}

/**
 * Refines raw QTI slider attributes into the single value model shared by validation and players.
 */
export function parseQtiSliderDefinition(interaction: QtiInteraction): QtiSliderDefinitionResult {
  const diagnostics: QtiDiagnostic[] = [];
  const lower = requiredNumber(
    interaction,
    "lower-bound",
    "interaction.slider.lowerBound",
    diagnostics,
  );
  const upper = requiredNumber(
    interaction,
    "upper-bound",
    "interaction.slider.upperBound",
    diagnostics,
  );
  const orientation = sliderOrientation(interaction, diagnostics);
  const reverse = optionalBoolean(interaction, "reverse", diagnostics);
  const stepLabels = optionalBoolean(interaction, "step-label", diagnostics);
  const sliderBaseType = sliderResponseBaseType(interaction, diagnostics);
  const parsedStep = sliderStep(interaction, sliderBaseType, diagnostics);

  if (lower !== undefined && upper !== undefined && lower >= upper) {
    diagnostics.push(
      diagnostic(
        interaction,
        "interaction.slider.bounds",
        `${interaction.qtiName} requires lower-bound to be less than upper-bound.`,
      ),
    );
  }
  if (
    diagnostics.length > 0 ||
    lower === undefined ||
    upper === undefined ||
    parsedStep === undefined ||
    sliderBaseType === undefined
  ) {
    return { ok: false, diagnostics };
  }

  const lowerBound = sliderBaseType === "integer" ? Math.floor(lower) : lower;
  const upperBound = sliderBaseType === "integer" ? Math.ceil(upper) : upper;
  const step =
    parsedStep.kind === "continuous"
      ? parsedStep
      : discreteStep(interaction, lowerBound, upperBound, parsedStep.value, diagnostics);
  if (step === undefined) return { ok: false, diagnostics };
  const definition = {
    lowerBound,
    upperBound,
    step,
    orientation,
    reverse,
    stepLabels,
    responseBaseType: sliderBaseType,
  };
  // SAFETY: every slider invariant is established above before the definition is branded.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: callers cannot create the brand directly.
  return { ok: true, value: definition as QtiSliderDefinition };
}

/** Returns the normalized position of a slider value between the authored bounds. */
export function qtiSliderRatio(value: number, definition: QtiSliderDefinition): number {
  return clamp(
    (value - definition.lowerBound) / (definition.upperBound - definition.lowerBound),
    0,
    1,
  );
}

/** Returns the discrete value at a regular step index, or the lower bound for a continuous slider. */
export function qtiSliderDiscreteValue(definition: QtiSliderDefinition, index: number): number {
  if (definition.step.kind === "continuous") return definition.lowerBound;
  if (definition.step.kind === "aligned" && index === definition.step.intervalCount) {
    return definition.upperBound;
  }
  return steppedValue(definition.lowerBound, definition.step.value, index);
}

/** Snaps a raw value to the closest authored slider value. */
export function snapQtiSliderValue(value: number, definition: QtiSliderDefinition): number {
  const clampedValue = clamp(value, definition.lowerBound, definition.upperBound);
  if (definition.step.kind === "continuous") return clampedValue;

  const regularIntervalCount =
    definition.step.kind === "aligned"
      ? definition.step.intervalCount
      : definition.step.regularIntervalCount;
  const regularIndex = clamp(
    Math.round((clampedValue - definition.lowerBound) / definition.step.value),
    0,
    regularIntervalCount,
  );
  const regularValue = qtiSliderDiscreteValue(definition, regularIndex);
  if (definition.step.kind === "aligned") return regularValue;
  return Math.abs(definition.upperBound - clampedValue) < Math.abs(regularValue - clampedValue)
    ? definition.upperBound
    : regularValue;
}

/** Parses an unknown candidate value against a refined QTI slider domain. */
export function parseQtiSliderValue(
  input: unknown,
  definition: QtiSliderDefinition,
): QtiSliderValueResult {
  const value =
    typeof input === "number"
      ? input
      : typeof input === "string" && input.trim() !== ""
        ? Number(input)
        : Number.NaN;
  if (!Number.isFinite(value)) return { ok: false, reason: "notNumeric" };
  if (definition.responseBaseType === "integer" && !Number.isInteger(value)) {
    return { ok: false, reason: "notInteger" };
  }
  if (value < definition.lowerBound || value > definition.upperBound) {
    return { ok: false, reason: "outsideBounds" };
  }
  if (definition.step.kind !== "continuous" && snapQtiSliderValue(value, definition) !== value) {
    return { ok: false, reason: "outsideStepSequence" };
  }
  return { ok: true, value };
}
