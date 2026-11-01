import type { LmsIssue } from "./types.js";
import { findUnescaped } from "./gift-tokens.js";

/** Scan Cloze alternatives before decoding escaped feedback and answer delimiters. */
export function parseMoodleClozeAlternatives(
  value: string,
  warnings: LmsIssue[],
): Array<{ text: string; score: number }> {
  const alternatives: string[] = [];
  let cursor = 0;
  while (cursor <= value.length) {
    const offset = findUnescaped(value.slice(cursor), "~");
    if (offset < 0) {
      alternatives.push(value.slice(cursor));
      break;
    }
    alternatives.push(value.slice(cursor, cursor + offset));
    cursor += offset + 1;
  }
  return alternatives.flatMap((raw) => {
    let text = raw.trim();
    let fraction = text.startsWith("=") ? 100 : 0;
    if (text.startsWith("=")) text = text.slice(1);
    const percentage = /^%(-?\d+(?:[.,]\d+)?)%/.exec(text);
    if (percentage) {
      fraction = Number((percentage[1] ?? "").replace(",", "."));
      text = text.slice(percentage[0].length);
    }
    const feedbackIndex = findUnescaped(text, "#");
    if (feedbackIndex >= 0) {
      const feedback = text.slice(feedbackIndex + 1).trim();
      if (feedback) {
        warnings.push({
          code: "LMS_CONTENT_REVIEW",
          message:
            "Cloze answer feedback remains in the original source. Configure its release before delivery.",
          detail: feedback,
        });
      }
      text = text.slice(0, feedbackIndex);
    }
    text = text.replace(/\\([#}~=\\])/g, "$1").trim();
    if (!Number.isFinite(fraction) || fraction < 0 || fraction > 100) {
      warnings.push({
        code: "LMS_SCORING_REVIEW",
        message:
          "Cloze answer percentages outside 0–100 require scoring reconstruction before acceptance.",
      });
    }
    return text ? [{ text, score: fraction / 100 }] : [];
  });
}

/** Match the closing brace of an embedded answer without consuming escaped literal braces. */
export function replaceMoodleClozeSegments(
  html: string,
  replace: (inner: string, original: string) => string,
): string {
  let output = "";
  let cursor = 0;
  while (cursor < html.length) {
    const startOffset = findUnescaped(html.slice(cursor), "{");
    if (startOffset < 0) {
      output += html.slice(cursor);
      break;
    }
    const start = cursor + startOffset;
    const endOffset = findUnescaped(html.slice(start + 1), "}");
    if (endOffset < 0) {
      output += html.slice(cursor);
      break;
    }
    const end = start + 1 + endOffset;
    output +=
      html.slice(cursor, start) + replace(html.slice(start + 1, end), html.slice(start, end + 1));
    cursor = end + 1;
  }
  return output;
}
