import type { LmsIssue } from "./types.js";
import { tokenizeAnswers } from "./gift-tokens.js";

/** Parse Moodle's weighted numerical alternatives without manufacturing float literals. */
export function parseGiftNumerical(
  input: string,
  warnings: LmsIssue[],
): Array<{ text: string; score: number }> {
  const tokens = input.trim().startsWith("=")
    ? tokenizeAnswers(input)
    : [{ text: input.trim(), score: 1 }];
  const answers: Array<{ text: string; score: number }> = [];
  for (const token of tokens) {
    if ("feedback" in token && token.feedback) {
      warnings.push({
        code: "GIFT_FEEDBACK_IGNORED",
        message: "Numerical answer feedback remains in the original source.",
      });
    }
    const raw = token.text.trim();
    const [value = "", tolerance, ...extra] = raw.split(":");
    const range = value.split("..");
    const number = range[0] ?? "";
    const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
    if (
      !numeric.test(number) ||
      !Number.isFinite(Number(number)) ||
      !Number.isFinite(token.score)
    ) {
      warnings.push({
        code: "LMS_SCORING_REVIEW",
        message: `Source numerical answer ${raw} is invalid. Correct the source numerical rule and import again.`,
      });
      continue;
    }
    if (
      range.length > 1 ||
      extra.length ||
      (tolerance !== undefined && (!numeric.test(tolerance) || Number(tolerance) !== 0))
    ) {
      warnings.push({
        code: "LMS_SCORING_REVIEW",
        message: `Source numerical rule ${raw} contains a range or tolerance that must be configured explicitly before conversion.`,
      });
    }
    answers.push({ text: number, score: token.score });
  }
  return answers;
}
