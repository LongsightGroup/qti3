import type { QtiChoice, QtiInteractionType } from "@longsightgroup/qti3-core";

import { interactionPolicyFallback } from "../profiles.js";
import { areaCondition, choiceCondition } from "./scoring.js";
import {
  associateResponse,
  choiceCardinality,
  choiceResponse,
  extendedTextResponse,
  hotspotResponse,
  matchResponse,
  pairChoiceResponse,
  serializeCanvasHotspot,
  textEntryResponse,
} from "./responses.js";
import { qti12Area, qti12Identifier } from "./shared.js";
import { isCanvasQti12Dialect, type Qti12MapContext, type Qti12Response } from "./types.js";

export type Qti12InteractionMapper = (context: Qti12MapContext) => Qti12Response;

/** Native QTI 1.2 mappers invoked after policy dispatch selects a wire-native transformation. */
export const NATIVE_INTERACTION_MAPPERS: Readonly<
  Partial<Record<QtiInteractionType, Qti12InteractionMapper>>
> = {
  match: (context) =>
    matchResponse(context.interaction, context.correct, context.sourcePath, context.dialect),
  associate: (context) =>
    associateResponse(context.interaction, context.identifier, context.sourcePath),
  gapMatch: (context) =>
    pairChoiceResponse(
      context.interaction,
      context.identifier,
      context.correct,
      context.sourcePath,
      context.dialect,
    ),
  graphicAssociate: (context) =>
    pairChoiceResponse(
      context.interaction,
      context.identifier,
      context.correct,
      context.sourcePath,
      context.dialect,
    ),
  graphicGapMatch: (context) =>
    pairChoiceResponse(
      context.interaction,
      context.identifier,
      context.correct,
      context.sourcePath,
      context.dialect,
    ),
  choice: mapChoiceFamily,
  order: mapChoiceFamily,
  hottext: mapChoiceFamily,
  inlineChoice: mapChoiceFamily,
  hotspot: mapHotspotFamily,
  graphicOrder: mapHotspotFamily,
  textEntry: textEntryResponse,
  slider: textEntryResponse,
  selectPoint: textEntryResponse,
  positionObject: textEntryResponse,
  extendedText: (context) => ({
    identifier: context.identifier,
    xml: extendedTextResponse(context.identifier, "", context.dialect),
    correct: [],
    scoring: "manual",
    emitted: "response_str",
    processingXml: "",
    diagnostics: [],
  }),
};

function mapChoiceFamily(context: Qti12MapContext): Qti12Response {
  return {
    identifier: context.identifier,
    xml: choiceResponse(
      context.identifier,
      context.interaction,
      context.interaction.choices,
      context.dialect,
    ),
    correct: context.correct,
    scoring: context.correct.length > 0 ? "automatic" : "unscored",
    fallback: interactionPolicyFallback(context.policy),
    emitted: "response_lid",
    processingXml: choiceCondition(
      context.identifier,
      context.correct,
      context.interaction.choices.map((choice) => qti12Identifier(choice.identifier)),
      choiceCardinality(context.interaction),
      context.dialect,
    ),
    diagnostics:
      context.policy.fidelity === "lossy"
        ? [context.fallbackDiagnostic(interactionPolicyFallback(context.policy) ?? "choice")]
        : [],
  };
}

function mapHotspotFamily(context: Qti12MapContext): Qti12Response {
  const hotspotChoices = context.interaction.choices.filter((choice) => choice.role === "hotspot");
  return {
    identifier: context.identifier,
    xml:
      isCanvasQti12Dialect(context.dialect) && context.interaction.type === "hotspot"
        ? serializeCanvasHotspot(context.identifier, context.interaction, context.correct)
        : hotspotResponse(context.identifier, context.interaction),
    correct: context.correct,
    scoring: context.correct.length > 0 ? "automatic" : "unscored",
    emitted: "response_lid",
    processingXml:
      isCanvasQti12Dialect(context.dialect) && context.interaction.type === "hotspot"
        ? canvasHotspotProcessing(
            context.identifier,
            context.correct,
            hotspotChoices,
            context.dialect,
          )
        : choiceCondition(
            context.identifier,
            context.correct,
            hotspotChoices.map((choice) => qti12Identifier(choice.identifier)),
            context.interaction.type === "graphicOrder"
              ? "ordered"
              : context.interaction.responseCardinality === "multiple"
                ? "multiple"
                : "single",
            context.dialect,
          ),
    diagnostics: [],
  };
}

function canvasHotspotProcessing(
  identifier: string,
  correct: readonly string[],
  choices: readonly QtiChoice[],
  dialect: "canvas",
): string {
  const correctChoice = choices.find((choice) => correct.includes(choice.identifier));
  if (!correctChoice) return "";
  return areaCondition(
    identifier,
    qti12Area(correctChoice.attributes.shape),
    correctChoice.attributes.coords ?? "",
    dialect,
  );
}
