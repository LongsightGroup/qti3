import type {
  QtiChoice,
  QtiInteraction,
  QtiInteractionType,
  QtiResponseDeclaration,
} from "@longsightgroup/qti3-core";

import type { QtiTranscodeInteractionPolicy } from "../profiles.js";
import type { NormalizedQti3Item } from "../source.js";
import {
  applyCanvasClassicHotspotPolicy,
  applyCanvasClassicPolicy,
  manualFallbackResponse,
} from "./canvas-policy.js";
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
import { qti12Area, qti12Identifier, values } from "./shared.js";
import type { Qti12MapContext, Qti12Response, Qti12WireDialect } from "./types.js";

type Qti12InteractionMapper = (context: Qti12MapContext) => Qti12Response;

const INTERACTION_MAPPERS: Readonly<Record<QtiInteractionType, Qti12InteractionMapper>> = {
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
  custom: manualFallbackResponse,
  drawing: manualFallbackResponse,
  endAttempt: manualFallbackResponse,
  media: manualFallbackResponse,
  portableCustom: manualFallbackResponse,
  upload: manualFallbackResponse,
};

export function mapQti12Interaction(
  interaction: QtiInteraction,
  declaration: QtiResponseDeclaration | undefined,
  policy: QtiTranscodeInteractionPolicy,
  index: number,
  sourcePath: string | undefined,
  dialect: Qti12WireDialect,
): Qti12Response {
  const identifier =
    dialect === "canvas-classic"
      ? index === 0
        ? "response1"
        : `response${String(index + 1)}`
      : qti12Identifier(interaction.responseIdentifier ?? `RESPONSE_${index + 1}`);
  const correct = values(declaration?.correctResponse ?? null);
  const context: Qti12MapContext = {
    interaction,
    identifier,
    correct,
    policy,
    sourcePath,
    dialect,
    fallbackDiagnostic: (fallback) => ({
      code: `profile.qti12.fallback.${fallback}`,
      severity: "warning",
      message: `Converted ${interaction.type} to a QTI 1.2 ${fallback} representation.`,
      path: sourcePath,
    }),
  };

  const canvasPolicy = applyCanvasClassicPolicy(context);
  if (canvasPolicy) return canvasPolicy;

  const canvasHotspot = applyCanvasClassicHotspotPolicy(context);
  if (canvasHotspot) return canvasHotspot;

  return INTERACTION_MAPPERS[interaction.type](context);
}

export function declarationFor(
  source: NormalizedQti3Item,
  interaction: QtiInteraction,
): QtiResponseDeclaration | undefined {
  return source.item.responseDeclarations.find(
    (declaration) => declaration.identifier === interaction.responseIdentifier,
  );
}

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
    fallback: context.policy.fallback,
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
        ? [context.fallbackDiagnostic(context.policy.fallback ?? "choice")]
        : [],
  };
}

function mapHotspotFamily(context: Qti12MapContext): Qti12Response {
  const hotspotChoices = context.interaction.choices.filter((choice) => choice.role === "hotspot");
  return {
    identifier: context.identifier,
    xml:
      context.dialect === "canvas-classic" && context.interaction.type === "hotspot"
        ? serializeCanvasHotspot(context.identifier, context.interaction, context.correct)
        : hotspotResponse(context.identifier, context.interaction),
    correct: context.correct,
    scoring: context.correct.length > 0 ? "automatic" : "unscored",
    emitted: "response_lid",
    processingXml:
      context.dialect === "canvas-classic" && context.interaction.type === "hotspot"
        ? canvasHotspotProcessing(context.identifier, context.correct, hotspotChoices)
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
): string {
  const correctChoice = choices.find((choice) => correct.includes(choice.identifier));
  if (!correctChoice) return "";
  return areaCondition(
    identifier,
    qti12Area(correctChoice.attributes.shape),
    correctChoice.attributes.coords ?? "",
    "canvas-classic",
  );
}
