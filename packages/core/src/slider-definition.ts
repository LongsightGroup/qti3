import { parseXmlBoolean } from "./parser-values.js";
import type { QtiDiagnostic, QtiInteraction } from "./types.js";

/** The axis used to present a refined QTI slider interaction. */
export type QtiSliderOrientation = "horizontal" | "vertical";

/** The movement policy for a refined QTI slider interaction. */
export type QtiSliderStep =
  | { readonly kind: "continuous" }
  | { readonly kind: "discrete"; readonly value: number };

/** A validated slider value domain and presentation policy. */
export interface QtiSliderDefinition {
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

function diagnostic(interaction: QtiInteraction, code: string, message: string): QtiDiagnostic {
  return {
    code,
    severity: "error",
    message,
    path: interaction.source?.path,
    source: interaction.source,
  };
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
  responseBaseType: "integer" | "float",
  diagnostics: QtiDiagnostic[],
): QtiSliderStep {
  const raw = interaction.attributes.step;
  if (raw === undefined && responseBaseType === "float") return { kind: "continuous" };
  if (raw === undefined) return { kind: "discrete", value: 1 };

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    diagnostics.push(
      diagnostic(
        interaction,
        "interaction.numericAttribute",
        `${interaction.qtiName} requires positive numeric step, got ${raw}.`,
      ),
    );
    return { kind: "discrete", value: 1 };
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
  const responseBaseType = interaction.responseBaseType;

  if (responseBaseType !== "integer" && responseBaseType !== "float") {
    if (responseBaseType !== undefined) {
      diagnostics.push(
        diagnostic(
          interaction,
          "interaction.baseType",
          `${interaction.qtiName} expects integer or float base type, got ${responseBaseType}.`,
        ),
      );
    }
    return { ok: false, diagnostics };
  }

  const step = sliderStep(interaction, responseBaseType, diagnostics);
  if (lower !== undefined && upper !== undefined && lower >= upper) {
    diagnostics.push(
      diagnostic(
        interaction,
        "interaction.slider.bounds",
        `${interaction.qtiName} requires lower-bound to be less than upper-bound.`,
      ),
    );
  }
  if (diagnostics.length > 0 || lower === undefined || upper === undefined) {
    return { ok: false, diagnostics };
  }

  return {
    ok: true,
    value: {
      lowerBound: responseBaseType === "integer" ? Math.floor(lower) : lower,
      upperBound: responseBaseType === "integer" ? Math.ceil(upper) : upper,
      step,
      orientation,
      reverse,
      stepLabels,
      responseBaseType,
    },
  };
}
