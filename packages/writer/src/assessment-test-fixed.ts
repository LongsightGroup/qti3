import { type QtiTestItemRef, type QtiTestResult } from "@longsightgroup/qti3-core";
import type { Qti3TrustedXmlFragment } from "./types.js";
import { xmlAttributes } from "./xml.js";
import { testDocument, writeTestItemRef } from "./assessment-test.js";

/** Fixed tests may have multiple parts and delivery options; this is not an executable branching profile. */
export interface QtiFixedTestDefinition {
  readonly identifier: string;
  readonly title: string;
  readonly parts: readonly {
    readonly identifier: string;
    readonly title: string;
    readonly navigationMode: "linear" | "nonlinear";
    readonly submissionMode: "individual" | "simultaneous";
    readonly timeLimits?:
      | { readonly minTime?: number | undefined; readonly maxTime?: number | undefined }
      | undefined;
    readonly instructions?: Qti3TrustedXmlFragment | undefined;
    readonly sections: readonly {
      readonly identifier: string;
      readonly title: string;
      readonly items: readonly QtiTestItemRef[];
    }[];
    readonly feedback: readonly {
      readonly identifier: string;
      readonly outcomeIdentifier: string;
      readonly access: "during" | "atEnd";
      readonly showHide: "show" | "hide";
      readonly content: Qti3TrustedXmlFragment;
    }[];
  }[];
}

/** Serializes fixed delivery options in schema order, including QTI 3 content-body wrappers. */
export function writeQti3FixedAssessmentTest(test: QtiFixedTestDefinition): QtiTestResult<string> {
  const ids = new Set<string>();
  const register = (id: string) =>
    /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(id) && !ids.has(id) && !!ids.add(id);
  if (!register(test.identifier) || !test.parts.length)
    return invalid(
      "fixed_structure",
      "A fixed test needs a valid identifier and at least one part.",
    );
  for (const part of test.parts) {
    const limits = part.timeLimits;
    if (
      !register(part.identifier) ||
      !part.sections.length ||
      !["linear", "nonlinear"].includes(part.navigationMode) ||
      !["individual", "simultaneous"].includes(part.submissionMode) ||
      [limits?.minTime, limits?.maxTime].some(
        (n) => n !== undefined && (!Number.isFinite(n) || n < 0),
      ) ||
      (limits?.minTime !== undefined &&
        limits.maxTime !== undefined &&
        limits.minTime > limits.maxTime)
    )
      return invalid("fixed_part", "Invalid fixed test part or time limits.");
    for (const section of part.sections) {
      if (!register(section.identifier))
        return invalid("fixed_section", "Invalid or duplicate section identifier.");
      for (const item of section.items)
        if (
          !register(item.identifier) ||
          !item.href ||
          /(?:^|\/)\.\.(?:\/|$)|^[a-z]+:|^[/\\]/i.test(item.href)
        )
          return invalid("fixed_reference", "Invalid fixed item reference.");
    }
    for (const feedback of part.feedback)
      if (
        !register(feedback.identifier) ||
        !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(feedback.outcomeIdentifier)
      )
        return invalid("fixed_feedback", "Invalid feedback identifier.");
  }
  return { ok: true, value: testDocument(test, test.parts.map(writePart)) };
}

function writePart(part: QtiFixedTestDefinition["parts"][number]): string {
  const limits = part.timeLimits;
  const timing =
    limits && (limits.minTime !== undefined || limits.maxTime !== undefined)
      ? `<qti-time-limits${xmlAttributes({ "min-time": limits.minTime, "max-time": limits.maxTime })}/>`
      : "";
  const rubric = part.instructions
    ? `<qti-rubric-block view="candidate" use="instructions"><qti-content-body>${part.instructions}</qti-content-body></qti-rubric-block>`
    : "";
  const sections = part.sections.map(
    (section) =>
      `<qti-assessment-section${xmlAttributes({ identifier: section.identifier, title: section.title, visible: true })}>${section.items.map(writeTestItemRef).join("\n")}</qti-assessment-section>`,
  );
  const feedback = part.feedback.map(
    (entry) =>
      `<qti-test-feedback${xmlAttributes({ identifier: entry.identifier, "outcome-identifier": entry.outcomeIdentifier, access: entry.access, "show-hide": entry.showHide })}><qti-content-body>${entry.content}</qti-content-body></qti-test-feedback>`,
  );
  return [
    `<qti-test-part${xmlAttributes({ identifier: part.identifier, title: part.title, "navigation-mode": part.navigationMode, "submission-mode": part.submissionMode })}>`,
    timing,
    rubric,
    ...sections,
    ...feedback,
    "</qti-test-part>",
  ].join("\n");
}

function invalid(code: string, message: string): QtiTestResult<never> {
  return { ok: false, diagnostics: [{ code: `test.${code}`, severity: "error", message }] };
}
