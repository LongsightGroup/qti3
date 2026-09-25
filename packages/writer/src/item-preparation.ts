import { authoringResponseIdentifiers } from "./interaction-responses.js";
import { prepareModalFeedback, type PreparedFeedback } from "./modal-feedback.js";
import { assessmentItemShell, type AssessmentItemShellInput } from "./shell.js";
import {
  Qti3WriterError,
  type Qti3AuthoringItem,
  type Qti3WriterDiagnostic,
  type Qti3WriterResult,
} from "./types.js";

export type RenderedItemSections = Omit<
  AssessmentItemShellInput,
  "outcomeDeclarationsXml" | "modalFeedbackXml"
>;

/** Attach item identity to the sections owned by an interaction renderer. */
export function itemSections(
  item: Pick<Qti3AuthoringItem, "identifier" | "title" | "lang">,
  sections: Omit<RenderedItemSections, "identifier" | "title" | "lang">,
): RenderedItemSections {
  return { identifier: item.identifier, title: item.title, lang: item.lang, ...sections };
}

function prepareItemFeedback(item: Qti3AuthoringItem): PreparedFeedback {
  const responses = authoringResponseIdentifiers(item);
  const prepared = item.modalFeedback
    ? prepareModalFeedback(item.modalFeedback, responses)
    : ({
        diagnostics: [],
        outcomeDeclarationsXml: "",
        modalFeedbackXml: "",
        responseProcessingXml: undefined,
      } satisfies PreparedFeedback);
  if (
    (item.interactionType === "custom" || item.interactionType === "portableCustom") &&
    item.responseProcessingXml !== undefined &&
    item.modalFeedback?.responseProcessingXml !== undefined
  ) {
    prepared.diagnostics.push({
      code: "conflicting_response_processing",
      path: "modalFeedback.responseProcessingXml",
      message: "Specify response processing on the item or modal feedback, not both.",
    });
  }
  return prepared;
}

export function validatePreparedItem<T extends Qti3AuthoringItem>(
  item: T,
  validate: (input: T) => Qti3WriterDiagnostic[],
  feedback: PreparedFeedback = prepareItemFeedback(item),
): Qti3WriterDiagnostic[] {
  return [...validate(item), ...feedback.diagnostics];
}

export function writePreparedItem<T extends Qti3AuthoringItem>(
  item: T,
  validate: (input: T) => Qti3WriterDiagnostic[],
  render: (input: T) => RenderedItemSections,
  feedback: PreparedFeedback = prepareItemFeedback(item),
): Qti3WriterResult {
  const diagnostics = [...validate(item), ...feedback.diagnostics];
  return diagnostics.length
    ? { ok: false, diagnostics }
    : { ok: true, xml: assembleItem(render(item), feedback), diagnostics: [] };
}

export function buildPreparedItem<T extends Qti3AuthoringItem>(
  item: T,
  validate: (input: T) => Qti3WriterDiagnostic[],
  render: (input: T) => RenderedItemSections,
  feedback: PreparedFeedback = prepareItemFeedback(item),
): string {
  const result = writePreparedItem(item, validate, render, feedback);
  if (!result.ok) throw new Qti3WriterError(result.diagnostics);
  return result.xml;
}

/** Resolve authoring policy before handing final XML sections to the assembler. */
function assembleItem(input: RenderedItemSections, feedback: PreparedFeedback): string {
  return assessmentItemShell({
    ...input,
    outcomeDeclarationsXml: feedback.outcomeDeclarationsXml,
    modalFeedbackXml: feedback.modalFeedbackXml,
    responseProcessingXml: feedback.responseProcessingXml ?? input.responseProcessingXml,
  });
}
