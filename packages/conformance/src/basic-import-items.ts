import { createHash } from "node:crypto";
import {
  captureCertificationIdentity,
  type QtiCertificationIdentity,
} from "./certification-identity.js";
import { comparePackageAssets, type QtiPackageAssetEvidence } from "./package-asset-evidence.js";
import { syntheticImportPackage, textConstraintPackagePath } from "./synthetic-import-package.js";
import { verifyQtiValidatorEvidence, type QtiValidatorEvidence } from "./validator-evidence.js";
export type { QtiValidatorEvidence } from "./validator-evidence.js";
import { compareImportedItem, type QtiImportObservation } from "./item-import-preservation.js";
import {
  evaluateBasicImportItemChecklist,
  type QtiImportChecklistCoverage,
} from "./basic-import-item-checklist.js";
import { readFile } from "node:fs/promises";
import { join, posix } from "node:path";
import {
  parseQtiXml,
  uniqueDiagnostics,
  validateAssessmentItem,
  type QtiDiagnostic,
  type QtiPackageItem,
} from "@longsightgroup/qti3-core";
import {
  certificationDiagnostic,
  manifestResourceHrefs,
  parseOfficialQtiPackage,
  scopePackageDiagnostics,
} from "./certification-package.js";

export type QtiBasicImportExpectation =
  | "valid-item"
  | "invalid-item"
  | "stores-choice-cardinality"
  | "stores-simple-choice-identifiers"
  | "stores-interaction-class"
  | "stores-interaction-data-attribute"
  | "stores-extended-text-interaction"
  | "stores-text-entry-interaction"
  | "stores-alt-text"
  | "stores-fixed-template";

export interface QtiBasicImportAcceptanceCriterion {
  readonly origin?: "synthetic" | undefined;
  readonly acId: string;
  readonly featureId: string;
  readonly label: string;
  readonly sourcePath: string;
  readonly packagePath?: string | undefined;
  readonly expectation: QtiBasicImportExpectation;
  readonly expectedDiagnosticCodes?: readonly string[] | undefined;
  readonly requiredInteractionClasses?: readonly string[] | undefined;
  readonly requiredDataAttributes?: readonly string[] | undefined;
}

export type QtiCertificationRowStatus = "passed" | "failed";

export interface QtiCertificationReportRow extends QtiBasicImportAcceptanceCriterion {
  readonly observations?: readonly QtiImportObservation[] | undefined;
  readonly inputSha256?: string | undefined;
  readonly status: QtiCertificationRowStatus;
  readonly diagnostics: readonly QtiDiagnostic[];
}

export interface QtiPackageImportEvidence {
  readonly packagePath: string;
  readonly sha256?: string | undefined;
  readonly itemResourceHrefs: readonly string[];
  readonly ignoredResourceHrefs: readonly string[];
  readonly assets: readonly QtiPackageAssetEvidence[];
  readonly diagnostics: readonly QtiDiagnostic[];
}

export interface QtiBasicImportItemOnlyCertificationOptions {
  readonly qtiRoot: string;
  readonly conformanceSource?: string | undefined;
  readonly validatorReport?: string | undefined;
  readonly validatorPackage?: string | undefined;
  readonly trustedValidatorReportSha256?: string | undefined;
  /** Require a passing, artifact-bound report under the explicit operator trust policy. */
  readonly requireValidatorEvidence?: boolean | undefined;
  readonly criteria?: readonly QtiBasicImportAcceptanceCriterion[] | undefined;
}

export interface QtiBasicImportItemOnlyCertificationReport {
  readonly schemaVersion: 1;
  readonly identity: QtiCertificationIdentity;
  readonly automatedEvidenceReady: boolean;
  readonly runScope: "full" | "selection";
  readonly coverage: QtiImportChecklistCoverage;
  readonly targetCapability: "IMPORT";
  readonly targetLevel: "Basic";
  readonly targetScope: "Item Only Packages";
  readonly conformanceSource: string;
  readonly qtiRoot: string;
  readonly checked: number;
  readonly failed: number;
  readonly ok: boolean;
  readonly packages: readonly QtiPackageImportEvidence[];
  readonly rows: readonly QtiCertificationReportRow[];
  readonly validatorEvidence: QtiValidatorEvidence | undefined;
  readonly diagnostics: readonly QtiDiagnostic[];
}

const basicPackagePaths = {
  a1: "Basic/A1 - Alternate Text for Graphics/A1AlternativeGraphics.zip",
  i9b: "Basic/I9b - Response Processing Fixed Template/I9bResponseProcessingFixedTemplate.zip",
  q2Multiple:
    "Basic/Q2 - Choice Interaction/multiple-cardinality/Q2Choice_multiple-cardinality.zip",
  q2Single: "Basic/Q2 - Choice Interaction/single-cardinality/Q2Choice_single-cardinality.zip",
  q5: "Basic/Q5 - Extended Text Entry Interaction/baseType-string/Q5ExtendedTextString.zip",
  q20: "Basic/Q20 - Text Entry Interaction/baseType-string/Q20TextEntryString.zip",
} as const;

