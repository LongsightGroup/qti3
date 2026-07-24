import type { QtiInteractionType, QtiPackageInflateRaw } from "@longsightgroup/qti3-core";
import type { Qti3AuthoringItem, Qti3PackageAuthoringInput } from "@longsightgroup/qti3-writer";

/** Versioned output contract selected explicitly by every caller. */
export type QtiTranscodeProfileId =
  | "canvas-classic-quizzes@1"
  | "qti12-standard@1"
  | "qti21-standard@1"
  | "qti22-standard@1";

export type QtiTranscodeTarget = "qti12" | "qti21" | "qti22";

export type QtiTranscodeFidelity = "exact" | "normalized" | "lossy";

export type QtiTranscodeScoringDisposition = "automatic" | "manual" | "unscored";

export type QtiTranscodeDiagnosticSeverity = "info" | "warning" | "error";

/** Stable, serializable diagnostic returned at the conversion boundary. */
export interface QtiTranscodeDiagnostic {
  readonly code: string;
  readonly severity: QtiTranscodeDiagnosticSeverity;
  readonly message: string;
  readonly path?: string | undefined;
}

/** Per-interaction evidence describing the observable conversion policy that was applied. */
export interface QtiTranscodeInteractionReport {
  readonly index: number;
  readonly sourceInteraction: QtiInteractionType;
  readonly emittedInteraction: string;
  readonly fidelity: QtiTranscodeFidelity;
  readonly scoring: QtiTranscodeScoringDisposition;
  readonly fallback?: string | undefined;
  readonly affectedPaths: readonly string[];
  readonly diagnosticCodes: readonly string[];
}

/** Aggregate evidence for one item, including every interaction in document order. */
export interface QtiTranscodeItemReport {
  readonly identifier: string;
  readonly sourcePath?: string | undefined;
  readonly fidelity: QtiTranscodeFidelity;
  readonly mappings: readonly QtiTranscodeInteractionReport[];
  readonly affectedPaths: readonly string[];
  readonly diagnosticCodes: readonly string[];
}

export type Qti3TranscodeItemSource =
  | {
      readonly kind: "authoringItem";
      readonly item: Qti3AuthoringItem;
      readonly sourcePath?: string | undefined;
    }
  | {
      readonly kind: "xml";
      readonly xml: string;
      readonly sourcePath?: string | undefined;
    };

export type Qti3TranscodePackageSource =
  | {
      readonly kind: "authoringPackage";
      readonly package: Qti3PackageAuthoringInput;
    }
  | {
      readonly kind: "zip";
      readonly bytes: Uint8Array;
      readonly inflateRaw?: QtiPackageInflateRaw | undefined;
    };

export interface QtiTranscodeOptions {
  readonly profile: QtiTranscodeProfileId;
}

export interface QtiTranscodeFile {
  readonly path: string;
  readonly data: string | Uint8Array;
}

export type QtiTranscodeFailureCode =
  | "invalid_source"
  | "malformed_package"
  | "missing_asset"
  | "unsafe_path"
  | "target_generation_failed";

export type QtiTranscodeItemResult =
  | {
      readonly ok: true;
      readonly profile: QtiTranscodeProfileId;
      readonly target: QtiTranscodeTarget;
      readonly fidelity: QtiTranscodeFidelity;
      readonly xml: string;
      readonly assets: readonly QtiTranscodeFile[];
      readonly report: QtiTranscodeItemReport;
      readonly diagnostics: readonly QtiTranscodeDiagnostic[];
    }
  | {
      readonly ok: false;
      readonly profile: QtiTranscodeProfileId;
      readonly code: QtiTranscodeFailureCode;
      readonly diagnostics: readonly QtiTranscodeDiagnostic[];
    };

export type QtiTranscodePackageResult =
  | {
      readonly ok: true;
      readonly profile: QtiTranscodeProfileId;
      readonly target: QtiTranscodeTarget;
      readonly fidelity: QtiTranscodeFidelity;
      readonly files: readonly QtiTranscodeFile[];
      readonly zip: Uint8Array;
      readonly reports: readonly QtiTranscodeItemReport[];
      readonly diagnostics: readonly QtiTranscodeDiagnostic[];
    }
  | {
      readonly ok: false;
      readonly profile: QtiTranscodeProfileId;
      readonly code: QtiTranscodeFailureCode;
      readonly diagnostics: readonly QtiTranscodeDiagnostic[];
    };
