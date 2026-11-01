import type {
  QtiMigrationAsset,
  QtiMigrationDiagnostic,
  QtiMigrationItemResult,
  QtiMigrationPart,
} from "../types.js";
import type { PendingMigrationItem } from "../item-finalize.js";

/** Source annotations retained without choosing a host's feedback/hint release policy. */
export interface LmsSourceAnnotation {
  readonly kind: "feedback" | "hint" | "settings";
  readonly name: string;
  readonly text: string;
  readonly format?: string | undefined;
  readonly contentHtml?: string | undefined;
  readonly settings?: Readonly<Record<string, string>> | undefined;
}
/** Vendor facts independent of any application's authoring draft or review states. */
export interface LmsSourceMetadata {
  readonly questionType: string;
  readonly category?: string | undefined;
  readonly tags: readonly string[];
  readonly maximumScore?: number | undefined;
  readonly annotations: readonly LmsSourceAnnotation[];
  readonly settings: Readonly<Record<string, string>>;
}
/** Converted questions or explicit unscored source content, with item-owned diagnostics. */
export interface LmsMigrationItem extends QtiMigrationItemResult {
  readonly sourceMetadata: LmsSourceMetadata;
}
/** Framework-neutral Moodle XML/GIFT conversion output. The caller retains its original source. */
export interface LmsMigrationResult {
  readonly title: string;
  readonly sourceFormat: "moodle-xml" | "gift";
  readonly parts: readonly QtiMigrationPart[];
  readonly items: readonly LmsMigrationItem[];
  readonly assets: readonly QtiMigrationAsset[];
  readonly diagnostics: readonly QtiMigrationDiagnostic[];
}
export interface LmsPendingItem extends PendingMigrationItem {
  readonly sourceMetadata: LmsSourceMetadata;
}
export interface LmsIssue {
  readonly code: string;
  readonly message: string;
  readonly detail?: string | undefined;
}
export interface SourceTextSlot {
  readonly id: string;
  readonly label: string;
  readonly responseBaseType: "string" | "float";
  readonly answers: readonly {
    readonly value: string;
    readonly score: number;
    readonly caseSensitive: boolean;
  }[];
}
export interface SourceInlineSlot {
  readonly id: string;
  readonly label: string;
  readonly required: boolean;
  readonly shuffle: boolean;
  readonly correctId?: string | undefined;
  readonly options: readonly {
    readonly id: string;
    readonly text: string;
    readonly score: number;
  }[];
}