export const basicImportItemOnlyCriteria: readonly QtiBasicImportAcceptanceCriterion[] = [
  criterion(
    "A1-L1-I1",
    "A-1",
    "alternate text remains associated with image",
    basicPackagePaths.a1,
    "Basic/A1 - Alternate Text for Graphics/alternate-text-for-graphics.xml",
    "stores-alt-text",
  ),
  criterion(
    "I9-L1-I1",
    "I-9b",
    "fixed response-processing template is retained",
    basicPackagePaths.i9b,
    "Basic/I9b - Response Processing Fixed Template/match-correct-identifier/match-correct-identifier.xml",
    "stores-fixed-template",
  ),
  criterion(
    "I9-L1-I2",
    "I-9b",
    "map-response template is retained",
    basicPackagePaths.i9b,
    "Basic/I9b - Response Processing Fixed Template/map-response-identifier/map-response-identifier.xml",
    "stores-fixed-template",
  ),
  criterion(
    "Q2-L1-I1",
    "Q-2",
    "multiple-cardinality choice imports",
    basicPackagePaths.q2Multiple,
    "Basic/Q2 - Choice Interaction/multiple-cardinality/multiple-cardinality.xml",
    "stores-choice-cardinality",
  ),
  criterion(
    "Q2-L1-I2",
    "Q-2",
    "multiple-cardinality choices keep identifiers",
    basicPackagePaths.q2Multiple,
    "Basic/Q2 - Choice Interaction/multiple-cardinality/multiple-cardinality.xml",
    "stores-simple-choice-identifiers",
  ),
  criterion(
    "Q2-L1-I3",
    "Q-2",
    "multiple-cardinality min/max choices are retained",
    basicPackagePaths.q2Multiple,
    "Basic/Q2 - Choice Interaction/multiple-cardinality/multiple-cardinality.xml",
    "stores-choice-cardinality",
  ),
  criterion(
    "Q2-L1-I11",
    "Q-2",
    "single-cardinality choice imports",
    basicPackagePaths.q2Single,
    "Basic/Q2 - Choice Interaction/single-cardinality/single-cardinality.xml",
    "stores-choice-cardinality",
  ),
  criterion(
    "Q2-L1-I12",
    "Q-2",
    "single-cardinality choices keep identifiers",
    basicPackagePaths.q2Single,
    "Basic/Q2 - Choice Interaction/single-cardinality/single-cardinality.xml",
    "stores-simple-choice-identifiers",
  ),
  criterion(
    "Q2-L1-I13",
    "Q-2",
    "single-cardinality min/max choices are retained",
    basicPackagePaths.q2Single,
    "Basic/Q2 - Choice Interaction/single-cardinality/single-cardinality.xml",
    "stores-choice-cardinality",
  ),
  invalidCriterion(
    "Q2-L1-I14",
    "Q-2",
    "single-cardinality invalid XML is rejected",
    basicPackagePaths.q2Single,
    "Basic/Q2 - Choice Interaction/single-cardinality/single-cardinality-invalid.xml",
    ["xml.parse"],
  ),
  ...choiceClassCriteria("multiple-cardinality", [
    ["Q2-L1-I102", "multiple-cardinality-sv-2a.xml", ["qti-labels-lower-alpha"]],
    ["Q2-L1-I103", "multiple-cardinality-sv-2b.xml", ["qti-labels-upper-alpha"]],
    ["Q2-L1-I104", "multiple-cardinality-sv-2c.xml", ["qti-labels-decimal"]],
    ["Q2-L1-I105", "multiple-cardinality-sv-2d.xml", ["qti-labels-none"]],
    [
      "Q2-L1-I106",
      "multiple-cardinality-sv-3a.xml",
      ["qti-labels-lower-alpha", "qti-labels-suffix-parenthesis"],
    ],
    [
      "Q2-L1-I107",
      "multiple-cardinality-sv-3b.xml",
      ["qti-labels-lower-alpha", "qti-labels-suffix-period"],
    ],
    [
      "Q2-L1-I108",
      "multiple-cardinality-sv-3c.xml",
      ["qti-labels-lower-alpha", "qti-labels-suffix-none"],
    ],
    [
      "Q2-L1-I109",
      "multiple-cardinality-sv-3d.xml",
      ["qti-labels-upper-alpha", "qti-labels-suffix-parenthesis"],
    ],
    [
      "Q2-L1-I110",
      "multiple-cardinality-sv-3e.xml",
      ["qti-labels-upper-alpha", "qti-labels-suffix-period"],
    ],
    [
      "Q2-L1-I111",
      "multiple-cardinality-sv-3f.xml",
      ["qti-labels-upper-alpha", "qti-labels-suffix-none"],
    ],
    [
      "Q2-L1-I112",
      "multiple-cardinality-sv-3g.xml",
      ["qti-labels-decimal", "qti-labels-suffix-parenthesis"],
    ],
    [
      "Q2-L1-I113",
      "multiple-cardinality-sv-3h.xml",
      ["qti-labels-decimal", "qti-labels-suffix-period"],
    ],
    [
      "Q2-L1-I114",
      "multiple-cardinality-sv-3i.xml",
      ["qti-labels-decimal", "qti-labels-suffix-none"],
    ],
    ["Q2-L1-I115", "multiple-cardinality-sv-3j.xml", ["qti-labels-suffix-none"]],
    ["Q2-L1-I116", "multiple-cardinality-sv-3k.xml", ["qti-labels-suffix-period"]],
    ["Q2-L1-I117", "multiple-cardinality-sv-3l.xml", ["qti-labels-suffix-parenthesis"]],
  ]),
  ...choiceClassCriteria("single-cardinality", [
    ["Q2-L1-I202", "single-cardinality-sv-2a.xml", ["qti-labels-none"]],
    ["Q2-L1-I203", "single-cardinality-sv-2b.xml", ["qti-labels-decimal"]],
    ["Q2-L1-I204", "single-cardinality-sv-2c.xml", ["qti-labels-lower-alpha"]],
    ["Q2-L1-I205", "single-cardinality-sv-2d.xml", ["qti-labels-upper-alpha"]],
    [
      "Q2-L1-I206",
      "single-cardinality-sv-3a.xml",
      ["qti-labels-lower-alpha", "qti-labels-suffix-none"],
    ],
    [
      "Q2-L1-I207",
      "single-cardinality-sv-3b.xml",
      ["qti-labels-lower-alpha", "qti-labels-suffix-period"],
    ],
    [
      "Q2-L1-I208",
      "single-cardinality-sv-3c.xml",
      ["qti-labels-lower-alpha", "qti-labels-suffix-parenthesis"],
    ],
    [
      "Q2-L1-I209",
      "single-cardinality-sv-3d.xml",
      ["qti-labels-upper-alpha", "qti-labels-suffix-none"],
    ],
    [
      "Q2-L1-I210",
      "single-cardinality-sv-3e.xml",
      ["qti-labels-upper-alpha", "qti-labels-suffix-period"],
    ],
    [
      "Q2-L1-I211",
      "single-cardinality-sv-3f.xml",
      ["qti-labels-upper-alpha", "qti-labels-suffix-parenthesis"],
    ],
    [
      "Q2-L1-I212",
      "single-cardinality-sv-3g.xml",
      ["qti-labels-decimal", "qti-labels-suffix-none"],
    ],
    [
      "Q2-L1-I213",
      "single-cardinality-sv-3h.xml",
      ["qti-labels-decimal", "qti-labels-suffix-period"],
    ],
    [
      "Q2-L1-I214",
      "single-cardinality-sv-3i.xml",
      ["qti-labels-decimal", "qti-labels-suffix-parenthesis"],
    ],
    ["Q2-L1-I215", "single-cardinality-sv-3j.xml", ["qti-labels-suffix-none"]],
    ["Q2-L1-I216", "single-cardinality-sv-3k.xml", ["qti-labels-suffix-period"]],
    ["Q2-L1-I217", "single-cardinality-sv-3l.xml", ["qti-labels-suffix-parenthesis"]],
  ]),
  criterion(
    "Q5-L1-I1",
    "Q-5",
    "extended text interaction imports",
    basicPackagePaths.q5,
    "Basic/Q5 - Extended Text Entry Interaction/baseType-string/base-type-string.xml",
    "stores-extended-text-interaction",
  ),
  invalidCriterion(
    "Q5-L1-I11",
    "Q-5",
    "extended text invalid namespace is rejected",
    basicPackagePaths.q5,
    "Basic/Q5 - Extended Text Entry Interaction/baseType-string/base-type-string-invalid.xml",
    ["qti.root"],
  ),
  ...extendedTextClassCriteria([
    ["Q5-L1-I101", "extended-text-sv-1.xml", []],
    ["Q5-L1-I102", "extended-text-sv-2a.xml", ["qti-height-lines-3"]],
    ["Q5-L1-I103", "extended-text-sv-2b.xml", ["qti-height-lines-6"]],
    ["Q5-L1-I104", "extended-text-sv-2c.xml", ["qti-height-lines-15"]],
  ]),
  criterion(
    "Q20-L1-I1",
    "Q-20",
    "text entry interaction imports",
    basicPackagePaths.q20,
    "Basic/Q20 - Text Entry Interaction/baseType-string/base-type-string.xml",
    "stores-text-entry-interaction",
  ),
  criterion(
    "Q20-L1-I2",
    "Q-20",
    "text entry pattern mask is retained",
    basicPackagePaths.q20,
    "Basic/Q20 - Text Entry Interaction/baseType-string/text-entry-sv-3.xml",
    "stores-interaction-data-attribute",
    { requiredDataAttributes: ["pattern-mask"] },
  ),
  {
    acId: "Q20-L1-I2-S1",
    featureId: "Q-20",
    label: "synthetic package preserves expected-length and pattern-mask",
    origin: "synthetic",
    packagePath: textConstraintPackagePath,
    sourcePath: "qti3-synthetic/text-entry-constraints.xml",
    expectation: "stores-interaction-data-attribute",
    requiredDataAttributes: ["expected-length", "pattern-mask"],
  },
  invalidCriterion(
    "Q20-L1-I11",
    "Q-20",
    "text entry invalid XML is rejected",
    basicPackagePaths.q20,
    "Basic/Q20 - Text Entry Interaction/baseType-string/base-type-string-invalid.xml",
    ["xml.parse"],
  ),
  ...textEntryClassCriteria([
    ["Q20-L1-I101", "text-entry-sv-1.xml", []],
    ["Q20-L1-I102", "text-entry-sv-2a.xml", ["qti-input-width-1"]],
    ["Q20-L1-I103", "text-entry-sv-2b.xml", ["qti-input-width-2"]],
    ["Q20-L1-I104", "text-entry-sv-2c.xml", ["qti-input-width-3"]],
    ["Q20-L1-I105", "text-entry-sv-2d.xml", ["qti-input-width-4"]],
    ["Q20-L1-I112", "text-entry-sv-2j.xml", ["qti-input-width-5"]],
    ["Q20-L1-I106", "text-entry-sv-2e.xml", ["qti-input-width-6"]],
    ["Q20-L1-I107", "text-entry-sv-2f.xml", ["qti-input-width-10"]],
    ["Q20-L1-I108", "text-entry-sv-2g.xml", ["qti-input-width-15"]],
    ["Q20-L1-I109", "text-entry-sv-2h.xml", ["qti-input-width-20"]],
    ["Q20-L1-I113", "text-entry-sv-2k.xml", ["qti-input-width-25"]],
    ["Q20-L1-I114", "text-entry-sv-2l.xml", ["qti-input-width-30"]],
    ["Q20-L1-I115", "text-entry-sv-2m.xml", ["qti-input-width-35"]],
    ["Q20-L1-I116", "text-entry-sv-2n.xml", ["qti-input-width-40"]],
    ["Q20-L1-I117", "text-entry-sv-2o.xml", ["qti-input-width-45"]],
    ["Q20-L1-I118", "text-entry-sv-2p.xml", ["qti-input-width-50"]],
    ["Q20-L1-I110", "text-entry-sv-2i.xml", ["qti-input-width-72"]],
  ]),
  criterion(
    "Q20-L1-I111",
    "Q-20",
    "text-entry data-patternmask-message is retained",
    basicPackagePaths.q20,
    "Basic/Q20 - Text Entry Interaction/baseType-string/text-entry-sv-3.xml",
    "stores-interaction-data-attribute",
    { requiredDataAttributes: ["data-patternmask-message"] },
  ),
];

