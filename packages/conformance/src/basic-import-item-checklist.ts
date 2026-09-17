import type { QtiDiagnostic } from "@longsightgroup/qti3-core";
import type {
  QtiBasicImportAcceptanceCriterion,
  QtiCertificationReportRow,
} from "./basic-import-items.js";
import { certificationDiagnostic } from "./certification-package.js";

/** Identity of the reviewed external workbook; no licensed criterion text is embedded. */
export const basicImportItemChecklistSource = {
  repository: "1EdTech/qti-conformance",
  revision: "b058156e3d7c7bcc45e18b1c5cb334d8e556c5e2",
  workbook: "QTI 3 IMPORT Certification Checklist.xlsx",
  sha256: "a5a7619c860d3d4a16a2f7391451c61f76991c8b0d865fefb89ee58318e2830b",
  sheet: "Basic IMPORT Items",
} as const;

/** A workbook row has its own identity even when the authored AC ID is duplicated. */
export interface QtiImportChecklistRow {
  readonly key: string;
  readonly row: number;
  readonly section: string;
  readonly originalAcId: string;
  readonly caseIds: readonly string[];
  readonly note?: string | undefined;
}

/** Coverage is independent of case success and of the external certification decision. */
export interface QtiImportChecklistCoverage {
  readonly source: typeof basicImportItemChecklistSource;
  readonly complete: boolean;
  readonly required: number;
  readonly exercised: number;
  readonly passed: number;
  readonly failed: number;
  readonly missing: number;
  readonly rows: readonly (QtiImportChecklistRow & {
    readonly status: "passed" | "failed" | "missing";
  })[];
  readonly supplementalCaseIds: readonly string[];
  readonly diagnostics: readonly QtiDiagnostic[];
}

const duplicateChoiceNote =
  "The workbook repeats choice IDs under a multiple-cardinality heading but describes single selection. Both single and multiple cases are required here; no row is excluded. Confirm the editorial interpretation at submission.";
const classAliasNote =
  "The workbook AC ID and fixture AC ID name different single-choice classes. Evidence is mapped by the authored class requirement, preserving both IDs.";

/** Reviewed row-to-case mapping for the pinned Basic IMPORT Items worksheet. */
export const basicImportItemChecklist: readonly QtiImportChecklistRow[] = [
  row(3, "A1", "A1-L1-I1"),
  row(5, "I9b", "I9-L1-I1", ["I9-L1-I1", "I9-L1-I2"]),
  row(6, "choice-before-section", "Q2-L1-I1"),
  row(7, "choice-before-section", "Q2-L1-I2"),
  row(8, "choice-before-section", "Q2-L1-I3"),
  row(10, "Q2-multiple", "Q2-L1-I1", ["Q2-L1-I1", "Q2-L1-I11"], duplicateChoiceNote),
  row(11, "Q2-multiple", "Q2-L1-I2", ["Q2-L1-I2", "Q2-L1-I12"], duplicateChoiceNote),
  row(12, "Q2-multiple", "Q2-L1-I3", ["Q2-L1-I3", "Q2-L1-I13"], duplicateChoiceNote),
  ...Array.from({ length: 16 }, (_, index) =>
    row(13 + index, "Q2-multiple", `Q2-L1-I${102 + index}`),
  ),
  row(30, "Q2-single", "Q2-L1-I11"),
  row(31, "Q2-single", "Q2-L1-I12"),
  row(32, "Q2-single", "Q2-L1-I13"),
  ...[204, 205, 203, 202, 208, 207, 206, 211, 210, 209, 214, 213, 212, 215, 216, 217].map(
    (caseNumber, index) =>
      row(
        33 + index,
        "Q2-single",
        `Q2-L1-I${202 + index}`,
        [`Q2-L1-I${caseNumber}`],
        caseNumber === 202 + index ? undefined : classAliasNote,
      ),
  ),
  row(50, "Q5-string", "Q5-L1-I1"),
  row(51, "Q5-string", "Q5-L1-I11"),
  ...Array.from({ length: 4 }, (_, index) =>
    row(
      52 + index,
      "Q5-string",
      `Q5-L1-${101 + index}`,
      [`Q5-L1-I${101 + index}`],
      "The workbook omits the I in these AC IDs; the fixture IDs include it.",
    ),
  ),
  row(57, "Q20-string", "Q20-L1-I1"),
  row(
    58,
    "Q20-string",
    "Q20-L1-I2",
    ["Q20-L1-I2", "Q20-L1-I2-S1"],
    "The official fixture supplies pattern-mask but no expected-length; an explicitly synthetic ZIP supplements expected-length evidence. Confirm this supplement at submission.",
  ),
  ...[101, 102, 103, 104, 105, 112, 106, 107, 108, 109, 113, 114, 115, 116, 117, 118, 110, 111].map(
    (caseNumber, index) => row(59 + index, "Q20-string", `Q20-L1-I${caseNumber}`),
  ),
];

