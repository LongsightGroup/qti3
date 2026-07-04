import type { QtiSharedVocabularyState } from "@longsightgroup/qti3-core";

declare const qti3TrustedXmlFragmentBrand: unique symbol;

/**
 * XML/XHTML fragment already prepared by the caller for direct insertion into QTI item XML.
 *
 * The writer is a trusted-fragment assembler, not an HTML sanitizer. Callers should only construct
 * this after escaping, sanitizing, or otherwise proving the fragment is safe for their boundary.
 */
export type Qti3TrustedXmlFragment = string & {
  readonly [qti3TrustedXmlFragmentBrand]: true;
};

export function qti3TrustedXmlFragment(value: string): Qti3TrustedXmlFragment {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- explicit public trust boundary for caller-prepared XML.
  return value as Qti3TrustedXmlFragment;
}

export type Qti3TextEntryBaseType = "string" | "integer" | "float";

export type Qti3ResponseProcessingTemplate = "match_correct" | "map_response";

export interface Qti3WriterDiagnostic {
  readonly code: string;
  readonly path: string;
  readonly message: string;
  readonly value?: unknown;
}

export type Qti3WriterResult =
  | { readonly ok: true; readonly xml: string; readonly diagnostics: readonly [] }
  | { readonly ok: false; readonly diagnostics: readonly Qti3WriterDiagnostic[] };

export class Qti3WriterError extends Error {
  public readonly diagnostics: readonly Qti3WriterDiagnostic[];

  public constructor(diagnostics: readonly Qti3WriterDiagnostic[]) {
    super(diagnostics.map((diagnostic) => `${diagnostic.path}: ${diagnostic.message}`).join("\n"));
    this.name = "Qti3WriterError";
    this.diagnostics = diagnostics;
  }
}

export interface Qti3AuthoringItemBase {
  readonly identifier: string;
  readonly title: string;
  /** Defaults to "en-US" when omitted. */
  readonly lang?: string | undefined;
  readonly bodyHtml?: Qti3TrustedXmlFragment | undefined;
  readonly promptHtml?: Qti3TrustedXmlFragment | undefined;
  /** Interaction-specific writers default this to "RESPONSE" when omitted. */
  readonly responseIdentifier?: string | undefined;
  readonly sharedVocabulary?: QtiSharedVocabularyState | undefined;
}

export interface Qti3AuthoringChoice {
  readonly identifier: string;
  readonly text?: string | undefined;
  readonly contentHtml?: Qti3TrustedXmlFragment | undefined;
  readonly fixed?: boolean | undefined;
}

export interface Qti3ChoiceAuthoringItem extends Qti3AuthoringItemBase {
  readonly interactionType: "choice";
  readonly responseCardinality: "single" | "multiple";
  readonly choices: readonly Qti3AuthoringChoice[];
  readonly correctResponse: readonly string[];
  readonly shuffle?: boolean | undefined;
  readonly minChoices?: number | undefined;
  readonly maxChoices?: number | undefined;
  readonly scoring?: Qti3ResponseProcessingTemplate | undefined;
  readonly choiceVisibility?: "visible" | "hide" | undefined;
  readonly classNames?: readonly string[] | undefined;
}

export type Qti3ChoiceBuilderInput = Omit<Qti3ChoiceAuthoringItem, "interactionType"> & {
  readonly interactionType?: "choice" | undefined;
};

export interface Qti3TextEntryAnswer {
  readonly value: string;
  readonly score?: number | undefined;
  /** Defaults to QTI/core behavior: case-sensitive unless explicitly set to false. */
  readonly caseSensitive?: boolean | undefined;
}

export interface Qti3TextEntryResponse {
  readonly responseIdentifier: string;
  readonly baseType?: Qti3TextEntryBaseType | undefined;
  readonly answers?: readonly Qti3TextEntryAnswer[] | undefined;
}

export interface Qti3TextEntryAuthoringItem extends Qti3AuthoringItemBase {
  readonly interactionType: "textEntry";
  readonly responses: readonly Qti3TextEntryResponse[];
}

export type Qti3TextEntryBuilderInput = Omit<Qti3TextEntryAuthoringItem, "interactionType"> & {
  readonly interactionType?: "textEntry" | undefined;
};

export interface Qti3MatchChoice {
  readonly identifier: string;
  readonly text?: string | undefined;
  readonly contentHtml?: Qti3TrustedXmlFragment | undefined;
  readonly matchMax?: number | undefined;
}

export interface Qti3MatchPair {
  readonly sourceIdentifier: string;
  readonly targetIdentifier: string;
}

export interface Qti3MatchAuthoringItem extends Qti3AuthoringItemBase {
  readonly interactionType: "match";
  readonly sources: readonly Qti3MatchChoice[];
  readonly targets: readonly Qti3MatchChoice[];
  readonly correctResponse: readonly Qti3MatchPair[];
  readonly minAssociations?: number | undefined;
  readonly maxAssociations?: number | undefined;
  readonly shuffle?: boolean | undefined;
  readonly classNames?: readonly string[] | undefined;
}

export type Qti3MatchBuilderInput = Omit<Qti3MatchAuthoringItem, "interactionType"> & {
  readonly interactionType?: "match" | undefined;
};

export type Qti3HotspotShape = "circle" | "rect" | "poly";

export interface Qti3HotspotChoice {
  readonly identifier: string;
  readonly shape: Qti3HotspotShape;
  readonly coords: string;
}

export interface Qti3HotspotObject {
  readonly data: string;
  readonly alt?: string | undefined;
  readonly type?: string | undefined;
  readonly width?: number | undefined;
  readonly height?: number | undefined;
  readonly longDescription?: string | undefined;
}

export interface Qti3HotspotAuthoringItem extends Qti3AuthoringItemBase {
  readonly interactionType: "hotspot";
  readonly object: Qti3HotspotObject;
  readonly choices: readonly Qti3HotspotChoice[];
  readonly correctResponse?: readonly string[] | undefined;
  readonly minChoices?: number | undefined;
  readonly maxChoices?: number | undefined;
  readonly minChoicesMessage?: string | undefined;
  readonly maxChoicesMessage?: string | undefined;
  readonly classNames?: readonly string[] | undefined;
}

export type Qti3HotspotBuilderInput = Omit<Qti3HotspotAuthoringItem, "interactionType"> & {
  readonly interactionType?: "hotspot" | undefined;
};

export type Qti3AuthoringItem =
  | Qti3ChoiceAuthoringItem
  | Qti3TextEntryAuthoringItem
  | Qti3MatchAuthoringItem
  | Qti3HotspotAuthoringItem;
