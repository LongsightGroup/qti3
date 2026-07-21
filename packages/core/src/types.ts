export type QtiSupportStatus =
  | "unsupported"
  | "deprecated"
  | "parsed"
  | "validated"
  | "rendered"
  | "interactive"
  | "scored"
  | "accessible-tested"
  | "conformance-tested"
  | "supported";

export type QtiDiagnosticSeverity = "info" | "warning" | "error";

export interface QtiDiagnostic {
  code: string;
  severity: QtiDiagnosticSeverity;
  message: string;
  path?: string | undefined;
  source?: QtiSourceLocation | undefined;
}

export interface QtiSourceLocation {
  line: number;
  column: number;
  offset: number;
  path: string;
}

export type QtiBaseType =
  | "identifier"
  | "boolean"
  | "integer"
  | "float"
  | "string"
  | "point"
  | "pair"
  | "directedPair"
  | "duration"
  | "file"
  | "uri";

export type QtiCardinality = "single" | "multiple" | "ordered" | "record";

export type QtiScalarValue = string | number | boolean;
export interface QtiRecordValue {
  [fieldIdentifier: string]: QtiValue;
}
export type QtiValue = QtiScalarValue | QtiScalarValue[] | QtiRecordValue | null;
export type QtiPortableCustomStateValue =
  | string
  | number
  | boolean
  | null
  | QtiPortableCustomStateValue[]
  | { [key: string]: QtiPortableCustomStateValue };

export type QtiAttemptStatus = "initialized" | "interacting" | "suspended" | "completed";

export interface QtiVariableDeclaration {
  identifier: string;
  baseType?: QtiBaseType | undefined;
  cardinality: QtiCardinality;
  defaultValue: QtiValue;
  attributes: Record<string, string>;
  source?: QtiSourceLocation | undefined;
}

export interface QtiResponseDeclaration extends QtiVariableDeclaration {
  kind: "response";
  correctResponse: QtiValue;
  mapping?: QtiMapping | undefined;
  areaMapping?: QtiAreaMapping | undefined;
}

export interface QtiMapping {
  defaultValue: number;
  entries: QtiMapEntry[];
  attributes: Record<string, string>;
  source?: QtiSourceLocation | undefined;
}

export interface QtiMapEntry {
  mapKey?: string | undefined;
  mappedValue: number;
  attributes: Record<string, string>;
  source?: QtiSourceLocation | undefined;
}

export interface QtiAreaMapping {
  defaultValue: number;
  entries: QtiAreaMapEntry[];
  attributes: Record<string, string>;
  source?: QtiSourceLocation | undefined;
}

export interface QtiAreaMapEntry {
  shape: "circle" | "rect" | "poly" | "default";
  coords: number[];
  mappedValue: number;
  attributes: Record<string, string>;
  source?: QtiSourceLocation | undefined;
}

export interface QtiOutcomeDeclaration extends QtiVariableDeclaration {
  kind: "outcome";
  lookupTable?: QtiLookupTable | undefined;
}

export type QtiLookupTable = QtiMatchTable | QtiInterpolationTable;

export interface QtiLookupTableBase {
  defaultValue: QtiValue;
  entries: QtiLookupTableEntry[];
  attributes: Record<string, string>;
  source?: QtiSourceLocation | undefined;
}

export interface QtiMatchTable extends QtiLookupTableBase {
  type: "match";
}

export interface QtiInterpolationTable extends QtiLookupTableBase {
  type: "interpolation";
}

export interface QtiLookupTableEntry {
  sourceValue: number;
  targetValue: QtiValue;
  includeBoundary?: boolean | undefined;
  attributes: Record<string, string>;
  source?: QtiSourceLocation | undefined;
}

export interface QtiTemplateDeclaration extends QtiVariableDeclaration {
  kind: "template";
}

export interface QtiChoice {
  identifier: string;
  /** Plain-text fallback used for speech, TTS, diagnostics, and native controls. */
  text: string;
  /** Parsed visual content for renderers that can display rich choice markup such as MathML. */
  content?: QtiContentNode[] | undefined;
  asset?: QtiObjectAsset | undefined;
  role: QtiChoiceRole;
  qtiName: string;
  attributes: Record<string, string>;
  source?: QtiSourceLocation | undefined;
}

