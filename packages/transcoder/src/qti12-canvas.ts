import type { QtiInteraction } from "@longsightgroup/qti3-core";

import { itemMaximumScore } from "./item-score.js";
import type { NormalizedQti3Item } from "./source.js";
import type { QtiTranscodeScoringDisposition } from "./types.js";
import { escapeXmlAttribute, escapeXmlText } from "./xml.js";

export interface CanvasQti12ResponseSummary {
  readonly emitted: string;
  readonly correct: readonly string[];
  readonly scoring: QtiTranscodeScoringDisposition;
  readonly fallback?: string | undefined;
}

export function serializeCanvasItemMetadata(
  source: NormalizedQti3Item,
  responses: readonly CanvasQti12ResponseSummary[],
): string {
  const interaction = source.item.interactions[0];
  const declaration = source.item.responseDeclarations.find(
    (candidate) => candidate.identifier === interaction?.responseIdentifier,
  );
  const questionType =
    interaction === undefined
      ? "essay_question"
      : canvasQuestionType(interaction, declaration?.baseType, responses[0]);
  const answerIds =
    interaction === undefined
      ? []
      : interaction.type === "hotspot"
        ? []
        : interaction.type === "match"
          ? interaction.choices
              .filter((choice) => choice.role === "matchTarget")
              .map((choice) => qti12Identifier(choice.identifier))
          : interaction.choices.map((choice) => qti12Identifier(choice.identifier));
  return `<itemmetadata>
      <qtimetadata>
        ${canvasMetadataField("question_type", questionType)}
        ${canvasMetadataField("points_possible", formatScore(canvasPointsPossible(source)))}
        ${canvasMetadataField("original_answer_ids", answerIds.join(","))}
        ${canvasMetadataField(
          "assessment_question_identifierref",
          `AQ_${qti12Identifier(source.item.identifier)}`,
        )}
      </qtimetadata>
    </itemmetadata>`;
}

export function canvasHotspotResponse(
  identifier: string,
  interaction: QtiInteraction,
  correct: readonly string[],
  imageXml: string,
): string {
  const hotspots = interaction.choices.filter((choice) => choice.role === "hotspot");
  const selected = hotspots.find((choice) => correct.includes(choice.identifier)) ?? hotspots[0];
  const labels = (selected ? [selected] : [])
    .map(
      (choice) =>
        `<response_label ident="${escapeXmlAttribute(identifier)}" rarea="${qti12Area(
          choice.attributes.shape,
        )}">${escapeXmlText(choice.attributes.coords ?? "")}</response_label>`,
    )
    .join("");
  return `<response_xy ident="${escapeXmlAttribute(
    identifier,
  )}" rcardinality="Single" rtiming="No"><render_hotspot>${imageXml}${labels}</render_hotspot></response_xy>`;
}

function canvasQuestionType(
  interaction: QtiInteraction,
  baseType: string | undefined,
  response: CanvasQti12ResponseSummary | undefined,
): string {
  if (interaction.type === "match") return "matching_question";
  if (
    (interaction.type === "order" || interaction.type === "graphicOrder") &&
    response?.scoring === "automatic" &&
    response.emitted === "response_lid"
  ) {
    return response.fallback === "matching" ? "matching_question" : "ordering_question";
  }
  if (interaction.type === "hotspot" && response?.emitted === "response_xy") {
    return "hot_spot_question";
  }
  if (interaction.type === "upload") return "file_upload_question";
  if (interaction.type === "textEntry" && (baseType === "float" || baseType === "integer")) {
    return "numerical_question";
  }
  if (interaction.type === "textEntry") return "short_answer_question";
  if (interaction.type === "slider") return "numerical_question";
  if (interaction.type === "positionObject" || interaction.type === "selectPoint") {
    return "short_answer_question";
  }
  if (
    interaction.type === "extendedText" ||
    response?.scoring === "manual" ||
    interaction.type === "custom" ||
    interaction.type === "portableCustom"
  ) {
    return "essay_question";
  }
  if (
    interaction.type === "choice" &&
    interaction.responseCardinality !== "multiple" &&
    interaction.choices.length === 2 &&
    interaction.choices
      .map((choice) => choice.text.trim().toLowerCase())
      .toSorted()
      .join(",") === "false,true"
  ) {
    return "true_false_question";
  }
  return interaction.responseCardinality === "multiple" ||
    (response?.emitted === "response_lid" && response.correct.length > 1)
    ? "multiple_answers_question"
    : "multiple_choice_question";
}

function canvasMetadataField(label: string, value: string): string {
  return `<qtimetadatafield><fieldlabel>${escapeXmlText(label)}</fieldlabel><fieldentry>${escapeXmlText(
    value,
  )}</fieldentry></qtimetadatafield>`;
}

function canvasPointsPossible(source: NormalizedQti3Item): number {
  return itemMaximumScore(source.item);
}

function qti12Identifier(value: string): string {
  const normalized = value.replace(/[^A-Za-z0-9_.-]/g, "_");
  return /^[A-Za-z_]/.test(normalized) ? normalized : `R_${normalized}`;
}

function qti12Area(shape: string | undefined): string {
  return shape === "circle"
    ? "Ellipse"
    : shape === "poly"
      ? "Bounded"
      : shape === "default"
        ? "Default"
        : "Rectangle";
}

function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
