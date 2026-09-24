import { validateQtiIdentifier, writerDiagnostic } from "./diagnostics.js";
import { choiceFeedbackProcessingXml } from "./response-processing.js";
import { qti3TrustedXmlFragment } from "./types.js";
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
  responseIdentifier: string,
  scoring: "match_correct" | "map_response",
): Qti3ModalFeedback {
  const outcomeIdentifier = feedback.outcomeIdentifier ?? "FEEDBACK";
  return {
    responseProcessingXml: qti3TrustedXmlFragment(
      choiceFeedbackProcessingXml(
        responseIdentifier.trim(),
        cardinality,
        scoring,
        outcomeIdentifier.trim(),
        feedback.entries,
      ),
    ),
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
  const diagnostics: Qti3WriterDiagnostic[] = [];
  const seen = new Set<string>();
  const choices = new Set(input.choices.map((choice) => choice.identifier.trim()));
  for (const [index, entry] of feedback.entries.entries()) {
    const path = `feedback.entries.${index}.choiceIdentifier`;
    const choice = entry.choiceIdentifier.trim();
    if (seen.has(choice))
      diagnostics.push(
        writerDiagnostic(
          "duplicate_identifier",
          path,
          `Duplicate feedback choice identifier "${choice}".`,
        ),
      );
    seen.add(choice);
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
