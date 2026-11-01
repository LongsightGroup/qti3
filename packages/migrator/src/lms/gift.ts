import {
  qti3TrustedXmlFragment,
  type Qti3AuthoringItem,
  type Qti3TextEntryResponse,
  type Qti3InlineChoiceSlot,
} from "@longsightgroup/qti3-writer";
import type { QtiMigrationOptions, QtiMigrationSourceInput } from "../types.js";
import { choice, essay, inlineChoice, matching, textEntry, type SourceBase } from "./compose.js";
import { inlineMarker, textMarker } from "./content.js";
import { giftAnswer, giftBody, giftInlineAnswer, readGiftFormat } from "./gift-content.js";
import {
  extractAnswerBlocks,
  extractTitle,
  parseAnswerBlock,
  splitGiftBlocks,
} from "./gift-parser.js";
import { diagnostics, finish, sourceText, uniqueIdentifier } from "./result.js";
import type { LmsIssue, LmsMigrationResult, LmsPendingItem, LmsSourceMetadata } from "./types.js";

/** Convert Moodle-produced GIFT without depending on a host editor or persistence model. */
export function migrateGiftToQti3(
  input: QtiMigrationSourceInput,
  options: QtiMigrationOptions = {},
): LmsMigrationResult {
  const records: LmsPendingItem[] = [];
  try {
    const blocks = splitGiftBlocks(sourceText(input));
    const seen = new Set<string>();
    let category: string | undefined;
    for (const [index, block] of blocks.entries()) {
      const categoryMatch = /^\$CATEGORY:\s*(.*)$/i.exec(block.trim());
      if (categoryMatch) {
        category = categoryMatch[1]?.trim();
        continue;
      }
      const named = extractTitle(block.trim());
      const title = named.title || `Question ${index + 1}`;
      const identifier = uniqueIdentifier(title, index, seen);
      const formatted = readGiftFormat(named.content);
      const parsed = extractAnswerBlocks(formatted.content);
      const issues: LmsIssue[] = [];
      const bodyBase = { identifier, title, bodyHtml: "" };
      let authoringItem: Qti3AuthoringItem | undefined;
      let standaloneHtml: string | undefined;
      if (!parsed.answerBlocks.length)
        standaloneHtml = giftBody(formatted.content, formatted.format, issues);
      else if (
        parsed.answerBlocks.length === 1 &&
        parsed.answerBlocks[0] &&
        !formatted.content.slice(parsed.answerBlocks[0].end + 1).trim()
      ) {
        const answer = parsed.answerBlocks[0];
        authoringItem = simple(
          {
            ...bodyBase,
            bodyHtml: giftBody(formatted.content.slice(0, answer.start), formatted.format, issues),
          },
          answer.content,
          formatted.format,
          issues,
        );
      } else
        authoringItem = embedded(
          bodyBase,
          formatted.content,
          parsed.answerBlocks,
          formatted.format,
          issues,
        );
      const annotations = issues.flatMap((issue) =>
        issue.detail ? [{ kind: "feedback" as const, name: issue.code, text: issue.detail }] : [],
      );
      const sourceMetadata: LmsSourceMetadata = {
        questionType: standaloneHtml === undefined ? "gift-question" : "description",
        category,
        tags: [],
        maximumScore: undefined,
        annotations,
        settings: { format: formatted.format },
      };
      records.push({
        identifier,
        title,
        authoringItem,
        standaloneHtml,
        diagnostics: diagnostics(issues, `${identifier}.xml`),
        sourceMetadata,
      });
    }
    return finish("gift", records, [], options, input.filename ?? "GIFT");
  } catch {
    return finish("gift", records, [], options, input.filename ?? "GIFT", [
      {
        code: "gift_source_invalid",
        severity: "error",
        message: "GIFT source must be unambiguous UTF-8 content.",
      },
    ]);
  }
}
function simple(
  base: SourceBase,
  source: string,
  format: string,
  issues: LmsIssue[],
): Qti3AuthoringItem | undefined {
  const parsed = parseAnswerBlock(source, issues);
  if (!parsed) {
    issues.push({
      code: "LMS_SCORING_REVIEW",
      message: "No supported GIFT answer program was found.",
    });
    return undefined;
  }
  if (parsed.kind === "essay") return essay(base, undefined);
  if (parsed.kind === "truefalse")
    return choice(
      base,
      [
        { value: "True", fraction: parsed.correct ? 1 : 0 },
        { value: "False", fraction: parsed.correct ? 0 : 1 },
      ],
      true,
      1,
      false,
      issues,
    );
  if (parsed.kind === "matching")
    return matching(
      base,
      parsed.sources.map((entry) => ({
        identifier: entry.id,
        contentHtml: qti3TrustedXmlFragment(giftAnswer(entry.text ?? "", format, issues)),
        matchMax: 1,
      })),
      parsed.targets.map((entry) => ({ identifier: entry.id, text: entry.text, matchMax: 0 })),
      parsed.correctPairs.map((pair) => ({
        sourceIdentifier: pair.sourceId,
        targetIdentifier: pair.targetId,
      })),
      1,
      true,
    );
  if (parsed.kind === "single" || parsed.kind === "multiselect")
    return choice(
      base,
      parsed.answers.map((answer) => ({
        value: answer.text,
        fraction: answer.score,
        contentHtml: giftAnswer(answer.text, format, issues),
      })),
      parsed.kind === "single",
      1,
      true,
      issues,
    );
  if (
    parsed.answers.some(
      (answer) => answer.score < 0 || answer.score > 1 || !Number.isFinite(answer.score),
    )
  )
    issues.push({
      code: "LMS_SCORING_REVIEW",
      message:
        "GIFT text-answer penalties or fractions outside 0–100 need explicit conversion support.",
    });
  if (parsed.answers.some((answer) => /(?<!\\)\*/.test(answer.text)))
    issues.push({
      code: "LMS_SCORING_REVIEW",
      message: "GIFT wildcard answers require explicit pattern conversion support.",
    });
  return textEntry(
    { ...base, bodyHtml: `${base.bodyHtml}<p>${textMarker({ id: "RESPONSE" })}</p>` },
    [
      {
        responseIdentifier: "RESPONSE",
        baseType: parsed.kind === "numerical" ? "float" : "string",
        answers: parsed.answers.map((answer) => ({
          value: answer.text,
          score: answer.score,
          caseSensitive: parsed.kind === "numerical",
        })),
      },
    ],
  );
}
function embedded(
  base: SourceBase,
  source: string,
  blocks: readonly { start: number; end: number; content: string }[],
  format: string,
  issues: LmsIssue[],
): Qti3AuthoringItem | undefined {
  const texts: Qti3TextEntryResponse[] = [];
  const slots: Qti3InlineChoiceSlot[] = [];
  let cursor = 0;
  let body = "";
  let markerPrefix = "QTI_MIGRATION_BLANK_";
  while (source.includes(markerPrefix)) markerPrefix += "_";
  const markers = new Map<string, string>();
  for (const [index, block] of blocks.entries()) {
    body += source.slice(cursor, block.start);
    cursor = block.end + 1;
    const parsed = parseAnswerBlock(block.content, issues);
    const id = `RESPONSE_${index + 1}`;
    if (
      !parsed ||
      parsed.kind === "essay" ||
      parsed.kind === "matching" ||
      parsed.kind === "truefalse"
    ) {
      issues.push({
        code: "LMS_SCORING_REVIEW",
        message: "This embedded GIFT interaction cannot be represented by the writer model.",
      });
      continue;
    }
    if (
      parsed.answers.some(
        (answer) => answer.score < 0 || answer.score > 1 || !Number.isFinite(answer.score),
      )
    )
      issues.push({
        code: "LMS_SCORING_REVIEW",
        message:
          "Embedded GIFT penalties or out-of-range fractions require explicit scoring support.",
      });
    const marker = `${markerPrefix}${index + 1}_END`;
    if (parsed.kind === "single" || parsed.kind === "multiselect") {
      if (parsed.kind === "multiselect")
        issues.push({
          code: "LMS_SCORING_REVIEW",
          message: "Embedded multi-response GIFT requires composition support.",
        });
      slots.push({
        responseIdentifier: id,
        correctResponse: `OPTION_${parsed.answers.reduce((best, answer, option) => (answer.score > (parsed.answers[best]?.score ?? 0) ? option : best), 0) + 1}`,
        options: parsed.answers.map((answer, option) => ({
          identifier: `OPTION_${option + 1}`,
          contentHtml: qti3TrustedXmlFragment(giftInlineAnswer(answer.text, format, issues)),
          score: answer.score,
        })),
      });
      markers.set(marker, inlineMarker({ id }));
      body += marker;
    } else {
      texts.push({
        responseIdentifier: id,
        baseType: parsed.kind === "numerical" ? "float" : "string",
        answers: parsed.answers.map((answer) => ({
          value: answer.text,
          score: answer.score,
          caseSensitive: parsed.kind === "numerical",
        })),
      });
      markers.set(marker, textMarker({ id }));
      body += marker;
    }
  }
  body += source.slice(cursor);
  body = giftBody(body, format, issues);
  for (const [marker, xml] of markers) body = body.split(marker).join(xml);
  if (texts.length && slots.length) {
    issues.push({
      code: "LMS_SCORING_REVIEW",
      message: "Mixed embedded GIFT composition is not supported by the writer model.",
    });
    return undefined;
  }
  if (slots.length) return inlineChoice({ ...base, bodyHtml: body }, slots);
  if (texts.length) return textEntry({ ...base, bodyHtml: body }, texts);
  issues.push({
    code: "LMS_SCORING_REVIEW",
    message: "Embedded GIFT has no supported response declarations.",
  });
  return undefined;
}
