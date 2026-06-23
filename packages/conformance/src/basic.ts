import { type QtiDiagnostic } from "@longsightgroup/qti3-core";
import {
  basicItemPlayerFixtures,
  basicItemPlayerToleranceFixtures,
  interactionFixtures,
  type QtiFixture,
} from "@longsightgroup/qti3-fixtures";
import { runFixture } from "./run-fixture.js";

export type QtiBasicItemPlayerFeatureStatus = "supported" | "missing" | "evidence-missing";

export interface QtiBasicItemPlayerProfileFeature {
  featureId: string;
  label: string;
  requirement: "Basic";
  fixtureIds: string[];
  packageEvidenceRequired?: boolean | undefined;
  tests: string[];
}

export interface QtiBasicItemPlayerProfile {
  id: "qti3-basic-item-player";
  title: string;
  features: QtiBasicItemPlayerProfileFeature[];
}

export interface QtiBasicItemPlayerCertificationContext {
  officialCertification: false;
  profileLevel: "Basic";
  certificationCapability: "internal item-player readiness";
  evidenceCapability: "IMPORT - Item Only Packages";
  specification: {
    title: string;
    specVersion: string;
    documentVersion: string;
    dateIssued: string;
    url: string;
  };
  outOfScopeFeaturePrefixes: string[];
}

export interface QtiBasicItemPlayerPackageEvidence {
  source: string;
  ok: boolean;
  itemCount: number;
  diagnostics?: QtiDiagnostic[] | undefined;
}

export interface QtiBasicItemPlayerValidatorEvidence {
  source: string;
  ok: boolean;
  profileLevel?: "Basic" | "Advanced" | undefined;
  checkedAt?: string | undefined;
  diagnostics?: QtiDiagnostic[] | undefined;
}

export interface QtiBasicItemPlayerFeatureResult extends QtiBasicItemPlayerProfileFeature {
  status: QtiBasicItemPlayerFeatureStatus;
  diagnostics: QtiDiagnostic[];
}

export interface QtiBasicItemPlayerToleranceResult {
  fixtureId: string;
  ok: boolean;
  diagnostics: QtiDiagnostic[];
}

export interface QtiBasicItemPlayerReadinessReport {
  profileId: QtiBasicItemPlayerProfile["id"];
  title: string;
  certificationContext: QtiBasicItemPlayerCertificationContext;
  checked: number;
  failed: number;
  ok: boolean;
  features: QtiBasicItemPlayerFeatureResult[];
  toleranceChecked: number;
  toleranceFailed: number;
  tolerance: QtiBasicItemPlayerToleranceResult[];
  packageEvidence: QtiBasicItemPlayerPackageEvidence[];
  validatorEvidence: QtiBasicItemPlayerValidatorEvidence[];
}

export interface QtiBasicItemPlayerReadinessOptions {
  profile?: QtiBasicItemPlayerProfile | undefined;
  fixtures?: QtiFixture[] | undefined;
  toleranceFixtures?: QtiFixture[] | undefined;
  packageEvidence?: QtiBasicItemPlayerPackageEvidence[] | undefined;
  validatorEvidence?: QtiBasicItemPlayerValidatorEvidence[] | undefined;
}

const basicTestEvidence = [
  "packages/conformance/src/conformance.test.ts",
  "packages/fixtures/src/fixtures.test.ts",
  "tests/browser/player-basic.spec.ts",
];

export const basicItemPlayerCertificationContext: QtiBasicItemPlayerCertificationContext = {
  officialCertification: false,
  profileLevel: "Basic",
  certificationCapability: "internal item-player readiness",
  evidenceCapability: "IMPORT - Item Only Packages",
  specification: {
    title: "1EdTech QTI v3 Conformance and Certification",
    specVersion: "3.0",
    documentVersion: "2.0",
    dateIssued: "2022-03-15",
    url: "https://www.imsglobal.org/spec/qti/v3p0/conf/",
  },
  outOfScopeFeaturePrefixes: ["T-", "S-"],
};

export const basicItemPlayerProfile: QtiBasicItemPlayerProfile = {
  id: "qti3-basic-item-player",
  title: "QTI 3 Basic Item Player Readiness",
  features: [
    feature("Q-2", "Choice Interaction", ["choice-reference"]),
    feature("Q-5", "Extended Text Interaction", ["extendedText-reference"]),
    feature("Q-13", "Match Interaction", ["match-reference"]),
    feature("Q-20", "Text Entry Interaction", ["textEntry-reference"]),
    feature("I-0", "Assessment Item Root", ["choice-reference"]),
    feature("I-1", "Response Declaration", ["choice-reference"]),
    feature("I-2", "Outcome Declaration", ["choice-reference"]),
    feature("I-7", "Item Body", ["choice-reference"]),
    feature("I-8", "HTML5 QTI Subset", ["basic-html-subset"]),
    feature("I-9b", "Response Processing Template", ["basic-template-response-processing"]),
    feature("I-17", "Composite Items", ["basic-composite-item"]),
    feature("I-18", "MathML", ["basic-mathml"]),
    feature("I-19", "QTI Shared Vocabulary Subset", ["basic-shared-vocabulary"]),
    feature("A-1", "Alt Text for Graphics", ["basic-alt-text"]),
    {
      featureId: "P-4",
      label: "Item Instances",
      requirement: "Basic",
      fixtureIds: [],
      packageEvidenceRequired: true,
      tests: ["packages/cli/src/index.test.ts"],
    },
  ],
};

