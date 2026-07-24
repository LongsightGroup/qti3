import type { QtiInteractionType } from "@longsightgroup/qti3-core";

import { canvasAccessibleChoiceLabel } from "../qti12-canvas.js";
import { choiceCondition } from "./scoring.js";
import {
  choiceResponse,
  extendedTextResponse,
  manualExtendedTextResponse,
  sequenceAsMatchResponse,
} from "./responses.js";
import { manualInstructionFor, qti12Identifier } from "./shared.js";
import type { Qti12MapContext, Qti12Response } from "./types.js";

/** Canvas Classic overrides applied before the interaction registry. */
export function applyCanvasClassicPolicy(context: Qti12MapContext): Qti12Response | undefined {
  if (context.dialect !== "canvas-classic") return undefined;

  if (context.interaction.type === "associate") {
    return manualExtendedTextResponse(context);
  }

  if (context.interaction.type === "graphicOrder" || context.interaction.type === "order") {
    return sequenceAsMatchResponse(context);
  }

  if (context.interaction.type === "upload") {
    return {
      identifier: context.identifier,
      xml: "",
      correct: [],
      scoring: "manual",
      emitted: "presentation",
      processingXml: "",
      diagnostics: [
        {
          code: "profile.canvas.classic.upload",
          severity: "info",
          message: "Mapped the QTI upload task to a Canvas Classic file-upload question.",
          path: context.sourcePath,
        },
      ],
    };
  }

  return undefined;
}

export function applyCanvasClassicHotspotPolicy(
  context: Qti12MapContext,
): Qti12Response | undefined {
  if (
    context.dialect !== "canvas-classic" ||
    context.interaction.type !== "hotspot" ||
    context.correct.length <= 1
  ) {
    return undefined;
  }

  const hotspotChoices = context.interaction.choices.filter((choice) => choice.role === "hotspot");
  if (
    hotspotChoices.length === 0 ||
    hotspotChoices.some((choice) => canvasAccessibleChoiceLabel(choice) === undefined)
  ) {
    return manualExtendedTextResponse(context, "Describe all regions that satisfy the question.");
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

export function manualFallbackResponse(context: Qti12MapContext): Qti12Response {
  return {
    identifier: context.identifier,
    xml:
      context.dialect === "canvas-classic" && context.interaction.type === "upload"
        ? ""
        : extendedTextResponse(
            context.identifier,
            manualInstructionFor(context.interaction),
            context.dialect,
          ),
    correct: [],
    scoring: "manual",
    fallback: context.policy.fallback ?? "extended-text",
    emitted: "response_str",
    processingXml: "",
    diagnostics: [context.fallbackDiagnostic(context.policy.fallback ?? "extended-text")],
  };
}

export const MANUAL_FALLBACK_TYPES = new Set<QtiInteractionType>([
  "custom",
  "drawing",
  "endAttempt",
  "media",
  "portableCustom",
  "upload",
]);