/** Check report coverage against every reviewed worksheet row and exact case definition. */
export function evaluateBasicImportItemChecklist(
  results: readonly QtiCertificationReportRow[],
  definitions: readonly QtiBasicImportAcceptanceCriterion[],
): QtiImportChecklistCoverage {
  const diagnostics: QtiDiagnostic[] = [];
  const definitionsById = new Map(definitions.map((entry) => [entry.acId, entry]));
  const resultsById = new Map<string, QtiCertificationReportRow>();
  const invalidIds = new Set<string>();
  for (const result of results) {
    const expected = definitionsById.get(result.acId);
    if (resultsById.has(result.acId)) {
      invalidIds.add(result.acId);
      diagnostics.push(
        certificationDiagnostic(
          "certification.coverage.duplicateCase",
          `Duplicate evidence case ${result.acId}.`,
        ),
      );
    }
    if (!expected || definitionKey(expected) !== definitionKey(result)) {
      invalidIds.add(result.acId);
      diagnostics.push(
        certificationDiagnostic(
          "certification.coverage.unknownCase",
          `Unrecognized evidence definition for ${result.acId}.`,
        ),
      );
    }
    resultsById.set(result.acId, result);
  }
  const coveredIds = new Set(basicImportItemChecklist.flatMap((entry) => entry.caseIds));
  const rows = basicImportItemChecklist.map((entry) => {
    const cases = entry.caseIds.map((id) => (invalidIds.has(id) ? undefined : resultsById.get(id)));
    const status = cases.some((value) => value === undefined)
      ? ("missing" as const)
      : cases.some((value) => value?.status === "failed")
        ? ("failed" as const)
        : ("passed" as const);
    return { ...entry, status };
  });
  const missing = rows.filter((entry) => entry.status === "missing").length;
  if (missing > 0)
    diagnostics.push(
      certificationDiagnostic(
        "certification.coverage.missing",
        `${missing} required checklist rows lack recognized evidence.`,
      ),
    );
  return {
    source: basicImportItemChecklistSource,
    complete: missing === 0 && diagnostics.length === 0,
    required: rows.length,
    exercised: rows.length - missing,
    passed: rows.filter((entry) => entry.status === "passed").length,
    failed: rows.filter((entry) => entry.status === "failed").length,
    missing,
    rows,
    supplementalCaseIds: results
      .filter((entry) => !coveredIds.has(entry.acId))
      .map((entry) => entry.acId),
    diagnostics,
  };
}

function row(
  rowNumber: number,
  section: string,
  originalAcId: string,
  caseIds: readonly string[] = [originalAcId],
  note?: string,
): QtiImportChecklistRow {
  return {
    key: `${basicImportItemChecklistSource.revision}/${basicImportItemChecklistSource.sheet}/${rowNumber}/${section}/${originalAcId}`,
    row: rowNumber,
    section,
    originalAcId,
    caseIds,
    note,
  };
}

function definitionKey(entry: QtiBasicImportAcceptanceCriterion): string {
  return JSON.stringify([
    entry.origin,
    entry.acId,
    entry.featureId,
    entry.sourcePath,
    entry.packagePath,
    entry.expectation,
    entry.expectedDiagnosticCodes,
    entry.requiredInteractionClasses,
    entry.requiredDataAttributes,
  ]);
}
