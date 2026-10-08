import { prepareModalFeedback, type PreparedFeedback } from "./modal-feedback.js";
import type {
  Qti3ChoiceAuthoringItem,
  Qti3InlineChoiceAuthoringItem,
  Qti3ModalFeedbackEntry,
} from "./types.js";

/** Lower exact-response explanations through the existing modal content contract. */
export function prepareResponseFeedback(
  item: Qti3ChoiceAuthoringItem | Qti3InlineChoiceAuthoringItem,
): PreparedFeedback | undefined {
  const feedback = item.responseFeedback;
  if (!feedback) return undefined;
  const outcomeIdentifier = feedback.outcomeIdentifier ?? "RESPONSE_FEEDBACK";
  const entries: Qti3ModalFeedbackEntry[] = [];
  const paths: string[] = [];
  for (const [condition, identifier] of [
    ["correct", "CORRECT"],
    ["incorrect", "INCORRECT"],
  ] as const) {
    const content = feedback[condition];
    if (content === undefined) continue;
    entries.push({ outcomeIdentifier, identifier, ...content });
    paths.push(`responseFeedback.${condition}`);
  }
  const responses =
    item.interactionType === "choice"
      ? [item.responseIdentifier ?? "RESPONSE"]
      : item.slots.map((slot) => slot.responseIdentifier);
  const prepared = prepareModalFeedback(
    { outcomes: [{ identifier: outcomeIdentifier, cardinality: "single" }], entries },
    responses,
    {
      root: "responseFeedback",
      outcome: () => "responseFeedback.outcomeIdentifier",
      entry: (index) => paths[index] ?? "responseFeedback",
    },
  );
  if (
    item.modalFeedback !== undefined ||
    (item.interactionType === "choice" && item.feedback !== undefined)
  ) {
    prepared.diagnostics.push({
      code: "conflicting_feedback_models",
      path: "responseFeedback",
      message:
        "Use response feedback alone; another feedback model or custom processing must remain explicit.",
    });
  }
  if (
    item.interactionType === "choice" &&
    ((item.maxChoices !== undefined &&
      item.maxChoices > 0 &&
      item.maxChoices < item.correctResponse.length) ||
      (item.minChoices !== undefined && item.minChoices > item.correctResponse.length))
  ) {
    prepared.diagnostics.push({
      code: "unreachable_feedback_correct_response",
      path: "correctResponse",
      message: "Response feedback requires a complete correct answer within the selection limits.",
    });
  }
  if (item.interactionType === "inlineChoice") {
    for (const [index, slot] of item.slots.entries()) {
      if (!slot.correctResponse?.trim())
        prepared.diagnostics.push({
          code: "missing_feedback_correct_response",
          path: `slots.${index}.correctResponse`,
          message: "Response feedback requires a declared correct answer for every slot.",
        });
    }
  }
  return prepared;
}
