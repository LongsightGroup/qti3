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

export type Qti3ExtendedTextFormat = "plain" | "preformatted" | "xhtml";

export type Qti3ExtendedTextResponseBaseType = "string" | "integer" | "float";

export type Qti3ExtendedTextResponseCardinality = "single" | "multiple" | "ordered";

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

export interface Qti3OrderAuthoringItem extends Qti3AuthoringItemBase {
  readonly interactionType: "order";
  readonly choices: readonly Qti3AuthoringChoice[];
  /**
   * Defaults to the current choice order when omitted or empty.
   * When provided, this must include every choice unless minChoices or maxChoices explicitly
   * configures a subset-ordering interaction.
   */
  readonly correctOrder?: readonly string[] | undefined;
  readonly shuffle?: boolean | undefined;
  readonly minChoices?: number | undefined;
  readonly maxChoices?: number | undefined;
  readonly minChoicesMessage?: string | undefined;
  readonly maxChoicesMessage?: string | undefined;
  readonly choiceVisibility?: "visible" | "hide" | undefined;
  readonly classNames?: readonly string[] | undefined;
}

export type Qti3OrderBuilderInput = Omit<Qti3OrderAuthoringItem, "interactionType"> & {
  readonly interactionType?: "order" | undefined;
};

export type Qti3InlineChoiceScoring = "all_or_nothing" | "map_response";

export interface Qti3InlineChoiceOption {
  readonly identifier: string;
  readonly text?: string | undefined;
  readonly contentHtml?: Qti3TrustedXmlFragment | undefined;
  readonly fixed?: boolean | undefined;
  readonly score?: number | undefined;
}

export interface Qti3InlineChoiceSlot {
  readonly responseIdentifier: string;
  readonly options: readonly Qti3InlineChoiceOption[];
  readonly correctResponse?: string | undefined;
  readonly shuffle?: boolean | undefined;
  readonly required?: boolean | undefined;
  readonly classNames?: readonly string[] | undefined;
  readonly sharedVocabulary?: QtiSharedVocabularyState | undefined;
}

export interface Qti3InlineChoiceAuthoringItem extends Qti3AuthoringItemBase {
  readonly interactionType: "inlineChoice";
  /**
   * Trusted bodyHtml must contain an empty qti-inline-choice-interaction placeholder for every
   * slot, for example: <qti-inline-choice-interaction response-identifier="RESPONSE"/>.
   */
  readonly bodyHtml: Qti3TrustedXmlFragment;
  readonly slots: readonly Qti3InlineChoiceSlot[];
  readonly scoring?: Qti3InlineChoiceScoring | undefined;
  readonly classNames?: readonly string[] | undefined;
}

export type Qti3InlineChoiceBuilderInput = Omit<
  Qti3InlineChoiceAuthoringItem,
  "interactionType"
> & {
  readonly interactionType?: "inlineChoice" | undefined;
};

export interface Qti3HottextChoice {
  readonly identifier: string;
  readonly text?: string | undefined;
  readonly contentHtml?: Qti3TrustedXmlFragment | undefined;
}

export interface Qti3HottextAuthoringItem extends Qti3AuthoringItemBase {
  readonly interactionType: "hottext";
  /** Trusted bodyHtml must contain empty qti-hottext placeholders for writer-owned choices. */
  readonly bodyHtml: Qti3TrustedXmlFragment;
  readonly choices: readonly Qti3HottextChoice[];
  readonly correctResponse: readonly string[];
  readonly minChoices?: number | undefined;
  readonly maxChoices?: number | undefined;
  readonly minChoicesMessage?: string | undefined;
  readonly maxChoicesMessage?: string | undefined;
  readonly classNames?: readonly string[] | undefined;
}

export type Qti3HottextBuilderInput = Omit<Qti3HottextAuthoringItem, "interactionType"> & {
  readonly interactionType?: "hottext" | undefined;
};

export type Qti3GapMatchScoring = Qti3ResponseProcessingTemplate;

export interface Qti3GapTextChoice {
  readonly identifier: string;
  readonly kind: "text";
  readonly text?: string | undefined;
  readonly contentHtml?: Qti3TrustedXmlFragment | undefined;
  readonly matchMax?: number | undefined;
  readonly fixed?: boolean | undefined;
}

