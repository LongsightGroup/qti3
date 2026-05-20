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
  path?: string;
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

export interface QtiVariableDeclaration {
  identifier: string;
  baseType?: QtiBaseType | undefined;
  cardinality: QtiCardinality;
  defaultValue: QtiValue;
}

export interface QtiResponseDeclaration extends QtiVariableDeclaration {
  kind: "response";
  correctResponse: QtiValue;
  mapping?: Record<string, number> | undefined;
}

export interface QtiOutcomeDeclaration extends QtiVariableDeclaration {
  kind: "outcome";
}

export interface QtiChoice {
  identifier: string;
  text: string;
}

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
  prompt?: string | undefined;
  choices: QtiChoice[];
  attributes: Record<string, string>;
  text: string;
}

export interface QtiAssessmentItem {
  identifier: string;
  title?: string | undefined;
  responseDeclarations: QtiResponseDeclaration[];
  outcomeDeclarations: QtiOutcomeDeclaration[];
  interactions: QtiInteraction[];
  bodyText: string;
}

export interface QtiDocument {
  item: QtiAssessmentItem;
  diagnostics: QtiDiagnostic[];
}

export interface QtiParseResult {
  ok: boolean;
  document?: QtiDocument | undefined;
  diagnostics: QtiDiagnostic[];
}

export interface QtiAttemptStateV1 {
  schema: "qti3.attempt-state.v1";
  itemIdentifier: string;
  responses: Record<string, QtiValue>;
  outcomes: Record<string, QtiValue>;
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
  notes?: string | undefined;
}
