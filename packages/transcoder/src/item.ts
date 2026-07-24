import type { QtiInteractionType, QtiValue } from "@longsightgroup/qti3-core";

import { writeMoodleXmlItem } from "./moodle-xml.js";
import { writeQti12Item } from "./qti12.js";
import type { Qti12WireDialect } from "./qti12/types.js";
import { writeQti21Item } from "./qti21.js";
import { writeQti22Item } from "./qti22.js";
import type { QtiTranscodeProfile } from "./profiles.js";
import { qtiTranscodeProfile } from "./profiles.js";
import { normalizeQti3Item, type NormalizedQti3Item } from "./source.js";
import type {
  Qti3TranscodeItemSource,
  QtiTranscodeDiagnostic,
  QtiTranscodeFidelity,
  QtiTranscodeInteractionReport,
  QtiTranscodeItemResult,
  QtiTranscodeOptions,
  QtiTranscodeScoringDisposition,
} from "./types.js";
import { validateGeneratedTargetXml } from "./xml.js";

interface TranscodedInteractionMapping {
  readonly source: QtiInteractionType;
  readonly emitted: string;
  readonly diagnostics: readonly QtiTranscodeDiagnostic[];
  readonly scoring?: QtiTranscodeScoringDisposition | undefined;
  readonly fallback?: string | undefined;
}

interface TranscodedItemWriteResult {
  readonly xml: string;
  readonly diagnostics: readonly QtiTranscodeDiagnostic[];
  readonly mappings: readonly TranscodedInteractionMapping[];
  readonly responseProcessingEmitted?: boolean | undefined;
}

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

  const written = writeTranscodedItem(normalized.item, profile);
  const diagnostics = [
    ...normalized.diagnostics,
    ...written.diagnostics,
    ...validateTranscodedXml(written.xml, profile),
  ];
  if (hasErrors(diagnostics)) return generationFailure(options, diagnostics);

  const mappings = written.mappings.map((mapping, index) =>
    buildInteractionReport({
      mapping,
      index,
      profile,
      normalized: normalized.item,
      responseProcessingEmitted: written.responseProcessingEmitted === true,
    }),
  );
  return successResult(options, normalized.item, written.xml, mappings, diagnostics);
}

function writeTranscodedItem(
  normalized: NormalizedQti3Item,
  profile: QtiTranscodeProfile,
): TranscodedItemWriteResult {
  switch (profile.target) {
    case "qti12":
      return writeQti12Item(normalized, profile.interactions, qti12WireDialect(profile));
    case "qti21": {
      const written = writeQti21Item(normalized.item);
      return {
        xml: written.xml,
        diagnostics: written.diagnostics,
        mappings: written.mappings,
        responseProcessingEmitted: written.responseProcessingEmitted,
      };
    }
    case "qti22": {
      const written = writeQti22Item(normalized.item);
      return {
        xml: written.xml,
        diagnostics: written.diagnostics,
        mappings: written.mappings,
        responseProcessingEmitted: written.responseProcessingEmitted,
      };
    }
    case "moodle-xml":
      return writeMoodleXmlItem(normalized, profile.interactions);
    default: {
      const unexpected: never = profile.target;
      throw new Error(`Unsupported transcoder target: ${String(unexpected)}`);
    }
  }
}

function qti12WireDialect(profile: QtiTranscodeProfile): Qti12WireDialect {
  return profile.wireDialect === "canvas-classic" ? "canvas-classic" : "standard";
}

function validateTranscodedXml(
  xml: string,
  profile: QtiTranscodeProfile,
): readonly QtiTranscodeDiagnostic[] {
  if (profile.target === "moodle-xml") return [];
  if (profile.target === "qti12") {
    return validateGeneratedTargetXml(xml, profile.target, qti12WireDialect(profile));
  }
  return validateGeneratedTargetXml(xml, profile.target);
}

function buildInteractionReport(input: {
  readonly mapping: TranscodedInteractionMapping;
  readonly index: number;
  readonly profile: QtiTranscodeProfile;
  readonly normalized: NormalizedQti3Item;
  readonly responseProcessingEmitted: boolean;
}): QtiTranscodeInteractionReport {
  const { mapping, index, profile, normalized, responseProcessingEmitted } = input;
  const policy = profile.interactions[mapping.source];
  const base = {
    index,
    sourceInteraction: mapping.source,
    emittedInteraction: mapping.emitted,
    affectedPaths: affectedPaths(mapping.diagnostics),
    diagnosticCodes: mapping.diagnostics.map((diagnostic) => diagnostic.code),
  };

  if (profile.target === "qti12" || profile.target === "moodle-xml") {
    return {
      ...base,
      fidelity: mapping.fallback ? "lossy" : policy.fidelity,
      scoring: mapping.scoring ?? policy.scoring,
      fallback: mapping.fallback,
    };
  }

  const interaction = normalized.item.interactions[index];
  const declaration = normalized.item.responseDeclarations.find(
    (candidate) => candidate.identifier === interaction?.responseIdentifier,
  );
  return {
    ...base,
    fidelity: aggregateFidelity([policy.fidelity], mapping.diagnostics),
    scoring:
      policy.scoring === "automatic" &&
      (!hasCorrectResponse(declaration?.correctResponse) || !responseProcessingEmitted)
        ? "unscored"
        : policy.scoring,
    fallback: policy.fallback,
  };
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
