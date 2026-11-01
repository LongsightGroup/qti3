import type { LmsIssue } from "./types.js";
import { parseGiftTrueFalse } from "./gift-true-false.js";
import { parseGiftNumerical } from "./gift-numerical.js";
import { findUnescaped, tokenizeAnswers, unescapeGift } from "./gift-tokens.js";
type AnswerBlock = { start: number; end: number; content: string };

export function extractTitle(text: string): { title: string; content: string } {
  if (!text.startsWith("::")) return { title: "", content: text };
  const end = text.indexOf("::", 2);
  if (end === -1) return { title: "", content: text };
  return {
    title: unescapeGift(text.slice(2, end).trim()),
    content: text.slice(end + 2).trim(),
  };
}

export function extractAnswerBlocks(text: string): { answerBlocks: AnswerBlock[] } {
  const blocks: AnswerBlock[] = [];
  let depth = 0;
  let start = -1;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === "}") {
      if (depth === 0) throw new Error("Unmatched GIFT brace");
      depth -= 1;
      if (depth === 0 && start >= 0) {
        blocks.push({ start, end: i, content: text.slice(start + 1, i) });
        start = -1;
      }
    }
  }
  if (depth !== 0) throw new Error("Unclosed GIFT answer");
  return { answerBlocks: blocks };
}

type ParsedAnswer =
  | {
      kind: "truefalse";
      correct: boolean;
    }
  | {
      kind: "essay";
    }
  | {
      kind: "numerical" | "shortanswer" | "single" | "multiselect";
      answers: Array<{ text: string; score: number }>;
    }
  | {
      kind: "matching";
      sources: Array<{ id: string; text?: string; html?: string }>;
      targets: Array<{ id: string; text?: string; html?: string }>;
      correctPairs: Array<{ sourceId: string; targetId: string }>;
    };

export function parseAnswerBlock(content: string, warnings: LmsIssue[]): ParsedAnswer | null {
  const generalIndex = findUnescaped(content, "####");
  if (generalIndex >= 0) {
    warnings.push({
      code: "GIFT_FEEDBACK_IGNORED",
      message:
        "General feedback is retained in the source review evidence; configure its delivery behavior explicitly.",
      detail: unescapeGift(content.slice(generalIndex + 4).trim()),
    });
  }
  const trimmed = (generalIndex >= 0 ? content.slice(0, generalIndex) : content).trim();
  if (!trimmed) return { kind: "essay" };
  const trueFalse = parseGiftTrueFalse(trimmed, warnings);
  if (trueFalse !== null) return { kind: "truefalse", correct: trueFalse };
  if (trimmed.startsWith("#")) {
    return { kind: "numerical", answers: parseGiftNumerical(trimmed.slice(1), warnings) };
  }

  if (!/^[=~]/.test(trimmed)) {
    warnings.push({
      code: "LMS_SCORING_REVIEW",
      message:
        "Unsupported GIFT answer syntax; use GIFT answer markers or import typed Cloze as Moodle XML.",
    });
    return null;
  }
  const tokens = tokenizeAnswers(trimmed);
  if (!tokens.length) return null;

  if (tokens.some((token) => findUnescaped(token.text, "->") >= 0)) {
    const sources: Array<{ id: string; text?: string }> = [];
    const targets: Array<{ id: string; text?: string }> = [];
    const correctPairs: Array<{ sourceId: string; targetId: string }> = [];
    const targetMap = new Map<string, string>();
    for (const [index, token] of tokens.entries()) {
      const split = findUnescaped(token.text, "->");
      if (split < 0) {
        warnings.push({
          code: "LMS_SCORING_REVIEW",
          message: "A matching answer has no source-target separator.",
        });
        continue;
      }
      const stem = unescapeGift(token.text.slice(0, split).trim());
      const answer = unescapeGift(token.text.slice(split + 2).trim());
      if (!answer) continue;
      let targetId = targetMap.get(answer);
      if (!targetId) {
        targetId = `TARGET_${targetMap.size + 1}`;
        targetMap.set(answer, targetId);
        targets.push({ id: targetId, text: answer });
      }
      if (!stem) continue;
      const sourceId = `SOURCE_${index + 1}`;
      sources.push({ id: sourceId, text: stem });
      correctPairs.push({ sourceId, targetId });
    }
    return { kind: "matching", sources, targets, correctPairs };
  }

  const answers = tokens.map((token) => ({
    text: unescapeGift(token.text),
    score: token.score,
  }));
  const correctCount = answers.filter((ans) => ans.score > 0).length;
  if (tokens.some((t) => t.feedback)) {
    warnings.push({
      code: "GIFT_FEEDBACK_IGNORED",
      message: "Answer feedback remains in source annotations; the host controls release.",
      detail: tokens
        .flatMap((token) => (token.feedback ? [unescapeGift(token.feedback)] : []))
        .join("\n"),
    });
  }
  if (tokens.some((t) => t.marker === "~")) {
    return {
      kind: tokens.every((t) => t.marker === "~") || correctCount > 1 ? "multiselect" : "single",
      answers,
    };
  }
  return { kind: "shortanswer", answers };
}

export function splitGiftBlocks(raw: string): string[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let buffer: string[] = [];
  let depth = 0;
  for (const line of lines) {
    if (line.trim().startsWith("//")) continue;
    // A category directive is its own block, even without surrounding blank lines.
    if (depth === 0 && /^\s*\$CATEGORY:/i.test(line)) {
      const question = buffer.join("\n").trim();
      if (question) blocks.push(question);
      blocks.push(line.trim());
      buffer = [];
      continue;
    }
    buffer.push(line);
    depth += countUnescaped(line, "{") - countUnescaped(line, "}");
    if (line.trim() === "" && depth <= 0) {
      const block = buffer.join("\n").trim();
      if (block) blocks.push(block);
      buffer = [];
    }
  }
  const last = buffer.join("\n").trim();
  if (last) blocks.push(last);
  return blocks;
}

function countUnescaped(text: string, token: string): number {
  let count = 0;
  let escaped = false;
  for (const ch of text) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === token) count += 1;
  }
  return count;
}
