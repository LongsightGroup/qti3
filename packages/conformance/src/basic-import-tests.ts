import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type QtiAssessmentSectionPackageModel,
  type QtiAssessmentTestItemRef,
  type QtiAssessmentTestPackageModel,
  type QtiDiagnostic,
  type QtiTestPartPackageModel,
} from "@longsightgroup/qti3-core";
import {
  certificationDiagnostic,
  collectImportableItemHrefs,
  manifestResourceHrefs,
  parseOfficialQtiTestPackage,
  primaryManifestResourceHref,
  scopePackageDiagnostics,
} from "./certification-package.js";

export type QtiBasicImportTestExpectation =
  | "stores-assessment-test"
  | "stores-test-part"
  | "stores-assessment-section"
  | "stores-section-item-refs";

export interface QtiBasicImportTestAcceptanceCriterion {
  readonly acId: string;
  readonly featureId: string;
  readonly label: string;
  readonly expectation: QtiBasicImportTestExpectation;
}

export type QtiBasicImportTestRowStatus = "passed" | "failed";

export interface QtiBasicImportTestReportRow extends QtiBasicImportTestAcceptanceCriterion {
  readonly status: QtiBasicImportTestRowStatus;
  readonly diagnostics: readonly QtiDiagnostic[];
}

export interface QtiBasicImportTestPackageEvidence {
  readonly packagePath: string;
  readonly testResourceHref: string | undefined;
  readonly itemResourceHrefs: readonly string[];
  readonly itemRefHrefs: readonly string[];
  readonly diagnostics: readonly QtiDiagnostic[];
}

export interface QtiBasicImportTestCertificationOptions {
  readonly qtiRoot: string;
  readonly conformanceSource?: string | undefined;
  readonly packagePath?: string | undefined;
  readonly criteria?: readonly QtiBasicImportTestAcceptanceCriterion[] | undefined;
}

export interface QtiBasicImportTestCertificationReport {
  readonly targetCapability: "IMPORT";
  readonly targetLevel: "Basic";
  readonly targetScope: "Test Structure Packages";
  readonly conformanceSource: string;
  readonly qtiRoot: string;
  readonly checked: number;
  readonly failed: number;
  readonly ok: boolean;
  readonly packageEvidence: QtiBasicImportTestPackageEvidence;
  readonly rows: readonly QtiBasicImportTestReportRow[];
}

const qtiConformanceSource = "1EdTech/qti-conformance@b058156";
const basicImportTestPackagePath = "Basic/T4 and T7 - Test Structures/T4T7TestStructures.zip";

export const basicImportTestCriteria: readonly QtiBasicImportTestAcceptanceCriterion[] = [
  {
    acId: "T4-L1-I1",
    featureId: "T-4",
    label: "assessment test identifier and title are retained",
    expectation: "stores-assessment-test",
  },
  {
    acId: "T4-L1-I2",
    featureId: "T-4",
    label: "test part identifier, navigation mode, and submission mode are retained",
    expectation: "stores-test-part",
  },
  {
    acId: "T7-L1-I1",
    featureId: "T-7",
    label: "assessment section identifier, title, and visible flag are retained",
    expectation: "stores-assessment-section",
  },
  {
    acId: "T7-L1-I2",
    featureId: "T-7",
    label: "four section item references are retained and associated with importable items",
    expectation: "stores-section-item-refs",
  },
];

/** Runs the Basic IMPORT Tests evidence map against the official T4/T7 package. */
export async function runQti3BasicImportTestCertification(
  options: QtiBasicImportTestCertificationOptions,
): Promise<QtiBasicImportTestCertificationReport> {
  const criteria = options.criteria ?? basicImportTestCriteria;
  const packagePath = options.packagePath ?? basicImportTestPackagePath;
  const packageModel = await readBasicImportTestPackage(options.qtiRoot, packagePath);
  const rows = criteria.map((entry) => runCriterion(entry, packageModel));
  const failed = rows.filter((row) => row.status === "failed").length;

  return {
    targetCapability: "IMPORT",
    targetLevel: "Basic",
    targetScope: "Test Structure Packages",
    conformanceSource: options.conformanceSource ?? qtiConformanceSource,
    qtiRoot: options.qtiRoot,
    checked: rows.length,
    failed,
    ok: failed === 0,
    packageEvidence: packageModel.evidence,
    rows,
  };
}

interface BasicImportTestPackageModel {
  readonly evidence: QtiBasicImportTestPackageEvidence;
  readonly assessmentTest: QtiAssessmentTestPackageModel | undefined;
  readonly testPart: QtiTestPartPackageModel | undefined;
  readonly assessmentSection: QtiAssessmentSectionPackageModel | undefined;
  readonly itemRefs: readonly QtiAssessmentTestItemRef[];
  readonly importableItemHrefs: ReadonlySet<string>;
}

