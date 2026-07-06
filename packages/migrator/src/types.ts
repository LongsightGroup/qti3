import type {
  Qti3AuthoringItem,
  Qti3PackageAuthoringInput,
  Qti3WriterDiagnostic,
} from "@longsightgroup/qti3-writer";

export type QtiMigrationSourceFormat = "qti12" | "qti21" | "qti22";

export type QtiMigrationRepairPolicy = "none" | "safe";

export type QtiMigrationUnsupportedPolicy = "diagnostic" | "stub" | "skip";

export interface QtiMigrationSourceInput {
  readonly filename?: string | undefined;
  readonly bytes?: Uint8Array | undefined;
  readonly xml?: string | undefined;
  readonly mime?: string | undefined;
}

/** Local file closure for migrating one QTI resource from a larger host package. */
export interface QtiMigrationResourceInput {
  readonly sourcePath: string;
  readonly files: Readonly<Record<string, Uint8Array>>;
  readonly title?: string | undefined;
}

export interface QtiMigrationOptions {
  readonly repairPolicy?: QtiMigrationRepairPolicy | undefined;
  readonly unsupportedPolicy?: QtiMigrationUnsupportedPolicy | undefined;
}

export interface ResolvedQtiMigrationOptions {
  readonly repairPolicy: QtiMigrationRepairPolicy;
  readonly unsupportedPolicy: QtiMigrationUnsupportedPolicy;
}

export interface QtiMigrationDetectionResult {
  readonly supported: boolean;
  readonly sourceFormat?: QtiMigrationSourceFormat | undefined;
  readonly confidence: number;
  readonly reason: string;
  readonly isPackage: boolean;
}

export type QtiMigrationDiagnosticSeverity = "info" | "warning" | "error";

export interface QtiMigrationDiagnostic {
  readonly code: string;
  readonly severity: QtiMigrationDiagnosticSeverity;
  readonly message: string;
  readonly path?: string | undefined;
  readonly sourceFormat?: QtiMigrationSourceFormat | undefined;
  readonly writerDiagnostics?: readonly Qti3WriterDiagnostic[] | undefined;
}

export interface QtiMigrationPart {
  readonly identifier: string;
  readonly title: string;
  readonly itemHrefs: readonly string[];
}

export interface QtiMigrationAsset {
  readonly path: string;
  readonly data?: Uint8Array | undefined;
  readonly mediaType?: string | undefined;
}

export interface QtiMigrationItemResult {
  readonly identifier: string;
  readonly title: string;
  readonly href: string;
  readonly assetHrefs?: readonly string[] | undefined;
  readonly authoringItem?: Qti3AuthoringItem | undefined;
  readonly xml?: string | undefined;
  readonly diagnostics: readonly QtiMigrationDiagnostic[];
}

export interface QtiMigrationResult {
  readonly title: string;
  readonly sourceFormat?: QtiMigrationSourceFormat | undefined;
  readonly parts: readonly QtiMigrationPart[];
  readonly items: readonly QtiMigrationItemResult[];
  readonly assets: readonly QtiMigrationAsset[];
  readonly diagnostics: readonly QtiMigrationDiagnostic[];
}

/** File emitted by resource-level migration for host storage or packaging. */
export interface QtiMigrationResourceEntry {
  readonly path: string;
  readonly data: Uint8Array | string;
  readonly mediaType?: string | undefined;
}

export type QtiResourceMigrationStatus = "converted" | "converted_with_warnings" | "failed";

export type QtiPackageMigrationResult =
  | {
      readonly ok: true;
      readonly package: Qti3PackageAuthoringInput;
      readonly diagnostics: readonly QtiMigrationDiagnostic[];
    }
  | { readonly ok: false; readonly diagnostics: readonly QtiMigrationDiagnostic[] };

/** Result of migrating one host-package resource and its local file closure. */
export type QtiResourceMigrationResult =
  | {
      readonly ok: true;
      readonly title: string;
      readonly status: "converted" | "converted_with_warnings";
      readonly sourceFormat: QtiMigrationSourceFormat;
      readonly launchHref: string;
      readonly itemHrefs: readonly string[];
      readonly entries: readonly QtiMigrationResourceEntry[];
      readonly diagnostics: readonly QtiMigrationDiagnostic[];
      readonly migration: QtiMigrationResult;
    }
  | {
      readonly ok: false;
      readonly title: string;
      readonly status: "failed";
      readonly sourceFormat?: QtiMigrationSourceFormat | undefined;
      readonly itemHrefs: readonly string[];
      readonly entries: readonly QtiMigrationResourceEntry[];
      readonly diagnostics: readonly QtiMigrationDiagnostic[];
      readonly migration: QtiMigrationResult;
    };
