export type Qti3PnpDiagnosticSeverity = "info" | "warning" | "error";

export type Qti3PnpDiagnosticCode =
  | "PNP_UNKNOWN_ELEMENT"
  | "PNP_UNKNOWN_SUPPORT"
  | "PNP_UNSUPPORTED_EXTENSION"
  | "PNP_PROFILE_PROHIBITED_FEATURE"
  | "PNP_INVALID_ENUM"
  | "PNP_INVALID_HEX_COLOR"
  | "PNP_INVALID_NUMBER"
  | "PNP_INVALID_LANGUAGE_TAG"
  | "PNP_DUPLICATE_SINGLETON"
  | "PNP_INVALID_XOR_SELECTION"
  | "PNP_CONFLICTING_SUPPORT_STATE"
  | "PNP_UNSUPPORTED_BY_PLAYER"
  | "PNP_BLOCKED_BY_POLICY"
  | "PNP_CATALOG_SUPPORT_MISSING"
  | "PNP_CATALOG_LANGUAGE_MISSING"
  | "PNP_RECORD_NOT_APPLICABLE"
  | "PNP_PRIVACY_REDACTED"
  | "PNP_XML_PARSE_ERROR";

export type Qti3PnpMode =
  | "required"
  | "activate-at-initialization"
  | "activate-as-option"
  | "prohibited";

export type Qti3PnpKnownSupportName =
  | "additional-directions"
  | "additional-testing-time"
  | "alternative-text"
  | "answer-masking"
  | "audio-description"
  | "braille"
  | "calculator-on-screen"
  | "captions"
  | "dictionary-on-screen"
  | "encouragement"
  | "environment"
  | "glossary-on-screen"
  | "hazard-avoidance"
  | "high-contrast"
  | "homophone-checker-on-screen"
  | "input-requirements"
  | "invert-display-polarity"
  | "item-translation"
  | "keyboard-directions"
  | "keyword-emphasis"
  | "keyword-translation"
  | "language-of-interface"
  | "layout-single-column"
  | "line-reader"
  | "linguistic-guidance"
  | "long-description"
  | "magnification"
  | "note-taking-on-screen"
  | "outliner-on-screen"
  | "peer-interaction-on-screen"
  | "sign-language"
  | "simplified-graphics"
  | "simplified-language-portions"
  | "spell-checker-on-screen"
  | "spoken"
  | "tactile"
  | "text-appearance"
  | "thesaurus-on-screen"
  | "transcript"
  | "visual-organizer-on-screen";

export type Qti3PnpSupportName = Qti3PnpKnownSupportName | `ext:${string}` | (string & {});
export type Qti3PnpParams = Record<string, unknown>;

export interface Qti3PnpSourceRef {
  recordIndex?: number | undefined;
  elementName?: string | undefined;
  path?: string | undefined;
  line?: number | undefined;
  column?: number | undefined;
}

export interface Qti3PnpDiagnostic {
  code: Qti3PnpDiagnosticCode;
  severity: Qti3PnpDiagnosticSeverity;
  message: string;
  support?: Qti3PnpSupportName | undefined;
  source?: Qti3PnpSourceRef | undefined;
  data?: Record<string, unknown> | undefined;
}

export interface Qti3PnpPreference {
  support: Qti3PnpSupportName;
  mode: Qti3PnpMode;
  params: Qti3PnpParams;
  source?: Qti3PnpSourceRef | undefined;
}

export interface NormalizedQti3PnpProfile {
  preferences: Qti3PnpPreference[];
  records: Qti3PnpRecord[];
  diagnostics: Qti3PnpDiagnostic[];
}

export interface Qti3PnpRecord {
  index: number;
  identifier?: string | undefined;
  preferences: Qti3PnpPreference[];
}

export interface Qti3PnpParseResult {
  ok: boolean;
  records: Qti3PnpRecordLike[];
  diagnostics: Qti3PnpDiagnostic[];
}

export interface Qti3PnpNormalizeResult {
  ok: boolean;
  profile: NormalizedQti3PnpProfile;
  diagnostics: Qti3PnpDiagnostic[];
}

