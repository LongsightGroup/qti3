import { testExpressionSyntax } from "./test-expression.js";
import type { QtiTestElementSupport } from "./types.js";

/** Explicit scope and evidence for the finite forward-branching execution profile. */
export const testExecutionSupport: readonly QtiTestElementSupport[] = [
  "qti-assessment-test",
  "qti-test-part",
  "qti-assessment-section",
  "qti-assessment-item-ref",
  "qti-branch-rule",
  "qti-outcome-processing",
  "qti-test-variables",
].map((qtiName) => ({
  qtiName,
  category: "test",
  support: "supported",
  specReference: "QTI 3.0.1 ASI test sequencing and outcome processing",
  parse: true,
  validate: true,
  render: false,
  process: true,
  fixtures: ["tests/fixtures/staged-assessment-test.xml"],
  tests: [
    "packages/core/src/test-session.test.ts",
    "packages/core/src/test-validation.test.ts",
    "packages/core/src/test-language.test.ts",
    "packages/writer/src/assessment-test.test.ts",
    "packages/conformance/src/staged-assessment.test.ts",
  ],
  notes: `parseQtiTest / startQtiTest / submitQtiTestAnswer only: one linear, individually submitted part; flat fixed sections; forward section branches and EXIT_TEST; scalar test outcomes, SCORE aggregation by one category, expressions: ${testExpressionSyntax.map((entry) => entry.name).join(", ")}. Unsupported test features are rejected. Not item-player or general test-runner certification.`,
}));