export interface Qti3GapImageChoice {
  readonly identifier: string;
  readonly kind: "image";
  readonly object: Qti3GraphicObject;
  readonly matchMax?: number | undefined;
  readonly fixed?: boolean | undefined;
}

export type Qti3GapMatchChoice = Qti3GapTextChoice | Qti3GapImageChoice;

export interface Qti3GapTarget {
  readonly identifier: string;
}

export interface Qti3GapMatchPair {
  readonly sourceIdentifier: string;
  readonly targetIdentifier: string;
}

export interface Qti3GapMatchAuthoringItem extends Qti3AuthoringItemBase {
  readonly interactionType: "gapMatch";
  /** Trusted interaction body content containing qti-gap target elements. */
  readonly bodyHtml: Qti3TrustedXmlFragment;
  readonly choices: readonly Qti3GapMatchChoice[];
  readonly targets: readonly Qti3GapTarget[];
  readonly correctResponse: readonly Qti3GapMatchPair[];
  readonly scoring?: Qti3GapMatchScoring | undefined;
  readonly shuffle?: boolean | undefined;
  readonly minAssociations?: number | undefined;
  readonly maxAssociations?: number | undefined;
  readonly minAssociationsMessage?: string | undefined;
  readonly maxAssociationsMessage?: string | undefined;
  readonly classNames?: readonly string[] | undefined;
}

export type Qti3GapMatchBuilderInput = Omit<Qti3GapMatchAuthoringItem, "interactionType"> & {
  readonly interactionType?: "gapMatch" | undefined;
};

export interface Qti3ExtendedTextAuthoringItem extends Qti3AuthoringItemBase {
  readonly interactionType: "extendedText";
  readonly rubricHtml?: Qti3TrustedXmlFragment | undefined;
  readonly responseBaseType?: Qti3ExtendedTextResponseBaseType | undefined;
  readonly responseCardinality?: Qti3ExtendedTextResponseCardinality | undefined;
  readonly base?: number | undefined;
  readonly stringIdentifier?: string | undefined;
  readonly expectedLength?: number | undefined;
  readonly expectedLines?: number | undefined;
  readonly minStrings?: number | undefined;
  readonly maxStrings?: number | undefined;
  readonly placeholderText?: string | undefined;
  readonly format?: Qti3ExtendedTextFormat | undefined;
  readonly patternMask?: string | undefined;
  readonly patternMessage?: string | undefined;
  readonly classNames?: readonly string[] | undefined;
}

export type Qti3ExtendedTextBuilderInput = Omit<
  Qti3ExtendedTextAuthoringItem,
  "interactionType"
> & {
  readonly interactionType?: "extendedText" | undefined;
};

export interface Qti3AssociateChoice {
  readonly identifier: string;
  readonly text?: string | undefined;
  readonly contentHtml?: Qti3TrustedXmlFragment | undefined;
  readonly matchMax?: number | undefined;
  readonly fixed?: boolean | undefined;
}

export interface Qti3AssociatePair {
  readonly sourceIdentifier: string;
  readonly targetIdentifier: string;
}

export interface Qti3AssociateAuthoringItem extends Qti3AuthoringItemBase {
  readonly interactionType: "associate";
  readonly choices: readonly Qti3AssociateChoice[];
  readonly correctResponse: readonly Qti3AssociatePair[];
  readonly scoring?: Qti3ResponseProcessingTemplate | undefined;
  readonly shuffle?: boolean | undefined;
  readonly minAssociations?: number | undefined;
  readonly maxAssociations?: number | undefined;
  readonly classNames?: readonly string[] | undefined;
}