/** Runs the first qti3-ts certification target: Basic IMPORT for item-only content. */
export async function runQti3BasicImportItemOnlyCertification(
  options: QtiBasicImportItemOnlyCertificationOptions,
): Promise<QtiBasicImportItemOnlyCertificationReport> {
  const criteria = options.criteria ?? basicImportItemOnlyCriteria;
  const packageIndex = await buildPackageImportIndex(options.qtiRoot, criteria);
  const rows = await Promise.all(
    criteria.map((entry) => runCriterion(options.qtiRoot, packageIndex, entry)),
  );
  const sourcePaths = new Set(
    criteria
      .filter((entry) => entry.origin !== "synthetic")
      .flatMap((entry) => [entry.sourcePath, ...(entry.packagePath ? [entry.packagePath] : [])]),
  );
  for (const evidence of packageIndex.evidenceByPackage.values()) {
    for (const asset of evidence.assets)
      sourcePaths.add(posix.join(posix.dirname(evidence.packagePath), asset.href));
  }
  const identity = await captureCertificationIdentity(options.qtiRoot, [...sourcePaths].toSorted());
  const coverage = evaluateBasicImportItemChecklist(rows, basicImportItemOnlyCriteria);
  const runScope = options.criteria === undefined ? "full" : "selection";
  const coverageFailed = runScope === "full" && !coverage.complete;
  const emptySelection = rows.length === 0;
  const validatorEvidence =
    options.validatorReport === undefined
      ? undefined
      : await verifyQtiValidatorEvidence({
          report: options.validatorReport,
          package: options.validatorPackage,
          trustedReportSha256: options.trustedValidatorReportSha256,
        });
  const validatorFailed =
    options.requireValidatorEvidence === true && validatorEvidence?.status !== "verified-pass";
  const failed =
    rows.filter((row) => row.status === "failed").length +
    (validatorFailed ? 1 : 0) +
    (coverageFailed || emptySelection ? 1 : 0);

  return {
    schemaVersion: 1,
    identity,
    automatedEvidenceReady:
      failed === 0 &&
      runScope === "full" &&
      coverage.complete &&
      identity.source.matchesReviewedSource &&
      identity.producer.clean &&
      identity.producer.revision !== undefined &&
      identity.producer.runtimeSha256 !== undefined,
    runScope,
    coverage,
    targetCapability: "IMPORT",
    targetLevel: "Basic",
    targetScope: "Item Only Packages",
    conformanceSource: `1EdTech/qti-conformance@${identity.source.revision ?? "unavailable"}`,
    qtiRoot: options.qtiRoot,
    checked: rows.length,
    failed,
    ok: failed === 0,
    packages: [...packageIndex.evidenceByPackage.values()],
    rows,
    validatorEvidence,
    diagnostics: [
      ...(coverageFailed ? coverage.diagnostics : []),
      ...(emptySelection
        ? [
            diagnostic(
              "certification.selection.empty",
              "An empty selection cannot establish import evidence.",
            ),
          ]
        : []),
      ...(validatorFailed
        ? [
            diagnostic(
              "certification.validator.unverified",
              "Required validator evidence did not establish a scoped passing result; inspect validatorEvidence.diagnostics.",
            ),
          ]
        : []),
    ],
  };
}