export interface QtiElementChild {
  qtiName: string;
  source?: QtiSourceLocation | undefined;
}

export type QtiChoiceRole =
  | "simpleChoice"
  | "associableChoice"
  | "matchSource"
  | "matchTarget"
  | "gapChoice"
  | "gap"
  | "hottext"
  | "hotspot"
  | "inlineChoice";

export type QtiInteractionType =
  | "associate"
  | "choice"
  | "custom"
  | "drawing"
  | "endAttempt"
  | "extendedText"
  | "gapMatch"
  | "graphicAssociate"
  | "graphicGapMatch"
  | "graphicOrder"
  | "hotspot"
  | "hottext"
  | "inlineChoice"
  | "match"
  | "media"
  | "order"
  | "positionObject"
  | "portableCustom"
  | "selectPoint"
  | "slider"
  | "textEntry"
  | "upload";

/** Parse-time status from the core interaction support registry. */
export type QtiInteractionRegistryStatus = "supported" | "deprecated" | "unsupported";

export interface QtiInteraction {
  type: QtiInteractionType;
  /** Parse-time status from the core interaction support registry. */
  registryStatus: QtiInteractionRegistryStatus;
  qtiName: string;
  responseIdentifier?: string | undefined;
  responseCardinality?: QtiCardinality | undefined;
  responseBaseType?: QtiBaseType | undefined;
  /** Flat accessibility/fallback label derived from prompt content with annotations stripped. */
  prompt?: string | undefined;
  /** Structured prompt content for visual rendering. When present, block headings render this instead of prompt. */
  promptContent?: QtiContentNode[] | undefined;
  promptAttributes?: Record<string, string> | undefined;
  promptSource?: QtiSourceLocation | undefined;
  contextText?: string | undefined;
  object?: QtiObjectAsset | undefined;
  positionObjectStage?: QtiObjectAsset | undefined;
  customInteraction?: QtiCustomInteractionDefinition | undefined;
  portableCustom?: QtiPortableCustomDefinition | undefined;
  choices: QtiChoice[];
  hottextSegments?: QtiHottextSegment[] | undefined;
  gapMatchSegments?: QtiGapMatchSegment[] | undefined;
  childElements: QtiElementChild[];
  attributes: Record<string, string>;
  text: string;
  source?: QtiSourceLocation | undefined;
}

export type QtiHottextSegment = QtiHottextTextSegment | QtiHottextChoiceSegment;

export interface QtiHottextTextSegment {
  kind: "text";
  text: string;
}

export interface QtiHottextChoiceSegment {
  kind: "hottext";
  identifier: string;
  text: string;
  attributes: Record<string, string>;
  source?: QtiSourceLocation | undefined;
}

export type QtiGapMatchSegment = QtiGapMatchTextSegment | QtiGapMatchGapSegment;

export interface QtiGapMatchTextSegment {
  kind: "text";
  text: string;
}

export interface QtiGapMatchGapSegment {
  kind: "gap";
  identifier: string;
  attributes: Record<string, string>;
  source?: QtiSourceLocation | undefined;
}

export interface QtiObjectAsset {
  data?: string | undefined;
  type?: string | undefined;
  width?: string | undefined;
  height?: string | undefined;
  sources: QtiMediaSource[];
  tracks: QtiMediaTrack[];
  text: string;
  attributes: Record<string, string>;
  source?: QtiSourceLocation | undefined;
}

export interface QtiMediaSource {
  src?: string | undefined;
  type?: string | undefined;
  attributes: Record<string, string>;
  source?: QtiSourceLocation | undefined;
}

export interface QtiMediaTrack {
  kind?: string | undefined;
  src?: string | undefined;
  srclang?: string | undefined;
  label?: string | undefined;
  default?: boolean | undefined;
  attributes: Record<string, string>;
  source?: QtiSourceLocation | undefined;
}

