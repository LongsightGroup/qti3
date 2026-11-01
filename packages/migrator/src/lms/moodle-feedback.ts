import type { Qti3AuthoringItem } from "@longsightgroup/qti3-writer";
import { childElements, localName, type XmlElement } from "../xml.js";
import { field, text, sourceFormat, literalHtmlText } from "./content.js";
import { readField, type MoodleFiles } from "./moodle-files.js";
import type { LmsIssue, LmsSourceAnnotation } from "./types.js";
export function readAnnotations(
  question: XmlElement,
  files: MoodleFiles,
  issues: LmsIssue[],
): LmsSourceAnnotation[] {
  const annotations: LmsSourceAnnotation[] = [];
  const pending = childElements(question);
  for (let index = 0; index < pending.length; index++) {
    const node = pending[index];
    if (!node) continue;
    const name = localName(node);
    if (
      [
        "hint",
        "generalfeedback",
        "feedback",
        "correctfeedback",
        "incorrectfeedback",
        "partiallycorrectfeedback",
      ].includes(name) &&
      (text(node) || childElements(node).length)
    ) {
      const contentHtml = readField(node, files, issues);
      const settings = Object.fromEntries(
        childElements(node)
          .filter((child) => !["text", "file"].includes(localName(child)))
          .map((child) => [localName(child), text(child)]),
      );
      annotations.push({
        kind: name === "hint" ? "hint" : "feedback",
        name,
        text: text(node),
        contentHtml,
        settings,
        format: sourceFormat(node),
      });
      if (name === "hint" || name === "feedback" || name === "partiallycorrectfeedback")
        issues.push({
          code: "LMS_CONTENT_REVIEW",
          message: `Source ${name} content and behavior remain in source annotations; the host controls their delivery.`,
        });
    }
    pending.push(...childElements(node));
  }
  return annotations;
}
export function attachFeedback(
  item: Qti3AuthoringItem | undefined,
  question: XmlElement,
  issues: LmsIssue[],
): Qti3AuthoringItem | undefined {
  if (!item || (item.interactionType !== "choice" && item.interactionType !== "inlineChoice"))
    return item;
  const explanation = (name: string) => {
    const node = field(question, name);
    if (!node) return "";
    const raw = text(node);
    if (["plain", "plain_text"].includes(sourceFormat(node))) return raw;
    if (!["html", ""].includes(sourceFormat(node))) return "";
    if (/<[^>]+>/.test(raw)) {
      issues.push({
        code: "LMS_CONTENT_REVIEW",
        message: `Rich ${name} is retained in source annotations.`,
      });
      return "";
    }
    return literalHtmlText(raw);
  };
  const general = explanation("generalfeedback");
  const correct = [general, explanation("correctfeedback")].filter(Boolean).join("\n\n");
  const incorrect = [general, explanation("incorrectfeedback")].filter(Boolean).join("\n\n");
  if (!correct && !incorrect) return item;
  return {
    ...item,
    responseFeedback: {
      correct: correct ? { text: correct } : undefined,
      incorrect: incorrect ? { text: incorrect } : undefined,
    },
  };
}