async function runCriterion(
  qtiRoot: string,
  packageIndex: QtiPackageImportIndex,
  criterionEntry: QtiBasicImportAcceptanceCriterion,
): Promise<QtiCertificationReportRow> {
  if (criterionEntry.packagePath === undefined) {
    return runLooseXmlCriterion(qtiRoot, criterionEntry);
  }

  const packageEntryPath = packageEntryPathForCriterion(criterionEntry);
  const itemKey = packageItemKey(criterionEntry.packagePath, packageEntryPath);
  const importedItem = packageIndex.itemsByPackageItem.get(itemKey);
  let xml = importedItem?.xml;

  const packageFailure = packageIndex.packageReadFailures.get(criterionEntry.packagePath);
  if (packageFailure) return failedRow(criterionEntry, packageFailure);

  if (xml === undefined && criterionEntry.expectation === "invalid-item") {
    try {
      xml = await readFile(join(qtiRoot, criterionEntry.sourcePath), "utf8");
    } catch (cause: unknown) {
      return failedRow(
        criterionEntry,
        diagnostic(
          "certification.file.read",
          `Unable to read known invalid fixture ${criterionEntry.sourcePath}.`,
          cause,
        ),
      );
    }
  }

  if (xml === undefined) {
    return failedRow(
      criterionEntry,
      diagnostic(
        "certification.package.itemResource.missing",
        `${criterionEntry.acId} expected item resource ${packageEntryPath} in ${criterionEntry.packagePath}.`,
      ),
    );
  }

  return runXmlCriterion(criterionEntry, xml, importedItem);
}

