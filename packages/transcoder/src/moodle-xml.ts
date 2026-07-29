import type { QtiInteraction } from "@longsightgroup/qti3-core";

import { serializeMoodleInteractionAssets } from "./moodle-assets.js";
import { planMoodleItem, type MoodleItemPlan } from "./moodle-question-plan.js";
import type { MoodleInteractionPolicy } from "./profiles.js";
import { serializeRichContentBody } from "./rich-content-html.js";
import type { NormalizedQti3Item } from "./source.js";
import type { QtiTranscodeDiagnostic, QtiTranscodeScoringDisposition } from "./types.js";
import { escapeXml } from "./xml.js";

/** Observable mapping produced by Moodle XML item serialization. */
export interface MoodleXmlMappedInteraction {
  readonly source: QtiInteraction["type"];
  readonly emitted: string;
  readonly scoring: QtiTranscodeScoringDisposition;
  readonly fallback?: string | undefined;
  readonly diagnostics: readonly QtiTranscodeDiagnostic[];
}

/** Serialized Moodle XML item plus mapping evidence. */
export interface MoodleXmlWriteResult {
  readonly xml: string;
  readonly mappings: readonly MoodleXmlMappedInteraction[];
  readonly diagnostics: readonly QtiTranscodeDiagnostic[];
}

/** Serialize one QTI 3 item as Moodle's first-party question-bank XML format. */
export function writeMoodleXmlItem(
  source: NormalizedQti3Item,
  policies: Readonly<Record<QtiInteraction["type"], MoodleInteractionPolicy>>,
): MoodleXmlWriteResult {
  const plan = planMoodleItem(source, policies);
  const body = serializeRichContentBody(source.item.body, source.item.interactions);
  const retainedAssets = escapeXml(serializeMoodleInteractionAssets(source.item.interactions));
  const instruction = plan.question.instruction
    ? escapeXml(`<p>${escapeXml(plan.question.instruction)}</p>`)
    : "";
  return {
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
  <question type="${plan.question.type}">
    <name><text>${escapeXml(plan.title)}</text></name>
    <questiontext format="html"><text>${body}${retainedAssets}${instruction}</text></questiontext>
    <generalfeedback format="html"><text></text></generalfeedback>
    <defaultgrade>${formatNumber(plan.defaultGrade)}</defaultgrade>
    <penalty>0</penalty>
    <hidden>0</hidden>
    ${serializeQuestionFields(plan)}
  </question>
</quiz>`,
    mappings: plan.mappings,
    diagnostics: plan.diagnostics,
  };
}

function serializeQuestionFields(plan: MoodleItemPlan): string {
  const question = plan.question;
  switch (question.type) {
    case "multichoice":
      return `<single>${question.single ? "true" : "false"}</single>
    <shuffleanswers>false</shuffleanswers>
    <answernumbering>abc</answernumbering>
    ${question.answers.map((answer) => moodleAnswer(answer.text, answer.fraction)).join("\n    ")}
    ${combinedFeedback()}`;
    case "matching":
      return `<shuffleanswers>false</shuffleanswers>
    ${question.subquestions
      .map((entry) => moodleSubquestion(entry.question, entry.answer))
      .join("\n    ")}
    ${combinedFeedback()}`;
    case "shortanswer":
      return `<usecase>1</usecase>
    ${question.answers.map((answer) => moodleAnswer(answer, 100)).join("\n    ")}`;
    case "numerical":
      return question.answers
        .map(
          (answer) =>
            `<answer fraction="100"><text>${escapeXml(answer.value)}</text><tolerance>${formatNumber(
              answer.tolerance,
            )}</tolerance><feedback format="html"><text></text></feedback></answer>`,
        )
        .join("\n    ");
    case "essay":
      return `<responseformat>editor</responseformat>
    <responserequired>1</responserequired>
    <responsefieldlines>15</responsefieldlines>
    <attachments>${String(question.attachments)}</attachments>
    <attachmentsrequired>${String(question.attachments)}</attachmentsrequired>
    <graderinfo format="html"><text></text></graderinfo>
    <responsetemplate format="html"><text></text></responsetemplate>`;
    default: {
      const unexpected: never = question;
      throw new Error(`Unsupported Moodle question plan: ${JSON.stringify(unexpected)}`);
    }
  }
}

function moodleAnswer(text: string, fraction: number): string {
  return `<answer fraction="${formatFraction(fraction)}" format="html"><text>${escapeXml(
    text,
  )}</text><feedback format="html"><text></text></feedback></answer>`;
}

function moodleSubquestion(question: string, answer: string): string {
  return `<subquestion format="html"><text>${escapeXml(
    question,
  )}</text><answer><text>${escapeXml(answer)}</text></answer></subquestion>`;
}

function combinedFeedback(): string {
  return `<correctfeedback format="html"><text></text></correctfeedback>
    <partiallycorrectfeedback format="html"><text></text></partiallycorrectfeedback>
    <incorrectfeedback format="html"><text></text></incorrectfeedback>`;
}

function formatFraction(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(7).replace(/0+$/, "");
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}