export interface QtiInteractionMarkupDefinition {
  responseIdentifier?: string | undefined;
  interactionMarkup: QtiContentNode[];
  interactionMarkupRaw?: string | undefined;
  dataAttributes: Record<string, string>;
  attributes: Record<string, string>;
  source?: QtiSourceLocation | undefined;
}

export type QtiCustomInteractionDefinition = QtiInteractionMarkupDefinition;

export interface QtiPortableCustomDefinition extends QtiInteractionMarkupDefinition {
  customInteractionTypeIdentifier?: string | undefined;
  module?: string | undefined;
  interactionModules?: QtiPortableCustomInteractionModules | undefined;
  templateVariables: QtiPortableCustomVariableBinding[];
  contextVariables: QtiPortableCustomVariableBinding[];
  stylesheets: QtiStylesheet[];
  catalogInfo?: QtiCatalogInfo | undefined;
}

export interface QtiPortableCustomInteractionModules {
  primaryConfiguration?: string | undefined;
  secondaryConfiguration?: string | undefined;
  modules: QtiPortableCustomInteractionModule[];
  attributes: Record<string, string>;
  source?: QtiSourceLocation | undefined;
}

export interface QtiPortableCustomInteractionModule {
  id?: string | undefined;
  primaryPath?: string | undefined;
  fallbackPath?: string | undefined;
  attributes: Record<string, string>;
  source?: QtiSourceLocation | undefined;
}

export interface QtiPortableCustomVariableBinding {
  identifier?: string | undefined;
  variableIdentifier?: string | undefined;
  kind: "template" | "context";
  attributes: Record<string, string>;
  source?: QtiSourceLocation | undefined;
}

export type QtiContentNode =
  | QtiTextContent
  | QtiElementContent
  | QtiInteractionContent
  | QtiPrintedVariableContent
  | QtiFeedbackContent;

export interface QtiTextContent {
  kind: "text";
  text: string;
  source?: QtiSourceLocation | undefined;
}

export interface QtiElementContent {
  kind: "element";
  qtiName: string;
  attributes: Record<string, string>;
  children: QtiContentNode[];
  source?: QtiSourceLocation | undefined;
}

export interface QtiInteractionContent {
  kind: "interaction";
  interactionIndex: number;
  qtiName: string;
  responseIdentifier?: string | undefined;
  source?: QtiSourceLocation | undefined;
}

export interface QtiPrintedVariableContent {
  kind: "printedVariable";
  identifier: string;
  format?: string | undefined;
  attributes: Record<string, string>;
  source?: QtiSourceLocation | undefined;
}

export interface QtiFeedbackContent {
  kind: "feedback";
  feedbackType: "block" | "inline";
  identifier: string;
  outcomeIdentifier: string;
  showHide: "show" | "hide";
  attributes: Record<string, string>;
  children: QtiContentNode[];
  source?: QtiSourceLocation | undefined;
}

export interface QtiCatalogInfo {
  catalogs: QtiCatalog[];
  source?: QtiSourceLocation | undefined;
}

export interface QtiCatalog {
  id: string;
  cards: QtiCatalogCard[];
  attributes: Record<string, string>;
  source?: QtiSourceLocation | undefined;
}

export interface QtiCatalogCard {
  support: string;
  language?: string | undefined;
  htmlContent?: QtiCatalogHtmlContent | undefined;
  fileHrefs: QtiCatalogFileHref[];
  entries: QtiCatalogCardEntry[];
  attributes: Record<string, string>;
  source?: QtiSourceLocation | undefined;
}

export interface QtiCatalogCardEntry {
  language?: string | undefined;
  default: boolean;
  htmlContent?: QtiCatalogHtmlContent | undefined;
  fileHrefs: QtiCatalogFileHref[];
  attributes: Record<string, string>;
  source?: QtiSourceLocation | undefined;
}

export interface QtiCatalogHtmlContent {
  text: string;
  children: QtiContentNode[];
  attributes: Record<string, string>;
  source?: QtiSourceLocation | undefined;
}