export type Qti3AssociateBuilderInput = Omit<Qti3AssociateAuthoringItem, "interactionType"> & {
  readonly interactionType?: "associate" | undefined;
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

export type Qti3GraphicAssociateShape = Qti3HotspotShape;

export interface Qti3HotspotChoice {
  readonly identifier: string;
  readonly shape: Qti3HotspotShape;
  readonly coords: string;
}

export interface Qti3GraphicObject {
  readonly data: string;
  readonly alt?: string | undefined;
  readonly type?: string | undefined;
  readonly width?: number | undefined;
  readonly height?: number | undefined;
  readonly longDescription?: string | undefined;
}

export type Qti3HotspotObject = Qti3GraphicObject;

export interface Qti3HotspotAuthoringItem extends Qti3AuthoringItemBase {
  readonly interactionType: "hotspot";
  readonly object: Qti3GraphicObject;
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

export interface Qti3GraphicAssociateHotspot {
  readonly identifier: string;
  readonly shape: Qti3GraphicAssociateShape;
  readonly coords: string;
  readonly matchMax?: number | undefined;
  readonly hotspotLabel?: string | undefined;
}

export type Qti3GraphicAssociateObject = Qti3GraphicObject;

export interface Qti3GraphicAssociatePair {
  readonly sourceIdentifier: string;
  readonly targetIdentifier: string;
}

export interface Qti3GraphicAssociateAuthoringItem extends Qti3AuthoringItemBase {
  readonly interactionType: "graphicAssociate";
  readonly object: Qti3GraphicObject;
  readonly hotspots: readonly Qti3GraphicAssociateHotspot[];
  readonly correctResponse: readonly Qti3GraphicAssociatePair[];
  readonly scoring?: Qti3ResponseProcessingTemplate | undefined;
  readonly minAssociations?: number | undefined;
  readonly maxAssociations?: number | undefined;
  readonly classNames?: readonly string[] | undefined;
}

export type Qti3GraphicAssociateBuilderInput = Omit<
  Qti3GraphicAssociateAuthoringItem,
  "interactionType"
> & {
  readonly interactionType?: "graphicAssociate" | undefined;
};

export interface Qti3GraphicGapTextChoice {
  readonly identifier: string;
  readonly kind: "text";
  readonly text?: string | undefined;
  readonly contentHtml?: Qti3TrustedXmlFragment | undefined;
  readonly matchMax?: number | undefined;
  readonly fixed?: boolean | undefined;
}

export interface Qti3GraphicGapImageChoice {
  readonly identifier: string;
  readonly kind: "image";
  readonly object: Qti3GraphicObject;
  readonly matchMax?: number | undefined;
  readonly fixed?: boolean | undefined;
}

export type Qti3GraphicGapChoice = Qti3GraphicGapTextChoice | Qti3GraphicGapImageChoice;

export interface Qti3GraphicGapHotspotTarget {
  readonly targetType?: "hotspot" | undefined;
  readonly identifier: string;
  readonly shape: Qti3HotspotShape;
  readonly coords: string;
  readonly matchMax?: number | undefined;
}

export interface Qti3GraphicGapInlineTarget {
  readonly targetType: "inlineGap";
  readonly identifier: string;
  readonly matchMax?: number | undefined;
}

export type Qti3GraphicGapTarget = Qti3GraphicGapHotspotTarget | Qti3GraphicGapInlineTarget;

export interface Qti3GraphicGapPair {
  readonly sourceIdentifier: string;
  readonly targetIdentifier: string;
}

export interface Qti3GraphicGapMatchAuthoringItem extends Qti3AuthoringItemBase {
  readonly interactionType: "graphicGapMatch";
  readonly object: Qti3GraphicObject;
  readonly choices: readonly Qti3GraphicGapChoice[];
  readonly targets: readonly Qti3GraphicGapTarget[];
  readonly correctResponse: readonly Qti3GraphicGapPair[];
  readonly scoring?: Qti3ResponseProcessingTemplate | undefined;
  readonly minAssociations?: number | undefined;
  readonly maxAssociations?: number | undefined;
  readonly minAssociationsMessage?: string | undefined;
  readonly maxAssociationsMessage?: string | undefined;
  readonly classNames?: readonly string[] | undefined;
}

export type Qti3GraphicGapMatchBuilderInput = Omit<
  Qti3GraphicGapMatchAuthoringItem,
  "interactionType"
> & {
  readonly interactionType?: "graphicGapMatch" | undefined;
};

export type Qti3AuthoringItem =
  | Qti3ChoiceAuthoringItem
  | Qti3OrderAuthoringItem
  | Qti3InlineChoiceAuthoringItem
  | Qti3HottextAuthoringItem
  | Qti3GapMatchAuthoringItem
  | Qti3ExtendedTextAuthoringItem
  | Qti3AssociateAuthoringItem
  | Qti3TextEntryAuthoringItem
  | Qti3MatchAuthoringItem
  | Qti3HotspotAuthoringItem
  | Qti3GraphicAssociateAuthoringItem
  | Qti3GraphicGapMatchAuthoringItem;
