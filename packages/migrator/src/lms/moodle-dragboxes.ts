import { qti3TrustedXmlFragment, type Qti3AuthoringItem } from "@longsightgroup/qti3-writer";
import { escapeXmlAttribute } from "@longsightgroup/qti3-core";
import { childElements, localName, type XmlElement } from "../xml.js";
import { field, fieldText } from "./content.js";
import { readField, type MoodleFiles } from "./moodle-files.js";
import type { SourceBase } from "./compose.js";
import type { LmsIssue } from "./types.js";
export function convertDragboxes(
  question: XmlElement,
  base: SourceBase,
  files: MoodleFiles,
  points: number,
  shuffle: boolean,
  issues: LmsIssue[],
): Qti3AuthoringItem {
  const boxes = childElements(question).filter((node) => localName(node) === "dragbox");
  const groups = new Set(boxes.map((box) => fieldText(box, "group") || "1"));
  if (groups.size > 1)
    issues.push({
      code: "LMS_CONTENT_REVIEW",
      message: `Source dragbox group restrictions (${[...groups].join(", ")}) are converted to one choice set.`,
    });
  const choices = boxes.map((box, index) => ({
    identifier: `CHOICE_${index + 1}`,
    kind: "text" as const,
    contentHtml: qti3TrustedXmlFragment(readField(box, files, issues)),
    matchMax: field(box, "infinite") ? 0 : 1,
  }));
  const targets: Array<{ identifier: string }> = [];
  const pairs: Array<{ sourceIdentifier: string; targetIdentifier: string; score: number }> = [];
  const count = [...base.bodyHtml.matchAll(/\[\[\d+\]\]/g)].length;
  const body = base.bodyHtml.replace(/\[\[(\d+)\]\]/g, (_match, index: string) => {
    const id = `GAP_${targets.length + 1}`;
    targets.push({ identifier: id });
    const selected = choices[Number(index) - 1];
    if (selected)
      pairs.push({
        sourceIdentifier: selected.identifier,
        targetIdentifier: id,
        score: points / count,
      });
    else issues.push({ code: "LMS_SCORING_REVIEW", message: `Unknown source dragbox ${index}.` });
    return `<qti-gap identifier="${escapeXmlAttribute(id)}"/>`;
  });
  return {
    interactionType: "gapMatch",
    identifier: base.identifier,
    title: base.title,
    bodyHtml: qti3TrustedXmlFragment(`<div>${body}</div>`),
    choices,
    targets,
    correctResponse: pairs,
    scoring: "map_response",
    shuffle,
  };
}