export interface QtiCatalogFileHref {
  href: string;
  mimeType?: string | undefined;
  attributes: Record<string, string>;
  source?: QtiSourceLocation | undefined;
}

export interface QtiCatalogReference {
  referenceId: string;
  idref: string;
  qtiName: string;
  source?: QtiSourceLocation | undefined;
}

export interface QtiStylesheet {
  href: string;
  type?: string | undefined;
  media?: string | undefined;
  title?: string | undefined;
  attributes: Record<string, string>;
  source?: QtiSourceLocation | undefined;
}

export interface QtiAssessmentItem {
  identifier: string;
  title?: string | undefined;
  language?: string | undefined;
  adaptive: boolean;
  timeDependent?: boolean | undefined;
  attributes: Record<string, string>;
  prompt?: string | undefined;
  itemBodyAttributes?: Record<string, string> | undefined;
  itemBodySource?: QtiSourceLocation | undefined;
  responseDeclarations: QtiResponseDeclaration[];
  outcomeDeclarations: QtiOutcomeDeclaration[];
  templateDeclarations: QtiTemplateDeclaration[];
  templateProcessing?: QtiTemplateProcessing | undefined;
  responseProcessing?: QtiResponseProcessing | undefined;
  interactions: QtiInteraction[];
  modalFeedback: QtiModalFeedback[];
  catalogInfo?: QtiCatalogInfo | undefined;
  companionMaterials?: QtiCompanionMaterialsInfo | undefined;
  catalogReferences: QtiCatalogReference[];
  stylesheets: QtiStylesheet[];
  body: QtiContentNode[];
  bodyText: string;
  source?: QtiSourceLocation | undefined;
}

export interface QtiCompanionMaterialsInfo {
  physicalMaterials: QtiPhysicalMaterial[];
  digitalMaterials: QtiDigitalMaterial[];
  unparsedChildren: QtiCompanionMaterialsUnparsedChild[];
  source?: QtiSourceLocation | undefined;
}

export interface QtiCompanionMaterialsUnparsedChild {
  qtiName: string;
  source?: QtiSourceLocation | undefined;
}

export interface QtiPhysicalMaterial {
  text: string;
  source?: QtiSourceLocation | undefined;
}

export interface QtiDigitalMaterial {
  fileHref: string;
  resourceIcon?: string | undefined;
  attributes: Record<string, string>;
  source?: QtiSourceLocation | undefined;
}

export interface QtiModalFeedback {
  identifier: string;
  outcomeIdentifier: string;
  showHide: "show" | "hide";
  text: string;
  source?: QtiSourceLocation | undefined;
}

export interface QtiResponseProcessing {
  template?: string | undefined;
  rules: QtiResponseRule[];
  conditions: QtiResponseCondition[];
}

export interface QtiResponseCondition {
  ifExpression?: QtiProcessingExpression | undefined;
  thenRules: QtiResponseRule[];
  elseIfs: QtiResponseBranch[];
  elseRules: QtiResponseRule[];
}

export interface QtiResponseBranch {
  expression?: QtiProcessingExpression | undefined;
  rules: QtiResponseRule[];
}

export type QtiResponseRule =
  | QtiSetOutcomeValue
  | QtiLookupOutcomeValue
  | { type: "exitResponse"; source?: QtiSourceLocation | undefined }
  | { type: "responseCondition"; condition: QtiResponseCondition; source?: QtiSourceLocation }
  | {
      type: "responseProcessingFragment";
      rules: QtiResponseRule[];
      source?: QtiSourceLocation | undefined;
    };

export interface QtiSetOutcomeValue {
  type: "setOutcomeValue";
  identifier: string;
  expression: QtiProcessingExpression;
  source?: QtiSourceLocation | undefined;
}

export interface QtiLookupOutcomeValue {
  type: "lookupOutcomeValue";
  identifier: string;
  expression: QtiProcessingExpression;
  source?: QtiSourceLocation | undefined;
}

export interface QtiTemplateProcessing {
  rules: QtiTemplateRule[];
}

