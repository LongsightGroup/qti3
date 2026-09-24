import { parseQtiModalFeedbackFragment, type QtiContentNode } from "@longsightgroup/qti3-core";
import { isQtiIdentifier } from "./identifier.js";
import {
  type Qti3ModalFeedback,
  type Qti3ModalFeedbackEntry,
  type Qti3WriterDiagnostic,
} from "./types.js";
import { trustedResponseProcessingXml } from "./response-processing.js";
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

export interface FeedbackPaths {
  readonly root: string;
  readonly outcome: (index: number, field: string) => string;
  readonly entry: (index: number) => string;
}

export interface PreparedFeedback {
  readonly diagnostics: Qti3WriterDiagnostic[];
  readonly outcomeDeclarationsXml: string;
  readonly modalFeedbackXml: string;
  readonly responseProcessingXml: string | undefined;
}

/** Validate and serialize once, retaining source paths supplied by the authoring adapter. */
export function prepareModalFeedback(
  feedback: Qti3ModalFeedback,
  responseIdentifiers: readonly string[],
  paths: FeedbackPaths = {
    root: "modalFeedback",
    outcome: (index, field) => `modalFeedback.outcomes.${index}.${field}`,
    entry: (index) => `modalFeedback.entries.${index}`,
  },
): PreparedFeedback {
  const diagnostics: Qti3WriterDiagnostic[] = [];
  const contentXml: string[] = [];
  const outcomes = new Set<string>();
  const responses = new Set(responseIdentifiers.map((identifier) => identifier.trim()));
  if (feedback.outcomes.length === 0) {
    diagnostics.push({
      code: "missing_feedback_outcomes",
      path: `${paths.root}.outcomes`,
      message: "Modal feedback requires at least one identifier outcome.",
    });
  }
  for (const [index, outcome] of feedback.outcomes.entries()) {
    const identifier = outcome.identifier.trim();
    const path = (field: string) => paths.outcome(index, field);
    if (!isQtiIdentifier(identifier)) {
      diagnostics.push({
        code: "invalid_identifier",
        path: path("identifier"),
        message: "Feedback outcome identifier must be a valid QTI identifier.",
      });
    }
    if (outcomes.has(identifier)) {
      diagnostics.push({
        code: "duplicate_identifier",
        path: path("identifier"),
        message: `Duplicate feedback outcome ${identifier}.`,
      });
    }
    outcomes.add(identifier);
    if (reservedOutcomeIdentifiers.has(identifier) || responses.has(identifier)) {
      diagnostics.push({
        code: "invalid_feedback_outcome",
        path: path("identifier"),
        message: "Feedback outcome identifier conflicts with an existing or built-in variable.",
      });
    }
    if (!feedbackCardinalities.has(outcome.cardinality)) {
      diagnostics.push({
        code: "invalid_feedback_cardinality",
        path: path("cardinality"),
        message: "Feedback outcome cardinality must be single or multiple.",
      });
    }
    const defaults = outcome.defaultValues ?? [];
    if (outcome.cardinality === "single" && defaults.length > 1) {
      diagnostics.push({
        code: "invalid_feedback_default",
        path: path("defaultValues"),
        message: "A single feedback outcome can have at most one default value.",
      });
    }
    for (const [valueIndex, value] of defaults.entries()) {
      if (!isQtiIdentifier(value.trim())) {
        diagnostics.push({
          code: "invalid_identifier",
          path: `${path("defaultValues")}.${valueIndex}`,
          message: "Feedback default value must be a valid QTI identifier.",
        });
      }
    }
  }

  const entries = new Set<string>();
  if (feedback.entries.length === 0) {
    diagnostics.push({
      code: "missing_feedback_entries",
      path: `${paths.root}.entries`,
      message: "Modal feedback requires at least one entry.",
    });
  }
  for (const [index, entry] of feedback.entries.entries()) {
    const path = paths.entry(index);
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
    const content = parseFeedbackContent(entry, path);
    diagnostics.push(...content.diagnostics);
    contentXml.push(content.xml);
  }
  return {
    diagnostics,
    outcomeDeclarationsXml: diagnostics.length ? "" : modalFeedbackOutcomeXml(feedback),
    modalFeedbackXml: diagnostics.length ? "" : modalFeedbackEntriesXml(feedback, contentXml),
    responseProcessingXml:
      feedback.responseProcessingXml === undefined
        ? undefined
        : trustedResponseProcessingXml(feedback.responseProcessingXml),
  };
}

/** Render declared identifier outcomes for item-level feedback. */
function modalFeedbackOutcomeXml(feedback: Qti3ModalFeedback): string {
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
function modalFeedbackEntriesXml(
  feedback: Qti3ModalFeedback,
  contentXml: readonly string[],
): string {
  return feedback.entries
    .map((entry, index) => {
      const title = entry.title === undefined ? "" : ` title="${escapeXmlAttribute(entry.title)}"`;
      return `  <qti-modal-feedback outcome-identifier="${escapeXmlAttribute(entry.outcomeIdentifier.trim())}" identifier="${escapeXmlAttribute(entry.identifier.trim())}" show-hide="${entry.showHide ?? "show"}"${title}>${contentXml[index]}</qti-modal-feedback>`;
    })
    .join("\n");
}

function parseFeedbackContent(
  entry: Pick<Qti3ModalFeedbackEntry, "text" | "contentHtml">,
  path: string,
): { xml: string; diagnostics: Qti3WriterDiagnostic[] } {
  const hasText = Boolean(entry.text?.trim());
  const html = entry.contentHtml?.trim();
  const empty = {
    xml: "",
    diagnostics: [
      {
        code: "invalid_feedback_content",
        path,
        message: "Modal feedback requires exactly one nonblank text or XML content source.",
      },
    ],
  };
  if (hasText === Boolean(html)) return empty;
  if (!html) return { xml: escapeXmlText(entry.text ?? ""), diagnostics: [] };
  const parsed = parseQtiModalFeedbackFragment(html);
  if (parsed.diagnostics.length) {
    return {
      xml: "",
      diagnostics: parsed.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        path: `${path}.contentHtml`,
        message: diagnostic.message,
        value: diagnostic.source,
      })),
    };
  }
  if (!parsed.text.trim() && !hasPrintedVariable(parsed.content)) return empty;
  return { xml: html, diagnostics: [] };
}

function hasPrintedVariable(nodes: readonly QtiContentNode[]): boolean {
  return nodes.some(
    (node) =>
      node.kind === "printedVariable" || ("children" in node && hasPrintedVariable(node.children)),
  );
}
