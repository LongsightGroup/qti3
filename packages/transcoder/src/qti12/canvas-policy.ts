import { accessibleChoiceLabel } from "../rich-content-html.js";
import { choiceCondition } from "./scoring.js";
import {
  choiceResponse,
  manualExtendedTextQti12Response,
  sequenceAsMatchResponse,
} from "./responses.js";
import { qti12Identifier } from "./shared.js";
import { isCanvasQti12Dialect, type Qti12MapContext, type Qti12Response } from "./types.js";

/**
 * Policy-driven Canvas wire overrides applied before the native interaction registry.
 * Matching and presentation are encoded on the interaction policy, not a product overlay.
 */
export function applyCanvasPolicy(context: Qti12MapContext): Qti12Response | undefined {
  if (!isCanvasQti12Dialect(context.dialect)) return undefined;

  if (context.policy.transformation === "matching-fallback") {
    return sequenceAsMatchResponse(context);
  }

  if (context.policy.transformation === "presentation") {
    return {
      identifier: context.identifier,
      xml: "",
      correct: [],
      scoring: "manual",
      emitted: "presentation",
      processingXml: "",
      diagnostics: context.policy.diagnostic
        ? [
            {
              ...context.policy.diagnostic,
              severity: "info",
              path: context.sourcePath,
            },
          ]
        : [],
    };
  }

  return undefined;
}

export function applyCanvasHotspotPolicy(context: Qti12MapContext): Qti12Response | undefined {
  if (
    !isCanvasQti12Dialect(context.dialect) ||
    context.interaction.type !== "hotspot" ||
    context.correct.length <= 1
  ) {
    return undefined;
  }

  const hotspotChoices = context.interaction.choices.filter((choice) => choice.role === "hotspot");
  if (
    hotspotChoices.length === 0 ||
    hotspotChoices.some((choice) => accessibleChoiceLabel(choice) === undefined)
  ) {
    return manualExtendedTextQti12Response(
      context,
      "Describe all regions that satisfy the question.",
    );
  }

  return {
    identifier: context.identifier,
    xml: choiceResponse(context.identifier, context.interaction, hotspotChoices, context.dialect),
    correct: context.correct,
    scoring: "automatic",
    fallback: "choice",
    emitted: "response_lid",
    processingXml: choiceCondition(
      context.identifier,
      context.correct,
      hotspotChoices.map((choice) => qti12Identifier(choice.identifier)),
      "multiple",
      context.dialect,
    ),
    diagnostics: [context.fallbackDiagnostic("choice")],
  };
}