async function runLooseXmlCriterion(
  qtiRoot: string,
  criterionEntry: QtiBasicImportAcceptanceCriterion,
): Promise<QtiCertificationReportRow> {
  let xml: string;
  try {
    xml = await readFile(join(qtiRoot, criterionEntry.sourcePath), "utf8");
  } catch (cause: unknown) {
    return failedRow(
      criterionEntry,
      diagnostic("certification.file.read", `Unable to read ${criterionEntry.sourcePath}.`, cause),
    );
  }

  return runXmlCriterion(criterionEntry, xml);
}

function runXmlCriterion(
  criterionEntry: QtiBasicImportAcceptanceCriterion,
  xml: string,
  importedItem?: QtiPackageItem,
): QtiCertificationReportRow {
  const inputSha256 = createHash("sha256").update(xml).digest("hex");
  const parseResult = importedItem ?? parseQtiXml(xml);
  const validationDiagnostics = parseResult.document
    ? validateAssessmentItem(parseResult.document).diagnostics
    : [];
  const diagnostics = uniqueDiagnostics([...parseResult.diagnostics, ...validationDiagnostics]);

  if (criterionEntry.expectation === "invalid-item") {
    const passed = criterionEntry.expectedDiagnosticCodes?.some((code) =>
      diagnostics.some((item) => item.code === code),
    );
    return {
      ...criterionEntry,
      inputSha256,
      status: passed ? "passed" : "failed",
      diagnostics: passed
        ? diagnostics
        : [
            ...diagnostics,
            diagnostic(
              "certification.invalid.diagnosticMissing",
              `${criterionEntry.acId} expected diagnostic ${criterionEntry.expectedDiagnosticCodes?.join(" or ")}.`,
            ),
          ],
    };
  }

  if (!parseResult.document || diagnostics.some((item) => item.severity === "error")) {
    return { ...criterionEntry, inputSha256, status: "failed", diagnostics };
  }

  const preservation = compareImportedItem(xml, parseResult.document);
  const evidenceDiagnostic = evidenceDiagnosticFor(
    criterionEntry,
    parseResult.document,
    preservation.observations,
  );
  return {
    ...criterionEntry,
    status:
      evidenceDiagnostic === undefined && preservation.diagnostics.length === 0
        ? "passed"
        : "failed",
    inputSha256,
    observations: preservation.observations,
    diagnostics: [
      ...diagnostics,
      ...preservation.diagnostics,
      ...(evidenceDiagnostic ? [evidenceDiagnostic] : []),
    ],
  };
}

