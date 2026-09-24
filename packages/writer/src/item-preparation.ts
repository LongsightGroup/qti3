import { choiceModalFeedback, validateChoiceFeedback } from "./choice-feedback.js";
import { prepareModalFeedback, type PreparedFeedback } from "./modal-feedback.js";
import { assessmentItemShell, type AssessmentItemShellInput } from "./shell.js";
import {
  Qti3WriterError,
  type Qti3AuthoringItem,
  type Qti3AuthoringItemBase,
  type Qti3WriterDiagnostic,
  type Qti3WriterResult,
} from "./types.js";

export function prepareItemFeedback(item: Qti3AuthoringItem): PreparedFeedback {
  const responses =
    item.interactionType === "textEntry"
      ? item.responses.map((response) => response.responseIdentifier)
      : item.interactionType === "inlineChoice"
        ? item.slots.map((slot) => slot.responseIdentifier)
        : [item.responseIdentifier ?? "RESPONSE"];
  if (item.interactionType === "choice" && item.feedback) {
    const prepared = prepareModalFeedback(
      choiceModalFeedback(
        item.feedback,
        item.responseCardinality,
        item.responseIdentifier ?? "RESPONSE",
        item.scoring ?? "match_correct",
      ),
      responses,
      {
        root: "feedback",
        outcome: (_index, field) =>
          field === "identifier" ? "feedback.outcomeIdentifier" : "responseCardinality",
        entry: (index) => `feedback.entries.${index}`,
      },
    );
    prepared.diagnostics.push(...validateChoiceFeedback(item));
    if (item.modalFeedback)
      prepared.diagnostics.push({
        code: "conflicting_feedback_models",
        path: "modalFeedback",
        message: "Use either choice feedback or item-level modalFeedback on one item.",
      });
    return prepared;
  }
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
): Qti3WriterDiagnostic[] {
  return [...validate(item), ...prepareItemFeedback(item).diagnostics];
}

export function writePreparedItem<T extends Qti3AuthoringItem>(
  item: T,
  validate: (input: T) => Qti3WriterDiagnostic[],
  render: (input: T, feedback: PreparedFeedback) => string,
): Qti3WriterResult {
  const feedback = prepareItemFeedback(item);
  const diagnostics = [...validate(item), ...feedback.diagnostics];
  return diagnostics.length
    ? { ok: false, diagnostics }
    : { ok: true, xml: render(item, feedback), diagnostics: [] };
}

export function buildPreparedItem<T extends Qti3AuthoringItem>(
  item: T,
  validate: (input: T) => Qti3WriterDiagnostic[],
  render: (input: T, feedback: PreparedFeedback) => string,
): string {
  const result = writePreparedItem(item, validate, render);
  if (!result.ok) throw new Qti3WriterError(result.diagnostics);
  return result.xml;
}

/** Resolve authoring policy before handing final XML sections to the assembler. */
export function composeAssessmentItem(
  input: Omit<AssessmentItemShellInput, "outcomeDeclarationsXml" | "modalFeedbackXml"> &
    Qti3AuthoringItemBase,
  feedback: PreparedFeedback,
): string {
  return assessmentItemShell({
    ...input,
    outcomeDeclarationsXml: feedback.outcomeDeclarationsXml,
    modalFeedbackXml: feedback.modalFeedbackXml,
    responseProcessingXml: feedback.responseProcessingXml ?? input.responseProcessingXml,
  });
}
