import { parseQtiXml } from "@longsightgroup/qti3-core";
import { isQtiIdentifier } from "./identifier.js";
import type { Qti3ModalFeedback, Qti3WriterDiagnostic } from "./types.js";
import { escapeXmlAttribute, escapeXmlText } from "./xml.js";

const reservedOutcomeIdentifiers = new Set([
  "SCORE",
  "completionStatus",
  "numAttempts",
  "duration",
  "QTI_CONTEXT",
]);
const feedbackCardinalities: ReadonlySet<string> = new Set(["single", "multiple"]);
const feedbackVisibilityValues: ReadonlySet<string> = new Set(["show", "hide"]);

/** Validate item-level modal feedback independently of interaction type. */
export function validateModalFeedback(
  feedback: Qti3ModalFeedback,
  responseIdentifier: string | undefined,
): Qti3WriterDiagnostic[] {
  const diagnostics: Qti3WriterDiagnostic[] = [];
  const outcomes = new Set<string>();
  if (feedback.outcomes.length === 0) {
    diagnostics.push({
      code: "missing_feedback_outcomes",
      path: "modalFeedback.outcomes",
      message: "Modal feedback requires at least one identifier outcome.",
    });
  }
  for (const [index, outcome] of feedback.outcomes.entries()) {
    const identifier = outcome.identifier.trim();
    const path = `modalFeedback.outcomes.${index}`;
    if (!isQtiIdentifier(identifier)) {
      diagnostics.push({
        code: "invalid_identifier",
        path: `${path}.identifier`,
        message: "Feedback outcome identifier must be a valid QTI identifier.",
      });
    }
    if (outcomes.has(identifier)) {
      diagnostics.push({
        code: "duplicate_identifier",
        path: `${path}.identifier`,
        message: `Duplicate feedback outcome ${identifier}.`,
      });
    }
    outcomes.add(identifier);
    if (reservedOutcomeIdentifiers.has(identifier) || identifier === responseIdentifier?.trim()) {
      diagnostics.push({
        code: "invalid_feedback_outcome",
        path: `${path}.identifier`,
        message: "Feedback outcome identifier conflicts with an existing or built-in variable.",
      });
    }
    if (!feedbackCardinalities.has(outcome.cardinality)) {
      diagnostics.push({
        code: "invalid_feedback_cardinality",
        path: `${path}.cardinality`,
        message: "Feedback outcome cardinality must be single or multiple.",
      });
    }
    const defaults = outcome.defaultValues ?? [];
    if (outcome.cardinality === "single" && defaults.length > 1) {
      diagnostics.push({
        code: "invalid_feedback_default",
        path: `${path}.defaultValues`,
        message: "A single feedback outcome can have at most one default value.",
      });
    }
    for (const [valueIndex, value] of defaults.entries()) {
      if (!isQtiIdentifier(value.trim())) {
        diagnostics.push({
          code: "invalid_identifier",
          path: `${path}.defaultValues.${valueIndex}`,
          message: "Feedback default value must be a valid QTI identifier.",
        });
      }
    }
  }

  const entries = new Set<string>();
  if (feedback.entries.length === 0) {
    diagnostics.push({
      code: "missing_feedback_entries",
      path: "modalFeedback.entries",
      message: "Modal feedback requires at least one entry.",
    });
  }
  for (const [index, entry] of feedback.entries.entries()) {
    const path = `modalFeedback.entries.${index}`;
    const outcome = entry.outcomeIdentifier.trim();
    const identifier = entry.identifier.trim();
    if (!outcomes.has(outcome)) {
      diagnostics.push({
        code: "unknown_feedback_outcome",
        path: `${path}.outcomeIdentifier`,
        message: `Modal feedback references undeclared outcome ${outcome}.`,
      });
    }
    if (!isQtiIdentifier(identifier)) {
      diagnostics.push({
        code: "invalid_identifier",
        path: `${path}.identifier`,
        message: "Modal feedback identifier must be a valid QTI identifier.",
      });
    }
    const key = `${outcome}\n${identifier}`;
    if (entries.has(key)) {
      diagnostics.push({
        code: "duplicate_identifier",
        path: `${path}.identifier`,
        message: `Duplicate modal feedback ${identifier} for outcome ${outcome}.`,
      });
    }
    entries.add(key);
    if (entry.showHide !== undefined && !feedbackVisibilityValues.has(entry.showHide)) {
      diagnostics.push({
        code: "invalid_feedback_visibility",
        path: `${path}.showHide`,
        message: "Modal feedback showHide must be show or hide.",
      });
    }
    const hasText = Boolean(entry.text?.trim());
    const hasContent = Boolean(entry.contentHtml?.trim());
    if (hasText === hasContent) {
      diagnostics.push({
        code: "invalid_feedback_content",
        path,
        message: "Modal feedback requires exactly one text or contentHtml source.",
      });
    }
    if (hasContent) {
      const probe =
        parseQtiXml(`<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="feedback-probe" title="Feedback" time-dependent="false">
        <qti-outcome-declaration identifier="PROBE" cardinality="single" base-type="identifier"/>
        <qti-item-body/>
        <qti-modal-feedback outcome-identifier="PROBE" identifier="ENTRY" show-hide="show">${entry.contentHtml}</qti-modal-feedback>
      </qti-assessment-item>`);
      if (
        probe.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "xml.parse" || diagnostic.code === "feedback.interaction.forbidden",
        )
      ) {
        diagnostics.push({
          code: "invalid_feedback_content",
          path: `${path}.contentHtml`,
          message: "Modal feedback content must be valid QTI XML without interactions.",
        });
      }
    }
  }
  return diagnostics;
}

/** Render declared identifier outcomes for item-level feedback. */
export function modalFeedbackOutcomeXml(feedback: Qti3ModalFeedback): string {
  return feedback.outcomes
    .map((outcome) => {
      const identifier = escapeXmlAttribute(outcome.identifier.trim());
      const start = `  <qti-outcome-declaration identifier="${identifier}" cardinality="${outcome.cardinality}" base-type="identifier"`;
      const defaults = outcome.defaultValues ?? [];
      if (defaults.length === 0) return `${start}/>`;
      return `${start}>
    <qti-default-value>
${defaults.map((value) => `      <qti-value>${escapeXmlText(value.trim())}</qti-value>`).join("\n")}
    </qti-default-value>
  </qti-outcome-declaration>`;
    })
    .join("\n");
}

/** Render item-level feedback, retaining caller-supplied trusted QTI content. */
export function modalFeedbackEntriesXml(feedback: Qti3ModalFeedback): string {
  return feedback.entries
    .map((entry) => {
      const title = entry.title === undefined ? "" : ` title="${escapeXmlAttribute(entry.title)}"`;
      const content = entry.contentHtml ?? escapeXmlText(entry.text ?? "");
      return `  <qti-modal-feedback outcome-identifier="${escapeXmlAttribute(entry.outcomeIdentifier.trim())}" identifier="${escapeXmlAttribute(entry.identifier.trim())}" show-hide="${entry.showHide ?? "show"}"${title}>${content}</qti-modal-feedback>`;
    })
    .join("\n");
}
