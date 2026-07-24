import type { QtiInteraction } from "@longsightgroup/qti3-core";

import type { QtiTranscodeDiagnostic, QtiTranscodeScoringDisposition } from "../types.js";

export interface Qti12MappedInteraction {
  readonly source: QtiInteraction["type"];
  readonly emitted: string;
  readonly scoring: QtiTranscodeScoringDisposition;
  readonly fallback?: string | undefined;
  readonly responseXml: string;
  readonly processingXml: string;
  readonly diagnostics: readonly QtiTranscodeDiagnostic[];
}

export interface Qti12WriteResult {
  readonly xml: string;
  readonly mappings: readonly Qti12MappedInteraction[];
  readonly diagnostics: readonly QtiTranscodeDiagnostic[];
}

export interface Qti12Response {
  readonly identifier: string;
  readonly xml: string;
  readonly correct: readonly string[];
  readonly scoring: QtiTranscodeScoringDisposition;
  readonly fallback?: string | undefined;
  readonly emitted: string;
  readonly processingXml: string;
  readonly diagnostics: readonly QtiTranscodeDiagnostic[];
}

export type Qti12WireDialect = "canvas-classic" | "standard";

export interface Qti12MapContext {
  readonly interaction: QtiInteraction;
  readonly identifier: string;
  readonly correct: readonly string[];
  readonly policy: import("../profiles.js").QtiTranscodeInteractionPolicy;
  readonly sourcePath: string | undefined;
  readonly dialect: Qti12WireDialect;
  readonly fallbackDiagnostic: (fallback: string) => QtiTranscodeDiagnostic;
}