export function runBasicItemPlayerReadiness(
  options: QtiBasicItemPlayerReadinessOptions = {},
): QtiBasicItemPlayerReadinessReport {
  const profile = options.profile ?? basicItemPlayerProfile;
  const packageEvidence = options.packageEvidence ?? [];
  const validatorEvidence = options.validatorEvidence ?? [];
  const fixtures = options.fixtures ?? [...interactionFixtures, ...basicItemPlayerFixtures];
  const toleranceFixtures = options.toleranceFixtures ?? basicItemPlayerToleranceFixtures;
  const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));

  const features = profile.features.map((profileFeature) => {
    const diagnostics: QtiDiagnostic[] = [];
    let status: QtiBasicItemPlayerFeatureStatus = "supported";

    if (profileFeature.packageEvidenceRequired) {
      if (!packageEvidence.some((entry) => entry.ok && entry.itemCount > 0)) {
        status = "evidence-missing";
        diagnostics.push({
          code: "basic.packageEvidence.missing",
          severity: "error",
          message: `${profileFeature.featureId} requires at least one passing item-only package import evidence row.`,
        });
      }
    } else if (profileFeature.fixtureIds.length === 0) {
      status = "missing";
      diagnostics.push({
        code: "basic.fixture.missing",
        severity: "error",
        message: `${profileFeature.featureId} has no fixture evidence configured.`,
      });
    }

    for (const fixtureId of profileFeature.fixtureIds) {
      const fixture = fixtureById.get(fixtureId);
      if (!fixture) {
        status = "evidence-missing";
        diagnostics.push({
          code: "basic.fixture.notFound",
          severity: "error",
          message: `${profileFeature.featureId} references missing fixture ${fixtureId}.`,
        });
        continue;
      }

      const result = runFixture(fixture);
      if (!result.ok) {
        status = "evidence-missing";
        diagnostics.push(...result.diagnostics);
      }
      const featureDiagnostics = featureEvidenceDiagnostics(profileFeature, fixture);
      if (featureDiagnostics.length > 0) {
        status = "evidence-missing";
        diagnostics.push(...featureDiagnostics);
      }
    }

    return {
      ...profileFeature,
      status,
      diagnostics,
    };
  });

  const tolerance = toleranceFixtures.map(runToleranceFixture);
  if (tolerance.length === 0) {
    tolerance.push({
      fixtureId: "basic-item-player-tolerance",
      ok: false,
      diagnostics: [
        {
          code: "basic.tolerance.evidenceMissing",
          severity: "error",
          message:
            "Basic item-player readiness requires tolerance evidence for unsupported extra QTI features.",
        },
      ],
    });
  }

  const toleranceFailed = tolerance.filter((row) => !row.ok).length;
  const failed = features.filter((row) => row.status !== "supported").length + toleranceFailed;
  return {
    profileId: profile.id,
    title: profile.title,
    certificationContext: basicItemPlayerCertificationContext,
    checked: features.length,
    failed,
    ok: failed === 0,
    features,
    toleranceChecked: tolerance.length,
    toleranceFailed,
    tolerance,
    packageEvidence,
    validatorEvidence,
  };
}

function runToleranceFixture(fixture: QtiFixture): QtiBasicItemPlayerToleranceResult {
  const result = runFixture(fixture);
  return {
    fixtureId: fixture.id,
    ok: result.ok,
    diagnostics: result.diagnostics,
  };
}

function featureEvidenceDiagnostics(
  profileFeature: QtiBasicItemPlayerProfileFeature,
  fixture: QtiFixture,
): QtiDiagnostic[] {
  if (
    profileFeature.featureId === "Q-2" &&
    !/<qti-choice-interaction\b[^>]*\bmax-choices\s*=/i.test(fixture.xml)
  ) {
    return [
      {
        code: "basic.choice.maxChoices.missing",
        severity: "error",
        message: `${profileFeature.featureId} Basic choice evidence must include max-choices.`,
      },
    ];
  }
  return [];
}

function feature(
  featureId: string,
  label: string,
  fixtureIds: string[],
): QtiBasicItemPlayerProfileFeature {
  return {
    featureId,
    label,
    requirement: "Basic",
    fixtureIds,
    tests: basicTestEvidence,
  };
}