export type QtiTemplateRule =
  | {
      type: "setTemplateValue";
      identifier: string;
      expression: QtiProcessingExpression;
      source?: QtiSourceLocation | undefined;
    }
  | {
      type: "setDefaultValue";
      identifier: string;
      expression: QtiProcessingExpression;
      source?: QtiSourceLocation | undefined;
    }
  | {
      type: "setCorrectResponse";
      identifier: string;
      expression: QtiProcessingExpression;
      source?: QtiSourceLocation | undefined;
    }
  | {
      type: "templateCondition";
      ifExpression?: QtiProcessingExpression | undefined;
      thenRules: QtiTemplateRule[];
      elseIfs: QtiTemplateBranch[];
      elseRules: QtiTemplateRule[];
      source?: QtiSourceLocation | undefined;
    }
  | {
      type: "exitTemplate";
      source?: QtiSourceLocation | undefined;
    }
  | {
      type: "templateConstraint";
      expression: QtiProcessingExpression;
      source?: QtiSourceLocation | undefined;
    };

export interface QtiTemplateBranch {
  expression?: QtiProcessingExpression | undefined;
  rules: QtiTemplateRule[];
}

export type QtiProcessingExpression = (
  | {
      type: "baseValue";
      value: QtiValue;
      rawValue?: string | undefined;
      baseType?: string | undefined;
    }
  | { type: "null" }
  | { type: "isNull"; identifier: string }
  | { type: "matchCorrect"; identifier: string; correctIdentifier: string }
  | { type: "match"; left: QtiProcessingExpression; right: QtiProcessingExpression }
  | { type: "correct"; identifier: string }
  | { type: "default"; identifier: string }
  | { type: "mapResponse"; identifier: string }
  | { type: "mapResponsePoint"; identifier: string }
  | { type: "variable"; identifier: string }
  | {
      type: "randomInteger";
      min: number;
      max: number;
      step: number;
      attributes: Record<string, string>;
    }
  | {
      type: "randomFloat";
      min: number;
      max: number;
      attributes: Record<string, string>;
    }
  | { type: "random"; values: QtiProcessingExpression[] }
  | { type: "multiple"; expressions: QtiProcessingExpression[] }
  | { type: "ordered"; expressions: QtiProcessingExpression[] }
  | { type: "index"; expression: QtiProcessingExpression; n: string }
  | { type: "containerSize"; expression: QtiProcessingExpression }
  | { type: "sum"; expressions: QtiProcessingExpression[] }
  | { type: "product"; expressions: QtiProcessingExpression[] }
  | { type: "min"; expressions: QtiProcessingExpression[] }
  | { type: "max"; expressions: QtiProcessingExpression[] }
  | { type: "subtract"; left: QtiProcessingExpression; right: QtiProcessingExpression }
  | { type: "divide"; left: QtiProcessingExpression; right: QtiProcessingExpression }
  | { type: "power"; left: QtiProcessingExpression; right: QtiProcessingExpression }
  | { type: "integerDivide"; left: QtiProcessingExpression; right: QtiProcessingExpression }
  | { type: "integerModulus"; left: QtiProcessingExpression; right: QtiProcessingExpression }
  | { type: "round"; expression: QtiProcessingExpression }
  | {
      type: "roundTo";
      expression: QtiProcessingExpression;
      roundingMode: "decimalPlaces" | "significantFigures";
      figures: number;
    }
  | { type: "truncate"; expression: QtiProcessingExpression }
  | { type: "integerToFloat"; expression: QtiProcessingExpression }
  | { type: "and"; expressions: QtiProcessingExpression[] }
  | { type: "anyN"; expressions: QtiProcessingExpression[]; min: string; max: string }
  | { type: "or"; expressions: QtiProcessingExpression[] }
  | { type: "not"; expression: QtiProcessingExpression }
  | { type: "equal"; left: QtiProcessingExpression; right: QtiProcessingExpression }
  | {
      type: "equalRounded";
      left: QtiProcessingExpression;
      right: QtiProcessingExpression;
      roundingMode: string;
      figures: number;
    }
  | {
      type: "numericCompare";
      operator: "lt" | "lte" | "gt" | "gte";
      left: QtiProcessingExpression;
      right: QtiProcessingExpression;
    }
  | {
      type: "durationCompare";
      operator: "lt" | "gte";
      left: QtiProcessingExpression;
      right: QtiProcessingExpression;
    }
  | {
      type: "stringMatch";
      left: QtiProcessingExpression;
      right: QtiProcessingExpression;
      caseSensitive: boolean;
      substring: boolean;
    }
  | {
      type: "substring";
      left: QtiProcessingExpression;
      right: QtiProcessingExpression;
      caseSensitive: boolean;
    }
  | { type: "patternMatch"; expression: QtiProcessingExpression; pattern: string }
  | { type: "fieldValue"; fieldIdentifier: string; expression: QtiProcessingExpression }
  | { type: "member"; value: QtiProcessingExpression; collection: QtiProcessingExpression }
  | { type: "delete"; value: QtiProcessingExpression; collection: QtiProcessingExpression }
  | { type: "contains"; collection: QtiProcessingExpression; values: QtiProcessingExpression }
  | { type: "gcd"; expressions: QtiProcessingExpression[] }
  | {
      type: "inside";
      expression: QtiProcessingExpression;
      shape: "circle" | "rect" | "poly" | "default";
      coords: number[];
      attributes: Record<string, string>;
    }
  | { type: "lcm"; expressions: QtiProcessingExpression[] }
  | { type: "mathConstant"; name: string }
  | { type: "mathOperator"; name: string; expressions: QtiProcessingExpression[] }
  | { type: "repeat"; numberRepeats: string; expressions: QtiProcessingExpression[] }
  | { type: "statsOperator"; name: string; expression: QtiProcessingExpression }
  | {
      type: "customOperator";
      definition?: string | undefined;
      className?: string | undefined;
      attributes: Record<string, string>;
      expressions: QtiProcessingExpression[];
    }
) & { source?: QtiSourceLocation | undefined };

