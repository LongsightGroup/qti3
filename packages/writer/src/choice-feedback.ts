import { duplicateDiagnostics, validateQtiIdentifier, writerDiagnostic } from "./diagnostics.js";
import { validateModalFeedback } from "./modal-feedback.js";
import type {
  Qti3ChoiceBuilderInput,
  Qti3ChoiceFeedback,
  Qti3ModalFeedback,
  Qti3WriterDiagnostic,
} from "./types.js";

/** Lower the choice convenience model to the shared item-level feedback model. */
export function choiceModalFeedback(
  feedback: Qti3ChoiceFeedback,
  cardinality: "single" | "multiple",
): Qti3ModalFeedback {
  const outcomeIdentifier = feedback.outcomeIdentifier ?? "FEEDBACK";
  return {
    outcomes: [{ identifier: outcomeIdentifier, cardinality }],
    entries: feedback.entries.map((entry) => ({
      outcomeIdentifier,
      identifier: entry.identifier,
      text: entry.text,
      contentHtml: entry.contentHtml,
    })),
  };
}

export function validateChoiceFeedback(input: Qti3ChoiceBuilderInput): Qti3WriterDiagnostic[] {
  const feedback = input.feedback;
  if (!feedback) return [];
  const diagnostics = validateModalFeedback(
    choiceModalFeedback(feedback, input.responseCardinality),
    [input.responseIdentifier ?? "RESPONSE"],
  ).map((diagnostic) => ({
    ...diagnostic,
    path:
      diagnostic.path === "modalFeedback.outcomes.0.identifier"
        ? "feedback.outcomeIdentifier"
        : diagnostic.code === "duplicate_identifier"
          ? "feedback.entries.identifier"
          : diagnostic.path.replace(/^modalFeedback/, "feedback"),
  }));
  if (input.modalFeedback) {
    diagnostics.push(
      writerDiagnostic(
        "conflicting_feedback_models",
        "modalFeedback",
        "Use either choice feedback or item-level modalFeedback on one item.",
      ),
    );
  }
  diagnostics.push(
    ...duplicateDiagnostics(
      feedback.entries.map((entry) => entry.choiceIdentifier),
      "feedback.entries.choiceIdentifier",
      "Feedback choice identifier",
    ),
  );
  const choices = new Set(input.choices.map((choice) => choice.identifier.trim()));
  for (const [index, entry] of feedback.entries.entries()) {
    const path = `feedback.entries.${index}.choiceIdentifier`;
    const invalid = validateQtiIdentifier(
      path,
      "Feedback choice identifier",
      entry.choiceIdentifier,
    );
    if (invalid) diagnostics.push(invalid);
    else if (!choices.has(entry.choiceIdentifier.trim())) {
      diagnostics.push(
        writerDiagnostic(
          "unknown_choice_reference",
          path,
          `Modal feedback references unknown choice "${entry.choiceIdentifier}".`,
          entry.choiceIdentifier,
        ),
      );
    }
  }
  return diagnostics;
}
