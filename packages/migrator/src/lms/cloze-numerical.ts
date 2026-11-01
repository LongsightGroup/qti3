import type { LmsIssue } from "./types.js";

/** Keep numerical values valid and require correction when source tolerances cannot be represented. */
export function parseMoodleClozeNumerical(
  answers: readonly { readonly text: string; readonly score: number }[],
  warnings: LmsIssue[],
): Array<{ text: string; score: number }> {
  const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
  return answers.flatMap((answer) => {
    const [value = "", tolerance, ...extra] = answer.text.split(":").map((part) => part.trim());
    if (!numeric.test(value) || !Number.isFinite(Number(value))) {
      warnings.push({
        code: "LMS_SCORING_REVIEW",
        message: `Cloze numerical answer ${answer.text} is invalid. Correct its value and tolerance in the source and import again.`,
      });
      return [];
    }
    if (
      extra.length ||
      (tolerance !== undefined &&
        (!numeric.test(tolerance) ||
          !Number.isFinite(Number(tolerance)) ||
          Number(tolerance) !== 0))
    ) {
      warnings.push({
        code: "LMS_SCORING_REVIEW",
        message: `Cloze numerical rule ${answer.text} requires tolerance reconstruction. The exact value is retained; configure supported matching before acceptance.`,
      });
    }
    return [{ text: value, score: answer.score }];
  });
}
