import type { Qti3AuthoringItem } from "@longsightgroup/qti3-writer";
import type { XmlElement } from "../xml.js";
import { field, text } from "./content.js";
import { inlineChoice, textEntry, type SourceBase } from "./compose.js";
import { parseMoodleCloze } from "./cloze.js";
import type { LmsIssue } from "./types.js";
export function convertCloze(
  question: XmlElement,
  base: SourceBase,
  issues: LmsIssue[],
): Qti3AuthoringItem | undefined {
  const parsed = parseMoodleCloze(base.bodyHtml, issues);
  const total =
    parsed.textSlots.reduce(
      (sum, slot) => sum + Math.max(0, ...slot.answers.map((answer) => answer.score)),
      0,
    ) +
    parsed.inlineSlots.reduce(
      (sum, slot) => sum + Math.max(0, ...slot.options.map((option) => option.score)),
      0,
    );
  const header = field(question, "defaultgrade");
  if (header && Number(text(header)) !== total)
    issues.push({
      code: "LMS_SCORING_REVIEW",
      message: "Cloze header marks conflict with the source blank weights.",
    });
  if (parsed.textSlots.length && parsed.inlineSlots.length) {
    issues.push({
      code: "LMS_SCORING_REVIEW",
      message: "Mixed Cloze interaction composition is not yet supported by the writer model.",
    });
    return undefined;
  }
  if (parsed.textSlots.length)
    return textEntry(
      { ...base, bodyHtml: parsed.bodyHtml },
      parsed.textSlots.map((slot) => ({
        responseIdentifier: slot.id,
        baseType: slot.responseBaseType,
        answers: slot.answers,
      })),
    );
  if (parsed.inlineSlots.length)
    return inlineChoice(
      { ...base, bodyHtml: parsed.bodyHtml },
      parsed.inlineSlots.map((slot) => ({
        responseIdentifier: slot.id,
        correctResponse: slot.correctId,
        shuffle: slot.shuffle,
        required: true,
        options: slot.options.map((option) => ({
          identifier: option.id,
          text: option.text,
          score: option.score,
        })),
      })),
    );
  issues.push({ code: "CLOZE_EMPTY", message: "No supported Cloze blanks were found." });
  return undefined;
}
