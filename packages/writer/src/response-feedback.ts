import { prepareModalFeedback, type PreparedFeedback } from "./modal-feedback.js";
import type {
  Qti3ChoiceAuthoringItem,
  Qti3InlineChoiceAuthoringItem,
  Qti3ModalFeedbackEntry,
  Qti3ResponseFeedback,
} from "./types.js";
import { escapeXmlAttribute } from "./xml.js";

/**
 * Inner processing rules that select CORRECT or INCORRECT from the complete response.
 * Returns "" when no whole-response feedback is authored.
 */
export function responseFeedbackRulesXml(
  responseIdentifiers: readonly string[],
  feedback: Qti3ResponseFeedback | undefined,
): string {
  if (feedback === undefined) return "";
  const outcome = escapeXmlAttribute((feedback.outcomeIdentifier ?? "RESPONSE_FEEDBACK").trim());
  const matches = responseIdentifiers.map((id) => {
    const identifier = escapeXmlAttribute(id.trim());
    return `<qti-match><qti-variable identifier="${identifier}"/><qti-correct identifier="${identifier}"/></qti-match>`;
  });
  const answered = responseIdentifiers.map(
    (id) =>
      `<qti-not><qti-is-null><qti-variable identifier="${escapeXmlAttribute(id.trim())}"/></qti-is-null></qti-not>`,
  );
  const conjunction = (expressions: readonly string[]) =>
    expressions.length === 1 ? expressions[0] : `<qti-and>${expressions.join("")}</qti-and>`;
  const anyAnswered = answered.length === 1 ? answered[0] : `<qti-or>${answered.join("")}</qti-or>`;
  const select = (identifier: "CORRECT" | "INCORRECT") =>
    `<qti-set-outcome-value identifier="${outcome}"><qti-base-value base-type="identifier">${identifier}</qti-base-value></qti-set-outcome-value>`;
  return `    <qti-set-outcome-value identifier="${outcome}"><qti-null/></qti-set-outcome-value>
    <qti-response-condition>
      <qti-response-if>
        ${conjunction([...answered, ...matches])}
        ${select("CORRECT")}
      </qti-response-if>
      <qti-response-else-if>
        ${anyAnswered}
        ${select("INCORRECT")}
      </qti-response-else-if>
    </qti-response-condition>`;
}

/** Lower exact-response explanations through the existing modal content contract. */
export function prepareResponseFeedback(
  item: Qti3ChoiceAuthoringItem | Qti3InlineChoiceAuthoringItem,
  feedback: Qti3ResponseFeedback,
): PreparedFeedback {
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
