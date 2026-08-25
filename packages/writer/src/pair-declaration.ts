import { duplicateDiagnostics, validateQtiIdentifier, writerDiagnostic } from "./diagnostics.js";
import type { Qti3ResponseProcessingTemplate, Qti3WriterDiagnostic } from "./types.js";
import { escapeXmlAttribute, escapeXmlText } from "./xml.js";

export interface Qti3PairLike {
  readonly sourceIdentifier: string;
  readonly targetIdentifier: string;
}

export interface PairResponseDeclarationInput {
  readonly responseIdentifier: string;
  readonly baseType: "pair" | "directedPair";
  readonly pairs: readonly Qti3PairLike[];
  readonly scoring?: Qti3ResponseProcessingTemplate | undefined;
}

export interface PairReferenceValidationInput {
  readonly pairs: readonly Qti3PairLike[];
  readonly sourceIdentifiers: ReadonlySet<string>;
  readonly targetIdentifiers: ReadonlySet<string>;
  readonly diagnostics: Qti3WriterDiagnostic[];
  readonly path: string;
  readonly sourceLabel: string;
  readonly targetLabel: string;
  readonly unknownSourceCode: string;
  readonly unknownTargetCode: string;
  readonly disallowSelfPair?: boolean | undefined;
  readonly selfPairCode?: string | undefined;
  readonly selfPairMessage?: ((pairValue: string) => string) | undefined;
  readonly duplicateLabel?: string | undefined;
  readonly duplicateUnordered?: boolean | undefined;
  readonly unknownSourceMessage?: ((identifier: string) => string) | undefined;
  readonly unknownTargetMessage?: ((identifier: string) => string) | undefined;
}

export interface PairMatchMaxValidationInput {
  readonly pairs: readonly Qti3PairLike[];
  readonly matchMaxByIdentifier: ReadonlyMap<string, number | undefined>;
  readonly diagnostics: Qti3WriterDiagnostic[];
  readonly path: string;
  readonly code: string;
  readonly label: string;
}

export function pairValue(pair: Qti3PairLike): string {
  return `${pair.sourceIdentifier.trim()} ${pair.targetIdentifier.trim()}`;
}

export function pairResponseDeclarationXml(input: PairResponseDeclarationInput): string {
  return `  <qti-response-declaration identifier="${input.responseIdentifier}" cardinality="multiple" base-type="${input.baseType}">
    <qti-correct-response>
${input.pairs.map((pair) => `      <qti-value>${escapeXmlText(pairValue(pair))}</qti-value>`).join("\n")}
    </qti-correct-response>
${pairMappingXml(input.scoring ?? "match_correct", input.pairs)}  </qti-response-declaration>`;
}

export function pairMappingXml(
  scoring: Qti3ResponseProcessingTemplate,
  pairs: readonly Qti3PairLike[],
): string {
  if (scoring !== "map_response" || !pairs.length) return "";
  return `
  <qti-mapping default-value="0">
${pairs
  .map(
    (pair) =>
      `    <qti-map-entry map-key="${escapeXmlAttribute(pairValue(pair))}" mapped-value="1"/>`,
  )
  .join("\n")}
  </qti-mapping>
`;
}

export function validatePairReferences(input: PairReferenceValidationInput): void {
  if (input.duplicateLabel) {
    const pairKeys = input.pairs.map((pair) =>
      input.duplicateUnordered ? normalizedUnorderedPairKey(pair) : pairValue(pair),
    );
    input.diagnostics.push(...duplicateDiagnostics(pairKeys, input.path, input.duplicateLabel));
  }

  for (const [index, pair] of input.pairs.entries()) {
    validatePairReference(pair, index, input);
  }
}

export function validatePairMatchMax(input: PairMatchMaxValidationInput): void {
  const useCounts = new Map<string, number>();
  for (const pair of input.pairs) {
    incrementUseCount(useCounts, pair.sourceIdentifier.trim());
    incrementUseCount(useCounts, pair.targetIdentifier.trim());
  }

  for (const [identifier, matchMax] of input.matchMaxByIdentifier.entries()) {
    if (matchMax === undefined || matchMax <= 0 || !Number.isInteger(matchMax)) continue;
    const useCount = useCounts.get(identifier) ?? 0;
    if (useCount <= matchMax) continue;
    input.diagnostics.push(
      writerDiagnostic(
        input.code,
        input.path,
        `${input.label} "${identifier}" is used ${useCount} times but matchMax allows ${matchMax}.`,
        { identifier, useCount, matchMax },
      ),
    );
  }
}

function validatePairReference(
  pair: Qti3PairLike,
  index: number,
  input: PairReferenceValidationInput,
): void {
  const sourceIdentifier = pair.sourceIdentifier.trim();
  const targetIdentifier = pair.targetIdentifier.trim();
  const sourcePath = `${input.path}.${index}.sourceIdentifier`;
  const targetPath = `${input.path}.${index}.targetIdentifier`;
  const sourceDiagnostic = validateQtiIdentifier(
    sourcePath,
    input.sourceLabel,
    pair.sourceIdentifier,
  );
  if (sourceDiagnostic) input.diagnostics.push(sourceDiagnostic);
  const targetDiagnostic = validateQtiIdentifier(
    targetPath,
    input.targetLabel,
    pair.targetIdentifier,
  );
  if (targetDiagnostic) input.diagnostics.push(targetDiagnostic);
  if (input.disallowSelfPair && sourceIdentifier === targetIdentifier) {
    const value = pairValue(pair);
    input.diagnostics.push(
      writerDiagnostic(
        input.selfPairCode ?? "invalid_self_pair",
        `${input.path}.${index}`,
        input.selfPairMessage?.(value) ?? "Pair must reference two different choices.",
        value,
      ),
    );
  }
  if (sourceIdentifier && !input.sourceIdentifiers.has(sourceIdentifier)) {
    input.diagnostics.push(
      writerDiagnostic(
        input.unknownSourceCode,
        sourcePath,
        input.unknownSourceMessage?.(pair.sourceIdentifier) ??
          `${input.sourceLabel} "${pair.sourceIdentifier}" does not reference a known choice.`,
        pair.sourceIdentifier,
      ),
    );
  }
  if (targetIdentifier && !input.targetIdentifiers.has(targetIdentifier)) {
    input.diagnostics.push(
      writerDiagnostic(
        input.unknownTargetCode,
        targetPath,
        input.unknownTargetMessage?.(pair.targetIdentifier) ??
          `${input.targetLabel} "${pair.targetIdentifier}" does not reference a known choice.`,
        pair.targetIdentifier,
      ),
    );
  }
}

function incrementUseCount(counts: Map<string, number>, identifier: string): void {
  if (!identifier) return;
  counts.set(identifier, (counts.get(identifier) ?? 0) + 1);
}

function normalizedUnorderedPairKey(pair: Qti3PairLike): string {
  return [pair.sourceIdentifier.trim(), pair.targetIdentifier.trim()].toSorted().join(" ");
}
