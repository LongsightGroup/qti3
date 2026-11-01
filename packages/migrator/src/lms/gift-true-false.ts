import type { LmsIssue } from "./types.js";
import { findUnescaped, unescapeGift } from "./gift-tokens.js";

/** Read the true/false key and retain both explanation fields without inventing release behavior. */
export function parseGiftTrueFalse(input: string, warnings: LmsIssue[]): boolean | null {
  const separator = findUnescaped(input, "#");
  const key = (separator < 0 ? input : input.slice(0, separator)).trim();
  if (!/^(true|t|false|f)$/i.test(key)) return null;
  if (separator >= 0) {
    const feedback = input.slice(separator + 1);
    const split = findUnescaped(feedback, "#");
    const wrong = split < 0 ? feedback : feedback.slice(0, split);
    const right = split < 0 ? "" : feedback.slice(split + 1);
    for (const [label, text] of [
      ["incorrect", wrong],
      ["correct", right],
    ] as const) {
      if (!text.trim()) continue;
      warnings.push({
        code: "GIFT_FEEDBACK_IGNORED",
        message:
          "True/false explanations are retained in source evidence. Configure their content and release before delivery.",
        detail: `${label} response explanation: ${unescapeGift(text.trim())}`,
      });
    }
  }
  return /^(true|t)$/i.test(key);
}