function evidenceDiagnosticFor(
  criterionEntry: QtiBasicImportAcceptanceCriterion,
  document: NonNullable<ReturnType<typeof parseQtiXml>["document"]>,
  observations: readonly QtiImportObservation[],
): QtiDiagnostic | undefined {
  const interaction = document.item.interactions[0];
  if (!interaction) {
    return diagnostic(
      "certification.evidence.interactionMissing",
      `${criterionEntry.acId} expected an interaction.`,
    );
  }

  if (criterionEntry.expectation === "stores-choice-cardinality") {
    if (
      interaction.qtiName !== "qti-choice-interaction" ||
      !("responseCardinality" in interaction) ||
      !("attributes" in interaction) ||
      interaction.attributes["min-choices"] === undefined ||
      interaction.attributes["max-choices"] === undefined
    ) {
      return diagnostic(
        "certification.evidence.choiceCardinality",
        `${criterionEntry.acId} did not preserve choice cardinality and min/max choices.`,
      );
    }
  }

  if (criterionEntry.expectation === "stores-simple-choice-identifiers") {
    if (
      interaction.qtiName !== "qti-choice-interaction" ||
      !("choices" in interaction) ||
      interaction.choices.length < 2 ||
      interaction.choices.some((choice) => choice.identifier.length === 0)
    ) {
      return diagnostic(
        "certification.evidence.choiceIdentifiers",
        `${criterionEntry.acId} did not preserve unique simple-choice identifiers.`,
      );
    }
  }

  if (
    criterionEntry.expectation === "stores-interaction-class" &&
    !hasRequiredClasses(
      interaction.attributes["class"],
      criterionEntry.requiredInteractionClasses ?? [],
    )
  ) {
    return diagnostic(
      "certification.evidence.interactionClass",
      `${criterionEntry.acId} did not preserve required interaction classes.`,
    );
  }

  if (
    criterionEntry.expectation === "stores-interaction-data-attribute" &&
    !hasRequiredDataAttributes(interaction.attributes, criterionEntry.requiredDataAttributes ?? [])
  ) {
    return diagnostic(
      "certification.evidence.dataAttribute",
      `${criterionEntry.acId} did not preserve required data attributes.`,
    );
  }

  if (
    criterionEntry.expectation === "stores-extended-text-interaction" &&
    interaction.qtiName !== "qti-extended-text-interaction"
  ) {
    return diagnostic(
      "certification.evidence.extendedText",
      `${criterionEntry.acId} did not import extended text interaction.`,
    );
  }

  if (
    criterionEntry.expectation === "stores-text-entry-interaction" &&
    interaction.qtiName !== "qti-text-entry-interaction"
  ) {
    return diagnostic(
      "certification.evidence.textEntry",
      `${criterionEntry.acId} did not import text entry interaction.`,
    );
  }

  if (
    criterionEntry.expectation === "stores-alt-text" &&
    !observations.some(
      (entry) =>
        entry.field.endsWith(".alt") && typeof entry.actual === "string" && entry.actual.length > 0,
    )
  ) {
    return diagnostic(
      "certification.evidence.altText",
      `${criterionEntry.acId} did not preserve img alt text in the imported model.`,
    );
  }

  if (
    criterionEntry.expectation === "stores-fixed-template" &&
    !document.item.responseProcessing?.template
  ) {
    return diagnostic(
      "certification.evidence.fixedTemplate",
      `${criterionEntry.acId} did not preserve fixed response-processing template.`,
    );
  }

  return undefined;
}

