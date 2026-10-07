import { testExpressionSyntax } from "./test-expression.js";
import type { QtiTestElementSupport } from "./types.js";

/** Explicit scope and evidence for the finite forward-branching execution profile. */
const executableTestSupport: readonly QtiTestElementSupport[] = [
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
    "packages/core/src/scoring-boundary-regressions.test.ts",
    "packages/core/src/test-validation.test.ts",
    "packages/core/src/test-language.test.ts",
    "packages/writer/src/assessment-test.test.ts",
    "packages/conformance/src/staged-assessment.test.ts",
  ],
  notes: `parseQtiTest / parseQtiTestExecution / startQtiTest / submitQtiTestAnswer only: one linear, individually submitted part; flat fixed sections; forward section branches and EXIT_TEST; scalar test outcomes, SCORE aggregation by one category, expressions: ${testExpressionSyntax.map((entry) => entry.name).join(", ")}. Fixed and sequenced classification share this closed validator. Nested/referenced sections, other modes, weights, mappings and template-default overrides are rejected. Not item-player or general test-runner certification.`,
}));

/** Executable test support and explicit delivery refusals; interchange has a broader scope. */
export const testExecutionSupport: readonly QtiTestElementSupport[] = [
  ...executableTestSupport,
  {
    qtiName: "qti-ordering",
    category: "test",
    support: "supported",
    specReference: "QTI 3.0.1 ASI section ordering; implementation guide §4.5.2",
    parse: true,
    validate: true,
    render: false,
    process: true,
    fixtures: ["tests/fixtures/test-profile/fixed-ordering-multiple-parts.xml"],
    tests: [
      "packages/core/src/test-ordering.test.ts",
      "packages/writer/src/assessment-test-ordering.test.ts",
    ],
    notes:
      "parseQtiFixedTestOrdering / prepareQtiFixedTestOrder only: flat visible sections; section-local shuffle; fixed item-reference slots; multiple part boundaries retained; exact versioned saved-order restoration. Selection, nested sections, branches/preconditions and extension ordering are rejected. Hosts still own navigation/timing/content delivery. The separate branching test executor does not accept ordering. Not a general test-runner certification.",
  },
  ...[
    {
      qtiName: "qti-test-feedback",
      section: "5.157",
      fixture: "feedback-test-during.xml",
      diagnostic: "test.feedback.unsupported",
    },
    {
      qtiName: "qti-time-limits",
      section: "7.40",
      fixture: "timing-test.xml",
      diagnostic: "test.time-limits.unsupported",
    },
    {
      qtiName: "qti-item-session-control",
      section: "7.19",
      fixture: "controls-part.xml",
      diagnostic: "test.session-control.unsupported",
    },
  ].map(
    ({ qtiName, section, fixture, diagnostic }): QtiTestElementSupport => ({
      qtiName,
      category: "test",
      support: "unsupported",
      specReference: `QTI 3.0.1 ASI §${section}`,
      parse: false,
      validate: true,
      render: false,
      process: false,
      fixtures: [`tests/fixtures/test-delivery/${fixture}`],
      tests: ["packages/core/src/test-delivery-content.test.ts"],
      notes: `parseQtiTestExecution rejects delivery with ${diagnostic}. Interchange preservation does not imply execution support.`,
    }),
  ),
];
