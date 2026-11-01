import { parseMoodleClozeAlternatives, replaceMoodleClozeSegments } from "./cloze-alternatives.js";
import { parseMoodleClozeNumerical } from "./cloze-numerical.js";
import {
  textMarker as createPlaceholderHtml,
  inlineMarker as createInlineChoiceMarkerHtml,
} from "./content.js";
import type { LmsIssue, SourceInlineSlot, SourceTextSlot } from "./types.js";
const moodleChoiceLabel = (index: number) => `OPTION_${index + 1}`;
type MoodleCloze = {
  readonly bodyHtml: string;
  readonly inlineSlots: SourceInlineSlot[];
  readonly textSlots: SourceTextSlot[];
  readonly responseMode: "all_or_nothing" | "partial";
};

/** Parses Moodle embedded-answer syntax into QTI inline-choice and text-entry slots. */
export function parseMoodleCloze(bodyHtml: string, warnings: LmsIssue[]): MoodleCloze {
  const inlineSlots: SourceInlineSlot[] = [];
  const textSlots: SourceTextSlot[] = [];
  let index = 1;

  const replaced = replaceMoodleClozeSegments(bodyHtml, (inner, match) => {
    const parsed = parseClozeSegment(inner, warnings);
    if (!parsed) return match;
    const id = `RESPONSE_${index++}`;
    const label = `Blank ${index - 1}`;

    if (parsed.kind === "inline_choice") {
      const options = parsed.answers.map((answer, optionIndex) => ({
        id: moodleChoiceLabel(optionIndex),
        text: answer.text,
        score: answer.score * parsed.weight,
      }));
      const best = options.reduce(
        (bestIndex, option, optionIndex) =>
          option.score > (options[bestIndex]?.score ?? 0) ? optionIndex : bestIndex,
        0,
      );
      inlineSlots.push({
        id,
        label,
        required: true,
        shuffle: parsed.shuffle,
        options,
        correctId: options[best]?.id,
      });
      return createInlineChoiceMarkerHtml({ id });
    }

    textSlots.push({
      id,
      label,
      responseBaseType: parsed.baseType,
      answers: parsed.answers.map((answer) => ({
        value: answer.text,
        score: answer.score * parsed.weight,
        caseSensitive: parsed.caseSensitive,
      })),
    });
    return createPlaceholderHtml({ id });
  });

  return {
    bodyHtml: replaced || "<p/>",
    inlineSlots,
    textSlots,
    responseMode: "partial",
  };
}

type MoodleClozeSegment = {
  readonly kind: "inline_choice" | "text_entry";
  readonly baseType: "string" | "float";
  readonly caseSensitive: boolean;
  readonly shuffle: boolean;
  readonly weight: number;
  readonly answers: Array<{ readonly text: string; readonly score: number }>;
};

function parseClozeSegment(inner: string, warnings: LmsIssue[]): MoodleClozeSegment | null {
  const trimmed = inner.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":");
  let typeToken = "";
  let answerPart = trimmed;
  if (parts.length >= 2 && (parts[0] === "" || isNumeric(parts[0]))) {
    typeToken = parts[1] ?? "";
    answerPart = parts.slice(2).join(":");
  } else if (parts.length >= 2) {
    typeToken = parts[0] ?? "";
    answerPart = parts.slice(1).join(":");
  }

  const weight =
    parts.length >= 2 && (parts[0] === "" || isNumeric(parts[0])) ? Number(parts[0] || "1") : 1;
  if (!Number.isFinite(weight) || !Number.isInteger(weight) || weight < 0) {
    warnings.push({
      code: "LMS_SCORING_REVIEW",
      message:
        "Cloze blank weights must be finite non-negative integers. Correct the source weight and import again.",
    });
    return null;
  }
  const type = typeToken.toUpperCase();
  const isMultiResponse = /^(MULTIRESPONSE(?:_H|_S|_HS)?|MR|MRH|MRS|MRHS)$/.test(type);
  const isMulti =
    /^(MULTICHOICE(?:_V|_H|_S|_VS|_HS)?|MC|MCV|MCH|MCS|MCVS|MCHS)$/.test(type) || isMultiResponse;
  const isNumerical = type === "NUMERICAL" || type === "NM";
  const caseSensitive = ["SHORTANSWER_C", "SAC", "MWC"].includes(type);
  const isShortAnswer =
    ["SHORTANSWER", "SA", "MW", "SHORTANSWER_C", "SAC", "MWC"].includes(type) || type === "";
  if (isMultiResponse) {
    warnings.push({
      code: "CLOZE_MULTI_RESPONSE",
      message: "Cloze multi-response requires explicit reconstruction before conversion.",
    });
  }
  if (!isMulti && !isNumerical && !isShortAnswer) {
    warnings.push({
      code: "CLOZE_TYPE_UNKNOWN",
      message: `Unknown cloze type "${typeToken}", imported as short answer.`,
    });
  }

  const alternatives = parseMoodleClozeAlternatives(answerPart, warnings);
  const answers = isNumerical ? parseMoodleClozeNumerical(alternatives, warnings) : alternatives;
  if (isShortAnswer && answers.some((answer) => /(?<!\\)\*/.test(answer.text)))
    warnings.push({
      code: "LMS_SCORING_REVIEW",
      message: "Cloze short-answer wildcards require explicit pattern conversion support.",
    });
  if (isShortAnswer) for (const answer of answers) answer.text = answer.text.replace(/\\\*/g, "*");
  if (!answers.length) return null;
  return {
    kind: isMulti ? "inline_choice" : "text_entry",
    weight,
    baseType: isNumerical ? "float" : "string",
    caseSensitive,
    shuffle: ["MULTICHOICE_S", "MCS", "MULTICHOICE_VS", "MCVS", "MULTICHOICE_HS", "MCHS"].includes(
      type,
    ),
    answers,
  };
}

function isNumeric(value: string | undefined): boolean {
  return /^\d+(?:\.\d+)?$/.test(value?.trim() ?? "");
}