function hasRequiredClasses(
  value: string | undefined,
  requiredClasses: readonly string[],
): boolean {
  if (requiredClasses.length === 0) return value === undefined || value.trim().length === 0;
  const actual = new Set((value ?? "").split(/\s+/).filter((item) => item.length > 0));
  return requiredClasses.every((item) => actual.has(item));
}

function hasRequiredDataAttributes(
  attributes: Readonly<Record<string, string>>,
  requiredAttributes: readonly string[],
): boolean {
  return requiredAttributes.every((item) => attributes[item] !== undefined);
}

function criterion(
  acId: string,
  featureId: string,
  label: string,
  packagePath: string,
  sourcePath: string,
  expectation: QtiBasicImportExpectation,
  options: {
    readonly requiredInteractionClasses?: readonly string[] | undefined;
    readonly requiredDataAttributes?: readonly string[] | undefined;
  } = {},
): QtiBasicImportAcceptanceCriterion {
  return {
    acId,
    featureId,
    label,
    packagePath,
    sourcePath,
    expectation,
    ...options,
  };
}

function invalidCriterion(
  acId: string,
  featureId: string,
  label: string,
  packagePath: string,
  sourcePath: string,
  expectedDiagnosticCodes: readonly string[],
): QtiBasicImportAcceptanceCriterion {
  return {
    acId,
    featureId,
    label,
    packagePath,
    sourcePath,
    expectation: "invalid-item",
    expectedDiagnosticCodes,
  };
}

function choiceClassCriteria(
  cardinality: "multiple-cardinality" | "single-cardinality",
  rows: readonly (readonly [string, string, readonly string[]])[],
): QtiBasicImportAcceptanceCriterion[] {
  return rows.map(([acId, filename, classes]) =>
    criterion(
      acId,
      "Q-2",
      `${filename} preserves ${classes.join(" ") || "default choice"} class evidence`,
      cardinality === "multiple-cardinality"
        ? basicPackagePaths.q2Multiple
        : basicPackagePaths.q2Single,
      `Basic/Q2 - Choice Interaction/${cardinality}/${filename}`,
      "stores-interaction-class",
      { requiredInteractionClasses: classes },
    ),
  );
}

function extendedTextClassCriteria(
  rows: readonly (readonly [string, string, readonly string[]])[],
): QtiBasicImportAcceptanceCriterion[] {
  return rows.map(([acId, filename, classes]) =>
    criterion(
      acId,
      "Q-5",
      `${filename} preserves ${classes.join(" ") || "default extended-text"} class evidence`,
      basicPackagePaths.q5,
      `Basic/Q5 - Extended Text Entry Interaction/baseType-string/${filename}`,
      "stores-interaction-class",
      { requiredInteractionClasses: classes },
    ),
  );
}

function textEntryClassCriteria(
  rows: readonly (readonly [string, string, readonly string[]])[],
): QtiBasicImportAcceptanceCriterion[] {
  return rows.map(([acId, filename, classes]) =>
    criterion(
      acId,
      "Q-20",
      `${filename} preserves ${classes.join(" ") || "default text-entry"} class evidence`,
      basicPackagePaths.q20,
      `Basic/Q20 - Text Entry Interaction/baseType-string/${filename}`,
      "stores-interaction-class",
      { requiredInteractionClasses: classes },
    ),
  );
}

interface QtiPackageImportIndex {
  readonly itemsByPackageItem: ReadonlyMap<string, QtiPackageItem>;
  readonly evidenceByPackage: ReadonlyMap<string, QtiPackageImportEvidence>;
  readonly packageReadFailures: ReadonlyMap<string, QtiDiagnostic>;
}