async function readBasicImportTestPackage(
  qtiRoot: string,
  packagePath: string,
): Promise<BasicImportTestPackageModel> {
  const diagnostics: QtiDiagnostic[] = [];
  const emptyModel = (evidenceDiagnostics: QtiDiagnostic[]): BasicImportTestPackageModel => ({
    evidence: {
      packagePath,
      testResourceHref: undefined,
      itemResourceHrefs: [],
      itemRefHrefs: [],
      diagnostics: evidenceDiagnostics,
    },
    assessmentTest: undefined,
    testPart: undefined,
    assessmentSection: undefined,
    itemRefs: [],
    importableItemHrefs: new Set(),
  });

  let parsed: ReturnType<typeof parseOfficialQtiTestPackage>;
  try {
    parsed = parseOfficialQtiTestPackage(await readFile(join(qtiRoot, packagePath)));
  } catch (cause: unknown) {
    return emptyModel([
      certificationDiagnostic(
        "certification.package.read",
        `Unable to read QTI package ${packagePath}.`,
        cause,
      ),
    ]);
  }

  if (
    parsed.manifestResources.length === 0 &&
    parsed.items.length === 0 &&
    parsed.diagnostics.some((item) => item.code.startsWith("package.zip."))
  ) {
    return emptyModel([
      certificationDiagnostic(
        "certification.package.read",
        `Unable to read QTI package ${packagePath}.`,
      ),
    ]);
  }

  if (parsed.diagnostics.some((item) => item.code === "package.manifest.missing")) {
    diagnostics.push(
      certificationDiagnostic(
        "certification.package.manifest.missing",
        `${packagePath} does not contain imsmanifest.xml.`,
      ),
    );
  }

  diagnostics.push(
    ...scopePackageDiagnostics(parsed.diagnostics, packagePath).filter(
      (item) => item.code !== "package.manifest.file.missing",
    ),
  );

  const testResourceHref = primaryManifestResourceHref(
    parsed.manifestResources,
    "imsqti_test_xmlv3p0",
  );
  const itemResourceHrefs = manifestResourceHrefs(parsed.manifestResources, "imsqti_item_xmlv3p0");
  const assessmentTest = parsed.assessmentTest;

  if (testResourceHref === undefined) {
    diagnostics.push(
      certificationDiagnostic(
        "certification.package.testResource.missing",
        `${packagePath} manifest does not contain a QTI assessment-test resource.`,
      ),
    );
  } else if (!assessmentTest) {
    diagnostics.push(
      certificationDiagnostic(
        "certification.package.testResource.fileMissing",
        `${packagePath} manifest test resource ${testResourceHref} was not found in the zip.`,
      ),
    );
  }

  const testPart = assessmentTest?.testParts[0];
  const assessmentSection = testPart?.sections[0];
  const itemRefs = assessmentTest?.itemRefs ?? [];
  const itemRefHrefs = itemRefs.map((itemRef) => itemRef.href);
  const importableItemHrefs = collectImportableItemHrefs(
    parsed.items,
    itemRefHrefs,
    packagePath,
    diagnostics,
  );

  return {
    evidence: {
      packagePath,
      testResourceHref,
      itemResourceHrefs,
      itemRefHrefs,
      diagnostics,
    },
    assessmentTest,
    testPart,
    assessmentSection,
    itemRefs,
    importableItemHrefs,
  };
}

function runCriterion(
  criterionEntry: QtiBasicImportTestAcceptanceCriterion,
  packageModel: BasicImportTestPackageModel,
): QtiBasicImportTestReportRow {
  const diagnostics = packageModel.evidence.diagnostics.filter((item) => item.severity === "error");
  if (diagnostics.length > 0) {
    return { ...criterionEntry, status: "failed", diagnostics };
  }

  const evidenceDiagnostic = evidenceDiagnosticFor(criterionEntry, packageModel);
  return {
    ...criterionEntry,
    status: evidenceDiagnostic === undefined ? "passed" : "failed",
    diagnostics: evidenceDiagnostic === undefined ? [] : [evidenceDiagnostic],
  };
}

function evidenceDiagnosticFor(
  criterionEntry: QtiBasicImportTestAcceptanceCriterion,
  packageModel: BasicImportTestPackageModel,
): QtiDiagnostic | undefined {
  if (criterionEntry.expectation === "stores-assessment-test") {
    if (
      packageModel.assessmentTest?.identifier === undefined ||
      packageModel.assessmentTest.identifier.length === 0 ||
      packageModel.assessmentTest.title === undefined ||
      packageModel.assessmentTest.title.length === 0
    ) {
      return certificationDiagnostic(
        "certification.evidence.assessmentTest",
        `${criterionEntry.acId} did not retain assessment-test identifier and title.`,
      );
    }
  }

  if (criterionEntry.expectation === "stores-test-part") {
    if (
      packageModel.testPart?.attributes.identifier === undefined ||
      packageModel.testPart.attributes.identifier.length === 0 ||
      packageModel.testPart.attributes["navigation-mode"] === undefined ||
      packageModel.testPart.attributes["navigation-mode"].length === 0 ||
      packageModel.testPart.attributes["submission-mode"] === undefined ||
      packageModel.testPart.attributes["submission-mode"].length === 0
    ) {
      return certificationDiagnostic(
        "certification.evidence.testPart",
        `${criterionEntry.acId} did not retain test-part identifier, navigation-mode, and submission-mode.`,
      );
    }
  }

  if (criterionEntry.expectation === "stores-assessment-section") {
    if (
      packageModel.assessmentSection?.attributes.identifier === undefined ||
      packageModel.assessmentSection.attributes.identifier.length === 0 ||
      packageModel.assessmentSection.attributes.title === undefined ||
      packageModel.assessmentSection.attributes.title.length === 0 ||
      packageModel.assessmentSection.attributes.visible === undefined ||
      packageModel.assessmentSection.attributes.visible.length === 0
    ) {
      return certificationDiagnostic(
        "certification.evidence.assessmentSection",
        `${criterionEntry.acId} did not retain assessment-section identifier, title, and visible flag.`,
      );
    }
  }

  if (criterionEntry.expectation === "stores-section-item-refs") {
    const itemRefHrefs = packageModel.itemRefs.map((itemRef) => itemRef.href);
    const hasFourImportableItems =
      itemRefHrefs.length === 4 &&
      itemRefHrefs.every((href) => packageModel.importableItemHrefs.has(href));
    if (!hasFourImportableItems) {
      return certificationDiagnostic(
        "certification.evidence.sectionItemRefs",
        `${criterionEntry.acId} did not retain four section item references with importable item XML.`,
      );
    }
  }

  return undefined;
}