export interface Qti3PnpValidationResult {
  ok: boolean;
  diagnostics: Qti3PnpDiagnostic[];
}

export interface Qti3PnpRecordLike {
  identifier?: string | undefined;
  preferences?: Qti3PnpPreferenceLike[] | undefined;
  elements?: Qti3PnpElementLike[] | undefined;
}

export interface Qti3PnpPreferenceLike {
  support: string;
  mode?: Qti3PnpMode | undefined;
  params?: Qti3PnpParams | undefined;
}

export interface Qti3PnpElementLike {
  name: string;
  attributes?: Record<string, string> | undefined;
  children?: Qti3PnpElementLike[] | undefined;
  text?: string | undefined;
}

export interface Qti3PnpXmlAdapter {
  parse(xml: string): unknown;
}

export type Qti3PnpSupportCategory =
  | "display"
  | "tool"
  | "media"
  | "session"
  | "catalog-content"
  | "language"
  | "environment"
  | "extension";

export interface Qti3PnpParamDefinition {
  name: string;
  valueType: "boolean" | "color" | "enum" | "language" | "number" | "string";
  values?: readonly string[] | undefined;
}

export type Qti3PnpSupportLevel = "recognized" | "catalog" | "runtime" | "runtime-and-catalog";

export interface Qti3PnpSupportDefinition {
  name: string;
  category: Qti3PnpSupportCategory;
  cardinality: "zero-or-one" | "zero-or-many";
  params: readonly Qti3PnpParamDefinition[];
  allowedInFeatureSet: boolean;
  allowedAsCatalogSupport: boolean;
  supportLevel: Qti3PnpSupportLevel;
  implemented: boolean;
}

export interface Qti3PnpCapabilityMap {
  supports: Partial<Record<string, Qti3PnpSupportCapability>>;
  tools?:
    | {
        calculator?: boolean | readonly Qti3PnpCalculatorType[] | undefined;
        lineReader?: boolean | undefined;
        dictionary?: boolean | undefined;
        glossary?: boolean | undefined;
        spellCheck?: boolean | undefined;
        answerMasking?: boolean | undefined;
      }
    | undefined;
  display?:
    | {
        textAppearance?: boolean | undefined;
        magnification?: boolean | undefined;
        highContrast?: boolean | undefined;
        singleColumn?: boolean | undefined;
        keywordEmphasis?: boolean | undefined;
      }
    | undefined;
  media?:
    | {
        spoken?: boolean | undefined;
        captions?: boolean | undefined;
        transcript?: boolean | undefined;
        signLanguage?: boolean | undefined;
      }
    | undefined;
  session?:
    | {
        additionalTime?: boolean | undefined;
      }
    | undefined;
}

export interface Qti3PnpSupportCapability {
  supported: boolean;
}

export type Qti3PnpCalculatorType =
  | "basic"
  | "standard"
  | "scientific"
  | "graphing"
  | `ext:${string}`;

export interface Qti3PnpResolveContext {
  capabilities: Qti3PnpCapabilityMap;
  qti?:
    | {
        catalogResolution?: QtiCatalogSupportResolutionLike | undefined;
        catalogSupports?: QtiCatalogSupportSummary[] | undefined;
      }
    | undefined;
  policy?: Qti3PnpResolvePolicy | undefined;
  activity?:
    | {
        language?: string | undefined;
      }
    | undefined;
}

export interface Qti3PnpResolvePolicy {
  isSupportAllowed?:
    | ((
        preference: Qti3PnpPreference,
        context: Qti3PnpResolveContext,
      ) => boolean | Qti3PnpPolicyDecision)
    | undefined;
  onUnsupportedSupport?: "ignore" | "diagnostic" | "error" | undefined;
  onConflict?: "diagnostic" | "error" | "prohibit-wins" | undefined;
  onCustomSupport?: "preserve" | "diagnostic" | "error" | "ignore" | undefined;
}

export interface Qti3PnpPolicyDecision {
  allowed: boolean;
  reason?: string | undefined;
}

