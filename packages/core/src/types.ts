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

export type QtiValue = string | number | boolean | string[] | null;

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
}

export interface QtiTemplateDeclaration extends QtiVariableDeclaration {
  kind: "template";
}

export interface QtiChoice {
  identifier: string;
  text: string;
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

export interface QtiInteraction {
  type: QtiInteractionType;
  qtiName: string;
  responseIdentifier?: string | undefined;
  responseCardinality?: QtiCardinality | undefined;
  responseBaseType?: QtiBaseType | undefined;
  prompt?: string | undefined;
  object?: QtiObjectAsset | undefined;
  choices: QtiChoice[];
  childElements: QtiElementChild[];
  attributes: Record<string, string>;
  text: string;
  source?: QtiSourceLocation | undefined;
}

export interface QtiObjectAsset {
  data?: string | undefined;
  type?: string | undefined;
  width?: string | undefined;
  height?: string | undefined;
  text: string;
  attributes: Record<string, string>;
  source?: QtiSourceLocation | undefined;
}

export interface QtiAssessmentItem {
  identifier: string;
  title?: string | undefined;
  prompt?: string | undefined;
  responseDeclarations: QtiResponseDeclaration[];
  outcomeDeclarations: QtiOutcomeDeclaration[];
  templateDeclarations: QtiTemplateDeclaration[];
  templateProcessing?: QtiTemplateProcessing | undefined;
  responseProcessing?: QtiResponseProcessing | undefined;
  interactions: QtiInteraction[];
  modalFeedback: QtiModalFeedback[];
  bodyText: string;
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
  conditions: QtiResponseCondition[];
}

export interface QtiResponseCondition {
  ifExpression?: QtiProcessingExpression | undefined;
  thenRules: QtiSetOutcomeValue[];
  elseIfs: QtiResponseBranch[];
  elseRules: QtiSetOutcomeValue[];
}

export interface QtiResponseBranch {
  expression?: QtiProcessingExpression | undefined;
  rules: QtiSetOutcomeValue[];
}

export interface QtiSetOutcomeValue {
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
      type: "setCorrectResponse";
      identifier: string;
      expression: QtiProcessingExpression;
      source?: QtiSourceLocation | undefined;
    };

export type QtiProcessingExpression = (
  | {
      type: "baseValue";
      value: QtiValue;
      rawValue?: string | undefined;
      baseType?: string | undefined;
    }
  | { type: "isNull"; identifier: string }
  | { type: "matchCorrect"; identifier: string; correctIdentifier: string }
  | { type: "mapResponse"; identifier: string }
  | { type: "variable"; identifier: string }
  | {
      type: "randomInteger";
      min: number;
      max: number;
      step: number;
      attributes: Record<string, string>;
    }
  | { type: "random"; values: QtiProcessingExpression[] }
  | { type: "sum"; expressions: QtiProcessingExpression[] }
  | { type: "product"; expressions: QtiProcessingExpression[] }
  | { type: "subtract"; left: QtiProcessingExpression; right: QtiProcessingExpression }
  | { type: "and"; expressions: QtiProcessingExpression[] }
  | { type: "or"; expressions: QtiProcessingExpression[] }
  | { type: "not"; expression: QtiProcessingExpression }
  | { type: "equal"; left: QtiProcessingExpression; right: QtiProcessingExpression }
  | {
      type: "stringMatch";
      left: QtiProcessingExpression;
      right: QtiProcessingExpression;
      caseSensitive: boolean;
      substring: boolean;
    }
  | { type: "member"; value: QtiProcessingExpression; collection: QtiProcessingExpression }
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
  validationMessages: QtiDiagnostic[];
}

export interface QtiScoreResult {
  outcomes: Record<string, QtiValue>;
  diagnostics: QtiDiagnostic[];
  state: QtiAttemptStateV1;
}

export interface QtiElementSupport {
  qtiName: string;
  category: "interaction";
  interactionType: QtiInteractionType;
  support: QtiSupportStatus;
  specReference: string;
  parse: boolean;
  validate: boolean;
  render: boolean;
  process: boolean;
  tests: string[];
  notes?: string | undefined;
}
