import type {
  QtiDiagnostic,
  QtiOutcomeDeclaration,
  QtiProcessingExpression,
  QtiSetOutcomeValue,
} from "./types.js";

/** An ordered branch evaluated after the section's final item submission. */
export interface QtiTestBranch {
  readonly target: string;
  readonly expression: QtiProcessingExpression;
}

/** A fixed item reference; categories participate in test-variable aggregation. */
export interface QtiTestItemRef {
  readonly identifier: string;
  readonly href: string;
  readonly categories: readonly string[];
}

/** A flat section in the supported linear, individually submitted test profile. */
export interface QtiTestSection {
  readonly identifier: string;
  readonly title: string;
  readonly items: readonly QtiTestItemRef[];
  readonly branches: readonly QtiTestBranch[];
}

/** Framework-neutral QTI test definition. Validation establishes executable support. */
export interface QtiTestDefinition {
  readonly identifier: string;
  readonly title: string;
  readonly partIdentifier: string;
  readonly sections: readonly QtiTestSection[];
  readonly outcomeDeclarations: readonly QtiOutcomeDeclaration[];
  readonly outcomeProcessing: readonly QtiSetOutcomeValue[];
}

declare const executableTest: unique symbol;

/** A test checked for supported expressions, unique identifiers and forward routing. */
export type QtiExecutableTest = QtiTestDefinition & { readonly [executableTest]: true };

/** Typed failure channel shared by test construction, parsing and transitions. */
export type QtiTestResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly diagnostics: readonly QtiDiagnostic[] };

/** Construct a safe test diagnostic without including submitted content. */
export function testFailure(code: string, message: string): QtiTestResult<never> {
  return { ok: false, diagnostics: [{ code: `test.${code}`, severity: "error", message }] };
}
