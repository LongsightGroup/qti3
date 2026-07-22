import type { QtiDiagnostic, QtiDocument } from "./types.js";
import type { QtiPackageEntry } from "./qti-package-zip.js";

export type {
  QtiPackageInflateContext,
  QtiPackageInflateRaw,
  QtiPackageParseOptions,
} from "./qti-package-zip.js";

/** Neutral package shape detected from IMS manifest resources. */
export type QtiPackageShape = "manifest-item-resources" | "assessment-test-resource" | "unknown";

/** Origin of an assessment item inside a parsed QTI package. */
export type QtiPackageItemSource = "manifest" | "assessment-test";

/** Source of a package-local asset reference. */
export type QtiPackageAssetSource =
  | "manifest-resource"
  | "item-content"
  | "assessment-test-content";

/** Parsed package manifest file entry. */
export interface QtiManifestFile {
  readonly href: string;
  readonly attributes: Record<string, string>;
}

/** Parsed package manifest resource entry. */
export interface QtiManifestResource {
  readonly identifier: string;
  readonly type: string;
  readonly href?: string | undefined;
  readonly files: readonly QtiManifestFile[];
  readonly dependencies: readonly string[];
  readonly standards: readonly QtiStandardAlignment[];
  readonly attributes: Record<string, string>;
}

/** Parsed timing metadata from item or assessment-test XML. */
export interface QtiTimingMetadata {
  readonly sourcePath: string;
  readonly timeDependent?: boolean | undefined;
  readonly minTime?: string | undefined;
  readonly maxTime?: string | undefined;
  readonly allowLateSubmission?: boolean | undefined;
  readonly attributes: Record<string, string>;
}

/** Parsed qti-time-limits attributes for one assessment-test structure node. */
export interface QtiTimeLimits {
  readonly minTimeSeconds?: number | undefined;
  readonly maxTimeSeconds?: number | undefined;
  readonly allowLateSubmission?: boolean | undefined;
  readonly attributes: Record<string, string>;
}

/** Parsed qti-item-session-control attributes for an assessment item reference. */
export interface QtiItemSessionControl {
  readonly maxAttempts?: number | undefined;
  readonly showFeedback?: boolean | undefined;
  readonly allowReview?: boolean | undefined;
  readonly showSolution?: boolean | undefined;
  readonly allowComment?: boolean | undefined;
  readonly allowSkipping?: boolean | undefined;
  readonly validateResponses?: boolean | undefined;
  readonly attributes: Record<string, string>;
}

/** Navigation mode declared by a QTI assessment-test part. */
export type QtiTestPartNavigationMode = "linear" | "nonlinear";

/** Submission mode declared by a QTI assessment-test part. */
export type QtiTestPartSubmissionMode = "individual" | "simultaneous";

/** Neutral standard-alignment metadata discovered in package XML. */
export interface QtiStandardAlignment {
  readonly sourcePath: string;
  readonly qtiName: string;
  readonly identifier?: string | undefined;
  readonly framework?: string | undefined;
  readonly targetName?: string | undefined;
  readonly targetUrl?: string | undefined;
  readonly text?: string | undefined;
  readonly providerIdentifier?: string | undefined;
  readonly resourceLabel?: string | undefined;
  readonly resourcePartIdentifier?: string | undefined;
  readonly weight?: number | undefined;
  readonly attributes: Record<string, string>;
}

/** Assessment item reference from an assessment-test package. */
export interface QtiAssessmentTestItemRef {
  readonly identifier?: string | undefined;
  readonly href: string;
  readonly testPartIdentifier?: string | undefined;
  readonly sectionIdentifier?: string | undefined;
  readonly timeLimits?: QtiTimeLimits | undefined;
  readonly itemSessionControl?: QtiItemSessionControl | undefined;
  readonly attributes: Record<string, string>;
}

/** Parsed assessment section, including nested sections and directly owned item references. */
export interface QtiAssessmentSectionPackageModel {
  readonly identifier: string;
  readonly title?: string | undefined;
  readonly visible?: boolean | undefined;
  readonly testPartIdentifier: string;
  readonly parentSectionIdentifier?: string | undefined;
  readonly timeLimits?: QtiTimeLimits | undefined;
  readonly itemRefs: readonly QtiAssessmentTestItemRef[];
  readonly sections: readonly QtiAssessmentSectionPackageModel[];
  readonly attributes: Record<string, string>;
}

/** Parsed QTI assessment-test part and its section hierarchy. */
export interface QtiTestPartPackageModel {
  readonly identifier: string;
  readonly navigationMode?: QtiTestPartNavigationMode | undefined;
  readonly submissionMode?: QtiTestPartSubmissionMode | undefined;
  readonly timeLimits?: QtiTimeLimits | undefined;
  readonly sections: readonly QtiAssessmentSectionPackageModel[];
  readonly attributes: Record<string, string>;
}

/** Parsed assessment-test resource model for package-level importers. */
export interface QtiAssessmentTestPackageModel {
  readonly href: string;
  readonly identifier: string;
  readonly title?: string | undefined;
  readonly manifestResourceIdentifier?: string | undefined;
  readonly itemRefs: readonly QtiAssessmentTestItemRef[];
  readonly testParts: readonly QtiTestPartPackageModel[];
  readonly timing?: QtiTimingMetadata | undefined;
  readonly timeLimits?: QtiTimeLimits | undefined;
  readonly standards: readonly QtiStandardAlignment[];
  readonly assetHrefs: readonly string[];
  readonly diagnostics: readonly QtiDiagnostic[];
  readonly attributes: Record<string, string>;
  readonly xml: string;
}

/** Parsed assessment item model inside a QTI package. */
export interface QtiPackageItem {
  readonly href: string;
  readonly source: QtiPackageItemSource;
  readonly manifestResourceIdentifier?: string | undefined;
  readonly assessmentItemRefIdentifier?: string | undefined;
  readonly identifier?: string | undefined;
  readonly title?: string | undefined;
  readonly document?: QtiDocument | undefined;
  readonly timing?: QtiTimingMetadata | undefined;
  readonly timeLimits?: QtiTimeLimits | undefined;
  readonly standards: readonly QtiStandardAlignment[];
  readonly assetHrefs: readonly string[];
  readonly diagnostics: readonly QtiDiagnostic[];
  readonly xml: string;
}

/** Package-local asset discovered from manifest files or XML content references. */
export interface QtiPackageAsset {
  readonly href: string;
  readonly mediaType?: string | undefined;
  readonly source: QtiPackageAssetSource;
  readonly referencedBy: readonly string[];
}

/** Package-local asset references discovered in one XML document. */
export interface QtiPackageContentAssetDiscovery {
  readonly hrefs: readonly string[];
  readonly diagnostics: readonly QtiDiagnostic[];
}

/** Parsed QTI package manifest/resource graph and item/test projection. */
export interface QtiPackageParseResult {
  readonly ok: boolean;
  readonly title: string;
  readonly entries: readonly QtiPackageEntry[];
  readonly packageShape: QtiPackageShape;
  readonly items: readonly QtiPackageItem[];
  readonly assets: readonly QtiPackageAsset[];
  readonly manifestResources: readonly QtiManifestResource[];
  readonly assessmentTest?: QtiAssessmentTestPackageModel | undefined;
  readonly timing?: QtiTimingMetadata | undefined;
  readonly standards: readonly QtiStandardAlignment[];
  readonly diagnostics: readonly QtiDiagnostic[];
}
