import {
  validateQtiRubricFragment,
  isQtiIdentifier,
  isQtiPackageItemHref,
  testFailure,
  type QtiFixedTestItemRef,
  type QtiTestResult,
} from "@longsightgroup/qti3-core";
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
      readonly shuffle?: boolean | undefined;
      readonly items: readonly QtiFixedTestItemRef[];
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
  const register = (id: string) => isQtiIdentifier(id) && !ids.has(id) && !!ids.add(id);
  if (!register(test.identifier) || !test.parts.length)
    return testFailure(
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
      return testFailure("fixed_part", "Invalid fixed test part or time limits.");
    for (const section of part.sections) {
      if (!register(section.identifier))
        return testFailure("fixed_section", "Invalid or duplicate section identifier.");
      if (section.shuffle !== undefined && typeof section.shuffle !== "boolean")
        return testFailure("fixed_shuffle", "Section shuffle must be a boolean.");
      for (const item of section.items) {
        if (!register(item.identifier) || !isQtiPackageItemHref(item.href))
          return testFailure("fixed_reference", "Invalid fixed item reference.");
        if (item.fixed !== undefined && typeof item.fixed !== "boolean")
          return testFailure("fixed_slot", "Item fixed must be a boolean.");
      }
    }
    for (const feedback of part.feedback)
      if (!register(feedback.identifier) || !isQtiIdentifier(feedback.outcomeIdentifier))
        return testFailure("fixed_feedback", "Invalid feedback identifier.");
  }
  const xml = testDocument(test, test.parts.map(writePart));
  const diagnostics = validateQtiRubricFragment(xml, true).filter(
    (entry) => entry.severity === "error",
  );
  return diagnostics.length ? { ok: false, diagnostics } : { ok: true, value: xml };
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
      `<qti-assessment-section${xmlAttributes({ identifier: section.identifier, title: section.title, visible: true })}>${section.shuffle === undefined ? "" : `<qti-ordering${xmlAttributes({ shuffle: section.shuffle })}/>`}${section.items.map(writeTestItemRef).join("\n")}</qti-assessment-section>`,
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
