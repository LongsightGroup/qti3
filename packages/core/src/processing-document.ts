import type { QtiDocument, QtiOutcomeDeclaration } from "./types.js";

/** Declarations available when processing a test rather than an assessment item. */
export interface QtiTestProcessingDocument {
  readonly test: { readonly outcomeDeclarations: readonly QtiOutcomeDeclaration[] };
}

/** Item and test scope remain distinct while sharing expression semantics. */
export type QtiProcessingDocument = QtiDocument | QtiTestProcessingDocument;
