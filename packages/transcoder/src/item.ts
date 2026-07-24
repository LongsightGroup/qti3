import { writeQti12Item } from "./qti12.js";
import { writeQti21Item } from "./qti21.js";
import { writeQti22Item } from "./qti22.js";
import { qtiTranscodeProfile } from "./profiles.js";
import { normalizeQti3Item } from "./source.js";
import type {
  Qti3TranscodeItemSource,
  QtiTranscodeDiagnostic,
  QtiTranscodeFidelity,
  QtiTranscodeInteractionReport,
  QtiTranscodeItemResult,
  QtiTranscodeOptions,
} from "./types.js";
import { validateGeneratedTargetXml } from "./xml.js";
import type { QtiValue } from "@longsightgroup/qti3-core";

/** Transcode one typed or XML QTI 3 assessment item through an explicit profile. */
export function transcodeQti3Item(
  source: Qti3TranscodeItemSource,
  options: QtiTranscodeOptions,
): QtiTranscodeItemResult {
  const profile = qtiTranscodeProfile(options.profile);
  const normalized = normalizeQti3Item(source);
  if (!normalized.ok) {
    return {
      ok: false,
      profile: options.profile,
      code: normalized.code,
      diagnostics: normalized.diagnostics,
    };
  }

  if (profile.target === "qti12") {
    const written = writeQti12Item(
      normalized.item,
      profile.interactions,
      profile.wireDialect === "canvas-classic" ? "canvas-classic" : "standard",
    );
    const diagnostics = [
      ...normalized.diagnostics,
      ...written.diagnostics,
      ...validateGeneratedTargetXml(written.xml, profile.target),
    ];
    if (hasErrors(diagnostics)) return generationFailure(options, diagnostics);
    const mappings = written.mappings.map<QtiTranscodeInteractionReport>((mapping, index) => {
      const policy = profile.interactions[mapping.source];
      return {
        index,
        sourceInteraction: mapping.source,
        emittedInteraction: mapping.emitted,
        fidelity: mapping.fallback ? "lossy" : policy.fidelity,
        scoring: mapping.scoring,
        fallback: mapping.fallback,
        affectedPaths: affectedPaths(mapping.diagnostics),
        diagnosticCodes: mapping.diagnostics.map((diagnostic) => diagnostic.code),
      };
    });
    return successResult(options, normalized.item, written.xml, mappings, diagnostics);
  }

  const written =
    profile.target === "qti21"
      ? writeQti21Item(normalized.item.item)
      : writeQti22Item(normalized.item.item);
  const diagnostics = [
    ...normalized.diagnostics,
    ...written.diagnostics,
    ...validateGeneratedTargetXml(written.xml, profile.target),
  ];
  if (hasErrors(diagnostics)) return generationFailure(options, diagnostics);
  const mappings = written.mappings.map<QtiTranscodeInteractionReport>((mapping, index) => {
    const policy = profile.interactions[mapping.source];
    const interaction = normalized.item.item.interactions[index];
    const declaration = normalized.item.item.responseDeclarations.find(
      (candidate) => candidate.identifier === interaction?.responseIdentifier,
    );
    return {
      index,
      sourceInteraction: mapping.source,
      emittedInteraction: mapping.emitted,
      fidelity: aggregateFidelity([policy.fidelity], mapping.diagnostics),
      scoring:
        policy.scoring === "automatic" &&
        (!hasCorrectResponse(declaration?.correctResponse) || !written.responseProcessingEmitted)
          ? "unscored"
          : policy.scoring,
      fallback: policy.fallback,
      affectedPaths: affectedPaths(mapping.diagnostics),
      diagnosticCodes: mapping.diagnostics.map((diagnostic) => diagnostic.code),
    };
  });
  return successResult(options, normalized.item, written.xml, mappings, diagnostics);
}

function hasCorrectResponse(value: QtiValue | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

export function aggregateFidelity(
  values: readonly QtiTranscodeFidelity[],
  diagnostics: readonly QtiTranscodeDiagnostic[] = [],
): QtiTranscodeFidelity {
  if (values.includes("lossy") || diagnostics.some((entry) => entry.severity === "warning")) {
    return "lossy";
  }
  if (values.includes("normalized") || diagnostics.some((entry) => entry.severity === "info")) {
    return "normalized";
  }
  return "exact";
}

function successResult(
  options: QtiTranscodeOptions,
  normalized: {
    readonly item: { readonly identifier: string };
    readonly sourcePath?: string | undefined;
  },
  xml: string,
  mappings: readonly QtiTranscodeInteractionReport[],
  diagnostics: readonly QtiTranscodeDiagnostic[],
): QtiTranscodeItemResult {
  const fidelity = aggregateFidelity(
    mappings.map((mapping) => mapping.fidelity),
    diagnostics,
  );
  return {
    ok: true,
    profile: options.profile,
    target: qtiTranscodeProfile(options.profile).target,
    fidelity,
    xml,
    assets: [],
    report: {
      identifier: normalized.item.identifier,
      sourcePath: normalized.sourcePath,
      fidelity,
      mappings,
      affectedPaths: affectedPaths(diagnostics),
      diagnosticCodes: diagnostics.map((diagnostic) => diagnostic.code),
    },
    diagnostics,
  };
}

function generationFailure(
  options: QtiTranscodeOptions,
  diagnostics: readonly QtiTranscodeDiagnostic[],
): QtiTranscodeItemResult {
  return {
    ok: false,
    profile: options.profile,
    code: "target_generation_failed",
    diagnostics,
  };
}

function hasErrors(diagnostics: readonly QtiTranscodeDiagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}

function affectedPaths(diagnostics: readonly QtiTranscodeDiagnostic[]): string[] {
  return [
    ...new Set(
      diagnostics.flatMap((diagnostic) => (diagnostic.path === undefined ? [] : [diagnostic.path])),
    ),
  ];
}
