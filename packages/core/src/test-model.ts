import type { QtiDiagnostic, QtiOutcomeDeclaration } from "./types.js";
import type { QtiTestBaseType, QtiTestExpression } from "./test-expression.js";

/** An ordered branch evaluated after the section's final item submission. */
export interface QtiTestBranch {
  readonly target: string;
  readonly expression: QtiTestExpression;
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
  readonly outcomeProcessing: readonly QtiTestOutcomeRule[];
}

/** Sequential assignment of a test expression to a declared test outcome. */
export interface QtiTestOutcomeRule {
  readonly type: "setOutcomeValue";
  readonly identifier: string;
  readonly expression: QtiTestExpression;
}

type ExecutableSection = QtiTestSection & {
  readonly items: readonly [QtiTestItemRef, ...QtiTestItemRef[]];
};
type ExecutableOutcome = Readonly<QtiOutcomeDeclaration> & {
  readonly cardinality: "single";
  readonly baseType: QtiTestBaseType;
  readonly defaultValue: number | boolean | string | null;
};

declare const executableTest: unique symbol;

/** A test checked for supported expressions, unique identifiers and forward routing. */
export type QtiExecutableTest = Omit<QtiTestDefinition, "sections" | "outcomeDeclarations"> & {
  readonly [executableTest]: true;
  readonly sections: readonly [ExecutableSection, ...ExecutableSection[]];
  readonly outcomeDeclarations: readonly ExecutableOutcome[];
};

/** Typed failure channel shared by test construction, parsing and transitions. */
export type QtiTestResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly diagnostics: readonly QtiDiagnostic[] };

/** Construct a safe test diagnostic without including submitted content. */
export function testFailure(code: string, message: string): QtiTestResult<never> {
  return { ok: false, diagnostics: [{ code: `test.${code}`, severity: "error", message }] };
}