export interface Qti3PnpDisplayOptions {
  fontSize?: number | undefined;
  fontColor?: string | undefined;
  backgroundColor?: string | undefined;
  fontFace?: string | undefined;
  lineHeight?: number | undefined;
  lineSpacing?: number | undefined;
  letterSpacing?: number | undefined;
  wordSpacing?: number | undefined;
  wordWrapping?: boolean | undefined;
  magnification?:
    | {
        allContent?: number | undefined;
        text?: number | undefined;
        nonText?: number | undefined;
      }
    | undefined;
  highContrast?: boolean | undefined;
  keywordEmphasis?: boolean | undefined;
  invertDisplayPolarity?:
    | {
        foreground?: string | undefined;
        background?: string | undefined;
      }
    | undefined;
  singleColumn?: boolean | undefined;
}

export interface Qti3PnpToolOptions {
  calculator?:
    | {
        enabled: boolean;
        type?: Qti3PnpCalculatorType | undefined;
        locked?: boolean | undefined;
      }
    | undefined;
  lineReader?:
    | {
        enabled: boolean;
        highlightColor?: string | undefined;
      }
    | undefined;
  dictionary?: Qti3PnpToolState | undefined;
  glossary?: Qti3PnpToolState | undefined;
  spellChecker?: Qti3PnpToolState | undefined;
  answerMasking?: Qti3PnpToolState | undefined;
}

export interface Qti3PnpToolState {
  enabled: boolean;
  locked?: boolean | undefined;
}

export interface Qti3PnpMediaOptions {
  spoken?:
    | {
        enabled: boolean;
        readingType?: "screen-reader" | "computer-read-aloud" | undefined;
        speechRate?: number | undefined;
        pitch?: number | undefined;
        volume?: number | undefined;
        restrictions?: string[] | undefined;
      }
    | undefined;
  captions?: Qti3PnpSupportState | undefined;
  transcript?: Qti3PnpSupportState | undefined;
  audioDescription?: Qti3PnpSupportState | undefined;
  signLanguage?:
    | {
        enabled: boolean;
        language?: string | undefined;
      }
    | undefined;
}

export interface Qti3PnpSupportState {
  enabled: boolean;
}

export interface Qti3PnpSessionOptions {
  additionalTestingTime?:
    | { type: "time-multiplier"; multiplier: number }
    | { type: "fixed-minutes"; minutes: number }
    | { type: "unlimited" }
    | undefined;
}

export interface Qti3PnpResolution {
  display: Qti3PnpDisplayOptions;
  tools: Qti3PnpToolOptions;
  media: Qti3PnpMediaOptions;
  session: Qti3PnpSessionOptions;
  catalogRequests: Qti3PnpCatalogSupportRequest[];
  prohibited: Qti3PnpSupportName[];
  /** Custom ext:* supports preserved for host-specific handling. */
  extensions: Qti3PnpPreference[];
  unresolved: Qti3PnpUnresolvedPreference[];
  diagnostics: Qti3PnpDiagnostic[];
}

export interface Qti3PnpCatalogSupportRequest {
  support: Qti3PnpSupportName;
  catalogId: string;
  entryLanguage?: string | undefined;
  reason: "pnp-required" | "pnp-initial" | "host-policy";
}

export interface Qti3PnpUnresolvedPreference {
  preference: Qti3PnpPreference;
  reason:
    | "invalid"
    | "prohibited"
    | "policy-blocked"
    | "unsupported"
    | "content-missing"
    | "conflict";
}

export interface QtiCatalogSupportResolutionLike {
  references: readonly {
    matches: readonly QtiCatalogSupportSummary[];
  }[];
}

export interface QtiCatalogSupportSummary {
  catalogId: string;
  support: string;
  default?: boolean | undefined;
  language?: string | undefined;
  fileHrefs?: readonly unknown[] | undefined;
  attributes?: Record<string, string> | undefined;
  cardAttributes?: Record<string, string> | undefined;
  catalogAttributes?: Record<string, string> | undefined;
}