export interface QtiDocument {
  item: QtiAssessmentItem;
  diagnostics: QtiDiagnostic[];
}

export interface QtiParseResult {
  ok: boolean;
  document?: QtiDocument | undefined;
  diagnostics: QtiDiagnostic[];
}

export interface QtiValidationResult {
  ok: boolean;
  diagnostics: QtiDiagnostic[];
}

export interface QtiAttemptStateV1 {
  schema: "qti3.attempt-state.v1";
  itemIdentifier: string;
  status: QtiAttemptStatus;
  responses: Record<string, QtiValue>;
  outcomes: Record<string, QtiValue>;
  templateValues?: Record<string, QtiValue> | undefined;
  interactionStates?: Record<string, QtiPortableCustomStateValue> | undefined;
  validationMessages: QtiDiagnostic[];
}

export interface QtiScoreResult {
  outcomes: Record<string, QtiValue>;
  diagnostics: QtiDiagnostic[];
  state: QtiAttemptStateV1;
}

export type QtiElementSupport =
  | QtiInteractionElementSupport
  | QtiProcessingElementSupport
  | QtiItemMetadataElementSupport;

interface QtiElementSupportBase {
  qtiName: string;
  support: QtiSupportStatus;
  specReference: string;
  parse: boolean;
  validate: boolean;
  render: boolean;
  process: boolean;
  fixtures: string[];
  tests: string[];
  notes?: string | undefined;
}

export interface QtiInteractionElementSupport extends QtiElementSupportBase {
  category: "interaction";
  interactionType: QtiInteractionType;
}

export interface QtiProcessingElementSupport extends QtiElementSupportBase {
  category: "processing";
}

export interface QtiItemMetadataElementSupport extends QtiElementSupportBase {
  category: "itemMetadata";
}

export interface SharedVocabularyClassSupport {
  className: string;
  scope: "interaction" | "content" | "gap";
  interactions?: QtiInteractionType[] | undefined;
  level: "full" | "stylesheet" | "pass-through" | "conditional";
  fixtures?: string[] | undefined;
  tests?: string[] | undefined;
  notes?: string | undefined;
}
