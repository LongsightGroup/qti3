import {
  qti3TrustedXmlFragment,
  type Qti3AuthoringItem,
  type Qti3AuthoringItemBase,
  type Qti3AuthoringChoice,
  type Qti3TextEntryResponse,
  type Qti3InlineChoiceSlot,
  type Qti3MatchChoice,
  type Qti3MatchPair,
} from "@longsightgroup/qti3-writer";
import { escapeXmlText } from "@longsightgroup/qti3-core";
import type { LmsIssue } from "./types.js";

export type SourceBase = Pick<Qti3AuthoringItemBase, "identifier" | "title"> & {
  readonly bodyHtml: string;
};
export interface SourceAnswer {
  readonly value: string;
  readonly fraction: number;
  readonly contentHtml?: string | undefined;
}
export function choice(
  base: SourceBase,
  answers: readonly SourceAnswer[],
  single: boolean,
  points: number,
  shuffle: boolean,
  issues: LmsIssue[],
): Qti3AuthoringItem {
  const positive = answers.filter((answer) => answer.fraction > 0);
  const representable = single
    ? positive.length === 1 &&
      positive[0]?.fraction === 1 &&
      answers.every((answer) => answer.fraction === 0 || answer.fraction === 1)
    : positive.length > 0 &&
      answers.every((answer) => answer.fraction >= 0) &&
      positive.every((answer) => Math.abs(answer.fraction - 1 / positive.length) < 0.000001);
  if (!representable)
    issues.push({
      code: "LMS_SCORING_REVIEW",
      message:
        "This source choice weighting/penalty program cannot be represented by the writer's equal-share choice mapping.",
    });
  return {
    interactionType: "choice",
    identifier: base.identifier,
    title: base.title,
    bodyHtml: qti3TrustedXmlFragment(`<div>${base.bodyHtml}</div>`),
    responseIdentifier: "RESPONSE",
    responseCardinality: single ? "single" : "multiple",
    choices: answers.map((answer, index) => ({
      identifier: `OPTION_${index + 1}`,
      contentHtml: qti3TrustedXmlFragment(
        answer.contentHtml ?? `<span>${escapeXmlText(answer.value)}</span>`,
      ),
    })),
    correctResponse: answers.flatMap((answer, index) =>
      answer.fraction > 0 ? [`OPTION_${index + 1}`] : [],
    ),
    maximumScore: points,
    scoring: single ? "match_correct" : "map_response",
    shuffle,
  };
}
export function textEntry(
  base: SourceBase,
  responses: readonly Qti3TextEntryResponse[],
): Qti3AuthoringItem {
  return {
    interactionType: "textEntry",
    identifier: base.identifier,
    title: base.title,
    bodyHtml: qti3TrustedXmlFragment(`<div>${base.bodyHtml}</div>`),
    responses,
  };
}
export function inlineChoice(
  base: SourceBase,
  slots: readonly Qti3InlineChoiceSlot[],
): Qti3AuthoringItem {
  return {
    interactionType: "inlineChoice",
    identifier: base.identifier,
    title: base.title,
    bodyHtml: qti3TrustedXmlFragment(`<div>${base.bodyHtml}</div>`),
    slots,
    scoring: "map_response",
  };
}
export function essay(
  base: SourceBase,
  points: number | undefined,
  rubric = "",
): Qti3AuthoringItem {
  return {
    interactionType: "extendedText",
    identifier: base.identifier,
    title: base.title,
    bodyHtml: qti3TrustedXmlFragment(`<div>${base.bodyHtml}</div>`),
    externalScored: "human",
    rubricHtml:
      rubric || points !== undefined
        ? qti3TrustedXmlFragment(
            `${rubric}${points === undefined ? "" : `<p>Source maximum: ${points} points.</p>`}`,
          )
        : undefined,
    responseIdentifier: "RESPONSE",
    expectedLines: 8,
  };
}
export function matching(
  base: SourceBase,
  sources: readonly Qti3MatchChoice[],
  targets: readonly Qti3MatchChoice[],
  pairs: readonly Qti3MatchPair[],
  points: number,
  shuffle: boolean,
): Qti3AuthoringItem {
  return {
    interactionType: "match",
    identifier: base.identifier,
    title: base.title,
    bodyHtml: qti3TrustedXmlFragment(`<div>${base.bodyHtml}</div>`),
    sources,
    targets,
    correctResponse: pairs.map((pair) => ({ ...pair, score: points / pairs.length })),
    scoring: "map_response",
    shuffle,
  };
}
export function ordering(
  base: SourceBase,
  choices: readonly Qti3AuthoringChoice[],
  grading: string,
  points: number,
  issues: LmsIssue[],
): Qti3AuthoringItem {
  if (grading !== "ALL_OR_NOTHING" || points !== 1)
    issues.push({
      code: "LMS_SCORING_REVIEW",
      message: `Source ordering grading ${grading || "(unspecified)"} at ${points} points cannot be represented by this writer ordering model.`,
    });
  return {
    interactionType: "order",
    identifier: base.identifier,
    title: base.title,
    bodyHtml: qti3TrustedXmlFragment(`<div>${base.bodyHtml}</div>`),
    choices,
    correctOrder: choices.map((entry) => entry.identifier),
    shuffle: true,
  };
}