async function buildPackageImportIndex(
  qtiRoot: string,
  criteria: readonly QtiBasicImportAcceptanceCriterion[],
): Promise<QtiPackageImportIndex> {
  const itemsByPackageItem = new Map<string, QtiPackageItem>();
  const evidenceByPackage = new Map<string, QtiPackageImportEvidence>();
  const packageReadFailures = new Map<string, QtiDiagnostic>();
  const uniquePackagePaths = [
    ...new Set(
      criteria.flatMap((entry) => (entry.packagePath === undefined ? [] : [entry.packagePath])),
    ),
  ].toSorted();

  for (const packagePath of uniquePackagePaths) {
    try {
      const bytes =
        syntheticImportPackage(packagePath) ?? (await readFile(join(qtiRoot, packagePath)));
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const parsed = parseOfficialQtiPackage(bytes);
      if (isUnreadablePackage(parsed)) {
        const failure = certificationDiagnostic(
          "certification.package.read",
          `Unable to read QTI package ${packagePath}.`,
        );
        packageReadFailures.set(packagePath, failure);
        evidenceByPackage.set(packagePath, {
          packagePath,
          itemResourceHrefs: [],
          ignoredResourceHrefs: [],
          assets: [],
          diagnostics: [failure],
        });
        continue;
      }

      if (parsed.diagnostics.some((item) => item.code === "package.manifest.missing")) {
        const failure = certificationDiagnostic(
          "certification.package.manifest.missing",
          `${packagePath} does not contain imsmanifest.xml.`,
        );
        packageReadFailures.set(packagePath, failure);
        evidenceByPackage.set(packagePath, {
          packagePath,
          itemResourceHrefs: [],
          ignoredResourceHrefs: [],
          assets: [],
          diagnostics: [failure],
        });
        continue;
      }

      const assetEvidence = await comparePackageAssets(qtiRoot, packagePath, parsed);
      const assetFailure = assetEvidence.diagnostics[0];
      if (assetFailure) packageReadFailures.set(packagePath, assetFailure);

      const itemResourceHrefs = manifestResourceHrefs(
        parsed.manifestResources,
        "imsqti_item_xmlv3p0",
      );
      const ignoredResourceHrefs = manifestResourceHrefs(
        parsed.manifestResources,
        "imsqti_test_xmlv3p0",
      );
      const itemsByHref = new Map(parsed.items.map((item) => [item.href, item]));
      const manifestDiagnostics = packageEvidenceDiagnostics(
        parsed,
        packagePath,
        itemResourceHrefs,
      );

      for (const href of itemResourceHrefs) {
        const item = itemsByHref.get(href);
        if (item) {
          itemsByPackageItem.set(packageItemKey(packagePath, href), item);
        }
      }

      evidenceByPackage.set(packagePath, {
        packagePath,
        itemResourceHrefs,
        ignoredResourceHrefs,
        sha256,
        assets: assetEvidence.assets,
        diagnostics: [...manifestDiagnostics, ...assetEvidence.diagnostics],
      });
    } catch (cause: unknown) {
      const failure = certificationDiagnostic(
        "certification.package.read",
        `Unable to read QTI package ${packagePath}.`,
        cause,
      );
      packageReadFailures.set(packagePath, failure);
      evidenceByPackage.set(packagePath, {
        packagePath,
        itemResourceHrefs: [],
        ignoredResourceHrefs: [],
        assets: [],
        diagnostics: [failure],
      });
    }
  }

  return { itemsByPackageItem, evidenceByPackage, packageReadFailures };
}

function isUnreadablePackage(parsed: ReturnType<typeof parseOfficialQtiPackage>): boolean {
  return (
    parsed.manifestResources.length === 0 &&
    parsed.items.length === 0 &&
    parsed.diagnostics.some((item) => item.code.startsWith("package.zip."))
  );
}

function packageEvidenceDiagnostics(
  parsed: ReturnType<typeof parseOfficialQtiPackage>,
  packagePath: string,
  itemResourceHrefs: readonly string[],
): QtiDiagnostic[] {
  const diagnostics = scopePackageDiagnostics(parsed.diagnostics, packagePath);

  const itemsByHref = new Set(parsed.items.map((item) => item.href));
  for (const href of itemResourceHrefs) {
    if (itemsByHref.has(href)) continue;
    if (
      diagnostics.some(
        (item) =>
          item.message.includes(href) &&
          (item.code === "package.manifest.file.missing" ||
            item.code === "certification.package.itemResource.missing"),
      )
    ) {
      continue;
    }
    diagnostics.push(
      certificationDiagnostic(
        "certification.package.itemResource.missing",
        `${packagePath} manifest item resource ${href} was not found in the zip.`,
      ),
    );
  }

  return diagnostics;
}

function packageEntryPathForCriterion(criterionEntry: QtiBasicImportAcceptanceCriterion): string {
  if (criterionEntry.packagePath === undefined) return criterionEntry.sourcePath;
  const packageDirectory = posix.dirname(criterionEntry.packagePath);
  const sourcePath = criterionEntry.sourcePath.replaceAll("\\", "/");
  return sourcePath.startsWith(`${packageDirectory}/`)
    ? sourcePath.slice(packageDirectory.length + 1)
    : sourcePath;
}

function packageItemKey(packagePath: string, itemPath: string): string {
  return `${packagePath}\n${itemPath}`;
}

function failedRow(
  criterionEntry: QtiBasicImportAcceptanceCriterion,
  rowDiagnostic: QtiDiagnostic,
): QtiCertificationReportRow {
  return {
    ...criterionEntry,
    status: "failed",
    diagnostics: [rowDiagnostic],
  };
}

function diagnostic(code: string, message: string, cause?: unknown): QtiDiagnostic {
  return certificationDiagnostic(code, message, cause);
}
