import {
  qti3TrustedXmlFragment,
  type Qti3AuthoringItem,
  type Qti3TextEntryResponse,
  type Qti3MatchChoice,
  type Qti3MatchPair,
} from "@longsightgroup/qti3-writer";
import { attr, childElements, localName, parseXml, type XmlElement } from "../xml.js";
import type { QtiMigrationAsset, QtiMigrationOptions, QtiMigrationSourceInput } from "../types.js";
import { choice, essay, matching, ordering, textEntry, type SourceBase } from "./compose.js";
import { field, fieldText, metadata, text, textMarker } from "./content.js";
import { extractFiles, readField, type MoodleFiles } from "./moodle-files.js";
import { convertCloze } from "./moodle-cloze.js";
import { convertDragboxes } from "./moodle-dragboxes.js";
import { attachFeedback, readAnnotations } from "./moodle-feedback.js";
import { diagnostics, finish, sourceText, uniqueIdentifier } from "./result.js";
import type { LmsIssue, LmsMigrationResult, LmsPendingItem, LmsSourceMetadata } from "./types.js";

/** Convert Moodle XML to writer models/QTI without importing application drafts or review policy. */
export function migrateMoodleXmlToQti3(
  input: QtiMigrationSourceInput,
  options: QtiMigrationOptions = {},
): LmsMigrationResult {
  const records: LmsPendingItem[] = [];
  const assets: QtiMigrationAsset[] = [];
  try {
    const root = parseXml(sourceText(input), input.filename ?? "Moodle XML").documentElement;
    if (localName(root) !== "quiz") throw new Error("Not Moodle XML");
    const seen = new Set<string>();
    let category: string | undefined;
    for (const [index, question] of childElements(root)
      .filter((node) => localName(node) === "question")
      .entries()) {
      const type = attr(question, "type") ?? "";
      if (type === "category") {
        category = fieldText(question, "category");
        continue;
      }
      const title = fieldText(question, "name") || `Question ${index + 1}`;
      const identifier = uniqueIdentifier(title, index, seen);
      const issues: LmsIssue[] = [];
      const files = extractFiles(question, identifier, issues);
      assets.push(...files.assets);
      const bodyHtml = readField(field(question, "questiontext"), files, issues);
      const annotations = readAnnotations(question, files, issues);
      const facts = metadata(question);
      const points =
        type === "cloze" || type === "description" ? undefined : readPoints(question, issues);
      const sourceMetadata: LmsSourceMetadata = {
        questionType: type,
        category,
        tags: facts.tags,
        maximumScore: points,
        annotations,
        settings: facts.settings,
      };
      if (type === "description") {
        records.push({
          identifier,
          title,
          standaloneHtml: bodyHtml,
          diagnostics: diagnostics(issues, `${identifier}.xml`),
          sourceMetadata,
        });
        continue;
      }
      const base = { identifier, title, bodyHtml };
      const authoringItem = convertQuestion(question, type, base, files, points, issues);
      records.push({
        identifier,
        title,
        authoringItem: attachFeedback(authoringItem, question, issues),
        diagnostics: diagnostics(issues, `${identifier}.xml`),
        sourceMetadata,
      });
    }
    return finish("moodle-xml", records, assets, options, input.filename ?? "Moodle XML");
  } catch {
    return finish("moodle-xml", records, assets, options, input.filename ?? "Moodle XML", [
      {
        code: "moodle_source_invalid",
        severity: "error",
        message: "Moodle XML must be well-formed UTF-8 quiz content with one unambiguous input.",
      },
    ]);
  }
}
function readPoints(question: XmlElement, issues: LmsIssue[]): number | undefined {
  const node = field(question, "defaultgrade");
  if (!node) return 1;
  const raw = text(node);
  const value = Number(raw);
  if (!/^\d+(?:\.\d+)?$/.test(raw) || !Number.isFinite(value)) {
    issues.push({
      code: "LMS_SCORING_REVIEW",
      message: "Source defaultgrade must be finite and non-negative.",
    });
    return undefined;
  }
  return value;
}
function fraction(answer: XmlElement, issues: LmsIssue[]): number {
  const raw = attr(answer, "fraction");
  const value = raw === null ? NaN : Number(raw);
  if (raw === null || raw.trim() === "" || !Number.isFinite(value)) {
    issues.push({
      code: "LMS_SCORING_REVIEW",
      message: "An answer has no finite source fraction.",
    });
    return 0;
  }
  return value / 100;
}
function convertQuestion(
  question: XmlElement,
  type: string,
  base: SourceBase,
  files: MoodleFiles,
  points: number | undefined,
  issues: LmsIssue[],
): Qti3AuthoringItem | undefined {
  const answers = childElements(question).filter((node) => localName(node) === "answer");
  const shuffle = ["true", "1"].includes(fieldText(question, "shuffleanswers"));
  if (type === "cloze") return convertCloze(question, base, issues);
  if (points === undefined) return undefined;
  if (type === "multichoice")
    return choice(
      base,
      answers.map((answer) => ({
        value: text(answer),
        contentHtml: readField(answer, files, issues),
        fraction: fraction(answer, issues),
      })),
      !["false", "0"].includes(fieldText(question, "single")),
      points,
      shuffle,
      issues,
    );
  if (type === "truefalse")
    return choice(
      base,
      answers.map((answer) => ({ value: text(answer), fraction: fraction(answer, issues) })),
      true,
      points,
      false,
      issues,
    );
  if (type === "shortanswer" || type === "numerical") {
    const numerical = type === "numerical";
    const units = field(question, "units");
    const hasUnits =
      units !== undefined && childElements(units).some((node) => localName(node) === "unit");
    const response: Qti3TextEntryResponse = {
      responseIdentifier: "RESPONSE",
      baseType: numerical ? "float" : "string",
      answers: answers.map((answer) => {
        const value = text(answer);
        const credit = fraction(answer, issues);
        if (credit < 0 || credit > 1)
          issues.push({
            code: "LMS_SCORING_REVIEW",
            message:
              "Source text-answer penalties and fractions outside 0–100 need explicit conversion support.",
          });
        const tolerance = fieldText(answer, "tolerance");
        if (
          numerical &&
          (!Number.isFinite(Number(value)) ||
            (tolerance !== "" && Number(tolerance) !== 0) ||
            hasUnits)
        )
          issues.push({
            code: "LMS_SCORING_REVIEW",
            message: `Numerical source rule ${value}:${tolerance || "0"} or units cannot be preserved by exact text-entry scoring.`,
          });
        if (!numerical && /(?<!\\)\*/.test(value))
          issues.push({
            code: "LMS_SCORING_REVIEW",
            message: "Source short-answer wildcard matching requires conversion support.",
          });
        return {
          value: value.replace(/\\\*/g, "*"),
          score: credit * points,
          caseSensitive: numerical || ["1", "true"].includes(fieldText(question, "usecase")),
        };
      }),
    };
    return textEntry(
      { ...base, bodyHtml: `${base.bodyHtml}<p>${textMarker({ id: "RESPONSE" })}</p>` },
      [response],
    );
  }
  if (type === "essay") {
    if (
      [
        "attachments",
        "attachmentsrequired",
        "minwordlimit",
        "maxwordlimit",
        "responsetemplate",
      ].some((name) => {
        const value = fieldText(question, name);
        return value !== "" && value !== "0";
      })
    )
      issues.push({
        code: "LMS_CONTENT_REVIEW",
        message:
          "Essay attachment, word-limit, and response-template settings remain in source metadata; configure them in the host before delivery.",
      });
    return essay(base, points, readField(field(question, "graderinfo"), files, issues));
  }
  if (type === "matching") {
    const sources: Qti3MatchChoice[] = [];
    const targets: Qti3MatchChoice[] = [];
    const pairs: Qti3MatchPair[] = [];
    const targetIds = new Map<string, string>();
    for (const [index, sub] of childElements(question)
      .filter((node) => localName(node) === "subquestion")
      .entries()) {
      const stem = readField(sub, files, issues);
      const answer = fieldText(sub, "answer");
      if (!answer) continue;
      let target = targetIds.get(answer);
      if (!target) {
        target = `TARGET_${targetIds.size + 1}`;
        targetIds.set(answer, target);
        targets.push({ identifier: target, text: answer, matchMax: 0 });
      }
      if (!text(sub)) continue;
      const id = `SOURCE_${index + 1}`;
      sources.push({ identifier: id, contentHtml: qti3TrustedXmlFragment(stem), matchMax: 1 });
      pairs.push({ sourceIdentifier: id, targetIdentifier: target });
    }
    return matching(base, sources, targets, pairs, points, shuffle);
  }
  if (type === "ordering") {
    const selection = fieldText(question, "selecttype");
    if (selection !== "ALL")
      issues.push({
        code: "LMS_CONTENT_REVIEW",
        message: `Ordering source selection ${selection} count ${fieldText(question, "selectcount")} is converted to all fixed choices.`,
      });
    return ordering(
      base,
      answers.map((answer, index) => ({
        identifier: `CHOICE_${index + 1}`,
        contentHtml: qti3TrustedXmlFragment(readField(answer, files, issues)),
      })),
      fieldText(question, "gradingtype"),
      points,
      issues,
    );
  }
  if (type === "ddwtos") return convertDragboxes(question, base, files, points, shuffle, issues);
  issues.push({
    code: "LMS_INTERACTION_UNSUPPORTED",
    message: `Unsupported Moodle question type ${type}.`,
  });
  return undefined;
}
