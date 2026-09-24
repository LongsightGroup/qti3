import { parseQtiXml, type QtiContentNode } from "@longsightgroup/qti3-core";
import { isQtiIdentifier } from "./identifier.js";
import {
  Qti3WriterError,
  type Qti3ModalFeedback,
  type Qti3ModalFeedbackEntry,
  type Qti3WriterDiagnostic,
} from "./types.js";
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
  responseIdentifiers: readonly string[],
): Qti3WriterDiagnostic[] {
  const diagnostics: Qti3WriterDiagnostic[] = [];
  const outcomes = new Set<string>();
  const responses = new Set(responseIdentifiers.map((identifier) => identifier.trim()));
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
    if (reservedOutcomeIdentifiers.has(identifier) || responses.has(identifier)) {
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
    const content = parseFeedbackContent(entry);
    if (!content.ok) {
      diagnostics.push({ code: "invalid_feedback_content", path, message: content.message });
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
      const content = parseFeedbackContent(entry);
      if (!content.ok) {
        throw new Qti3WriterError([
          {
            code: "invalid_feedback_content",
            path: "modalFeedback.entries",
            message: content.message,
          },
        ]);
      }
      return `  <qti-modal-feedback outcome-identifier="${escapeXmlAttribute(entry.outcomeIdentifier.trim())}" identifier="${escapeXmlAttribute(entry.identifier.trim())}" show-hide="${entry.showHide ?? "show"}"${title}>${content.xml}</qti-modal-feedback>`;
    })
    .join("\n");
}

/** Resolve the content source once per operation; validation and serialization share this boundary. */
function parseFeedbackContent(
  entry: Pick<Qti3ModalFeedbackEntry, "text" | "contentHtml">,
): { readonly ok: true; readonly xml: string } | { readonly ok: false; readonly message: string } {
  const hasText = Boolean(entry.text?.trim());
  const html = entry.contentHtml?.trim();
  const invalid = {
    ok: false,
    message:
      "Modal feedback requires exactly one content source with visible text; contentHtml must be valid XML.",
  } as const;
  if (hasText === Boolean(html)) return invalid;
  if (!html) return { ok: true, xml: escapeXmlText(entry.text ?? "") };
  const probe =
    parseQtiXml(`<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="feedback-probe" title="Feedback" time-dependent="false">
    <qti-outcome-declaration identifier="PROBE" cardinality="single" base-type="identifier"/>
    <qti-item-body/>
    <qti-modal-feedback outcome-identifier="PROBE" identifier="ENTRY" show-hide="show">${html}</qti-modal-feedback>
  </qti-assessment-item>`);
  if (
    probe.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "xml.parse" || diagnostic.code === "feedback.interaction.forbidden",
    )
  )
    return invalid;
  const parsed = probe.document?.item.modalFeedback[0];
  if (!parsed || (!parsed.text.trim() && !hasPrintedVariable(parsed.content ?? []))) return invalid;
  return { ok: true, xml: html };
}

function hasPrintedVariable(nodes: readonly QtiContentNode[]): boolean {
  return nodes.some(
    (node) =>
      node.kind === "printedVariable" || ("children" in node && hasPrintedVariable(node.children)),
  );
}
