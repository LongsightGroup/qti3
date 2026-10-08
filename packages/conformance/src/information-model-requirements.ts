import type { QtiInformationModelRequirement } from "./information-model.js";

/** Reviewed boundary-specific claims and explicit audit backlog; never inferred from element support. */
export const qtiInformationModelRequirements = [
  {
    id: "fixed-section-instruction-writing",
    sections: ["4.2.14", "5.160", "5.160.1", "5.160.2"],
    elements: ["qti-rubric-block"],
    boundary: "parse",
    disposition: "implemented",
    rule: "Fixed-test writing retains static candidate instructions on their authored section without creating an item reference or response.",
    limitation:
      "Interchange and static host-content projection only. Hosts own display on section entry; core branching execution still rejects rubrics. Section shuffle remains scoped to the authored section.",
    evidence: [
      {
        path: "packages/writer/src/assessment-test-section-instructions.test.ts",
        marker: "[ASI-SECTION-INSTRUCTIONS-WRITER]",
        cases: 3,
      },
    ],
  },
  {
    id: "fixed-section-ordering",
    sections: ["5.98", "5.98.1", "5.6.3", "10.1.3"],
    elements: ["qti-ordering", "qti-assessment-item-ref"],
    boundary: "process",
    disposition: "implemented",
    rule: "Fixed-section question shuffling preserves authored fixed slots and part/section boundaries; saved permutations are restored without regeneration.",
    limitation:
      "The fixed-ordering API supports flat visible sections, including instruction-only scopes with empty reference arrays; the test needs at least one question reference. It rejects selection, nested sections, branches/preconditions and ordering extensions. Host navigation, instruction display, timing, delivery and per-attempt persistence are separate responsibilities; the branching executor still rejects ordering.",
    evidence: [
      { path: "packages/core/src/test-ordering.test.ts", marker: "[ASI-FIXED-ORDER]", cases: 2 },
      {
        path: "packages/core/src/test-ordering-instruction-sections.test.ts",
        marker: "[ASI-INSTRUCTION-SECTION-ORDER]",
        cases: 1,
      },
      {
        path: "packages/writer/src/assessment-test-ordering.test.ts",
        marker: "[ASI-FIXED-ORDER-WRITER]",
        cases: 1,
      },
    ],
  },
  {
    id: "test-feedback",
    sections: ["5.157", "5.157.1", "5.157.2"],
    elements: ["qti-test-feedback"],
    boundary: "deliver",
    disposition: "rejected",
    rule: "Tests containing outcome-controlled feedback must not be authorized for delivery that omits it.",
    limitation:
      "Explicit rejection at parseQtiTestExecution; this does not implement feedback delivery.",
    evidence: [
      {
        path: "packages/core/src/test-delivery-content.test.ts",
        marker: "[ASI-TEST-FEEDBACK]",
        cases: 4,
      },
    ],
  },
  {
    id: "test-rubrics",
    sections: ["5.160"],
    elements: ["qti-rubric-block"],
    boundary: "deliver",
    disposition: "rejected",
    rule: "Candidate test, part, and section instructions must not be silently omitted.",
    limitation: "Execution classifier rejects rubrics; package interchange remains available.",
    evidence: [
      {
        path: "packages/core/src/test-delivery-content.test.ts",
        marker: "[ASI-TEST-RUBRIC]",
        cases: 3,
      },
    ],
  },
  {
    id: "static-test-rubric-host-content",
    sections: ["5.160", "5.160.1", "5.160.2"],
    elements: ["qti-rubric-block"],
    boundary: "parse",
    disposition: "implemented",
    rule: "Static test rubrics retain their authored owner, audience and structured content; candidate projection excludes other audiences.",
    limitation:
      "DOM-free host-content parsing/projection only. Dynamic content, scoped resources and extension uses are rejected; test execution still rejects rubrics and host rendering is a separate responsibility.",
    evidence: [
      {
        path: "packages/core/src/test-rubrics.test.ts",
        marker: "[ASI-TEST-RUBRIC-STATIC]",
        cases: 1,
      },
      {
        path: "packages/player/test/test-rubric-delivery.test.ts",
        marker: "[ASI-TEST-RUBRIC-CANDIDATE]",
        cases: 1,
      },
    ],
  },
  {
    id: "test-outcome-routing",
    sections: ["2.9", "5.102"],
    elements: ["qti-outcome-processing"],
    boundary: "process",
    disposition: "implemented",
    rule: "Outcome processing requires execution even when the route has no branches.",
    limitation:
      "One linear, individually submitted part and the existing restricted expression language; not general test conformance.",
    evidence: [
      {
        path: "packages/core/src/test-delivery-content.test.ts",
        marker: "[ASI-TEST-OUTCOMES]",
        cases: 1,
      },
      {
        path: "packages/core/src/test-delivery-content.test.ts",
        marker: "[ASI-TEST-OUTCOMES-REJECT]",
        cases: 1,
      },
    ],
  },
  {
    id: "rubric-interactions",
    sections: ["5.120"],
    elements: ["qti-rubric-block"],
    boundary: "parse",
    disposition: "implemented",
    rule: "Rubrics must not contain interactions, including inside a scorer-only block.",
    limitation:
      "Diagnoses and excludes the interaction from live responses; does not prove all rubric content rules.",
    evidence: [
      {
        path: "packages/core/src/rubric.test.ts",
        marker: "[ASI-RUBRIC-INTERACTIONS]",
        cases: 1,
      },
    ],
  },
  {
    id: "rubric-audiences",
    sections: ["5.120.2"],
    elements: ["qti-rubric-block"],
    boundary: "validate",
    disposition: "implemented",
    rule: "Accept the defined rubric view tokens and a multiple-view list.",
    limitation:
      "Parser/validator vocabulary acceptance only; browser audience visibility is not claimed by this evidence.",
    evidence: [
      {
        path: "packages/core/src/rubric.test.ts",
        marker: "[ASI-RUBRIC-AUDIENCE]",
        cases: 7,
      },
    ],
  },
  {
    id: "rubric-resources",
    sections: ["5.120.3", "5.120.5"],
    elements: ["qti-rubric-block"],
    boundary: "parse",
    disposition: "rejected",
    rule: "Rubric-local stylesheets and catalogs cannot be treated as item-scoped resources.",
    limitation: "Core rejects scoped resources explicitly; scoped rendering is not implemented.",
    evidence: [
      {
        path: "packages/core/src/rubric.test.ts",
        marker: "[ASI-RUBRIC-RESOURCES]",
        cases: 2,
      },
    ],
  },
  {
    id: "order-full",
    sections: ["5.97.2", "5.97.3", "5.61.1", "5.61.2"],
    elements: ["qti-order-interaction", "qti-graphic-order-interaction"],
    boundary: "validate",
    disposition: "implemented",
    rule: "Without min-choices, a complete order contains every available choice exactly once.",
    limitation:
      "Checks invalid responses, independent correct/incorrect grades and incomplete-save constraints; browser ordering is separately tested.",
    evidence: [
      {
        path: "packages/core/src/order-response-contracts.test.ts",
        marker: "[ASI-ORDER-FULL]",
        cases: 2,
      },
    ],
  },
  {
    id: "order-subset",
    sections: ["5.97.2", "5.97.3", "5.61.1", "5.61.2"],
    elements: ["qti-order-interaction", "qti-graphic-order-interaction"],
    boundary: "validate",
    disposition: "implemented",
    rule: "Authored min-choices permits a unique subset constrained by min/max.",
    limitation: "Representative min=1/max=2 response validation; not an exhaustive bounds proof.",
    evidence: [
      {
        path: "packages/core/src/order-response-contracts.test.ts",
        marker: "[ASI-ORDER-SUBSET]",
        cases: 2,
      },
    ],
  },
  {
    id: "order-restore",
    sections: ["5.97.2", "2.7"],
    elements: ["qti-order-interaction"],
    boundary: "restore",
    disposition: "implemented",
    rule: "Restored responses are checked against the saved template clone visible choice domain.",
    limitation:
      "Order response restoration only; other interaction restoration remains a separate audit.",
    evidence: [
      {
        path: "packages/core/src/order-response-contracts.test.ts",
        marker: "[ASI-ORDER-RESTORE]",
        cases: 1,
      },
    ],
  },
  {
    id: "adaptive-completion",
    sections: ["2.2.1", "2.5"],
    elements: ["qti-assessment-item"],
    boundary: "process",
    disposition: "implemented",
    rule: "Completed adaptive sessions reject mutations and further response processing, including after restoration.",
    limitation:
      "Public item-session mutations; host UI behavior is not claimed by this Node evidence.",
    evidence: [
      {
        path: "packages/core/src/session-completed.test.ts",
        marker: "[ASI-ADAPTIVE-CLOSED]",
        cases: 1,
      },
      {
        path: "packages/core/src/session-sequences.test.ts",
        marker: "[ASI-ADAPTIVE-SEQUENCES]",
        cases: 258,
      },
    ],
  },
  {
    id: "feedback-default-restoration",
    sections: ["7.19.3"],
    elements: ["qti-feedback-block", "qti-feedback-inline"],
    boundary: "restore",
    disposition: "implemented",
    rule: "Effective initial outcome values used for review are independent of saved scored outcomes.",
    limitation:
      "Session state and template-effective defaults only; visible DOM and host review policy require browser evidence.",
    evidence: [
      {
        path: "packages/core/src/session-feedback-state.test.ts",
        marker: "[ASI-FEEDBACK-STATE]",
        cases: 1,
      },
    ],
  },
  {
    id: "migration-rubric-audience",
    sections: ["5.120.2"],
    elements: ["qti-rubric-block"],
    boundary: "migrate",
    disposition: "implemented",
    rule: "Migration preserves rubric audience while retaining correct, incorrect, and unanswered grades.",
    limitation:
      "QTI 2.1 source semantics also cited in the fixture; only the tested rubric conversion profile.",
    evidence: [
      {
        path: "packages/migrator/src/audience-lifecycle-fidelity.test.ts",
        marker: "[ASI-MIGRATE-RUBRIC]",
        cases: 3,
      },
    ],
  },
  {
    id: "migration-adaptive",
    sections: ["2.2.1"],
    elements: ["qti-assessment-item"],
    boundary: "migrate",
    disposition: "rejected",
    rule: "Migration must not silently turn adaptive sessions into nonadaptive sessions.",
    limitation:
      "Rejects QTI 2.1/2.2 adaptive imports under normal and safe repair; this is fidelity policy, not native adaptive support.",
    evidence: [
      {
        path: "packages/migrator/src/audience-lifecycle-fidelity.test.ts",
        marker: "[ASI-MIGRATE-ADAPTIVE]",
        cases: 3,
      },
    ],
  },
  {
    id: "fixed-time-limits",
    sections: ["7.40"],
    elements: ["qti-time-limits"],
    boundary: "deliver",
    disposition: "rejected",
    rule: "Every accepted test time limit must be enforced by delivery or explicitly rejected.",
    limitation:
      "Interchange preserves timing metadata; the execution classifier rejects timing at all four legal scopes.",
    evidence: [
      {
        path: "packages/core/src/test-delivery-content.test.ts",
        marker: "[ASI-TEST-TIMING]",
        cases: 4,
      },
    ],
  },
  {
    id: "fixed-session-controls",
    sections: ["7.19"],
    elements: ["qti-item-session-control"],
    boundary: "deliver",
    disposition: "rejected",
    rule: "Accepted test-level session controls must govern delivery or be explicitly rejected.",
    limitation:
      "Item session APIs implement host-provided controls; the test execution profile rejects inherited controls at all three legal scopes.",
    evidence: [
      {
        path: "packages/core/src/test-delivery-content.test.ts",
        marker: "[ASI-TEST-CONTROLS]",
        cases: 3,
      },
    ],
  },
  {
    id: "fixed-acceptance-profile",
    sections: ["4.2", "4.4", "5.6", "5.159", "7.48", "7.50", "5.152"],
    elements: [
      "qti-assessment-test",
      "qti-assessment-section",
      "qti-assessment-item-ref",
      "qti-test-part",
    ],
    boundary: "deliver",
    disposition: "implemented",
    rule: "Fixed and sequenced classification must share the validated execution profile; absence of routing instructions cannot bypass validation.",
    limitation:
      "One linear, individually submitted part, flat visible sections, distinct package-local item paths and scalar outcomes. Nested/referenced sections, multiple parts, other modes, reference weights/mappings/template defaults and unknown extensions are explicitly rejected. This is a closed delivery profile, not full ASI support or runtime XSD validation.",
    evidence: [
      {
        path: "packages/core/src/test-execution-profile.test.ts",
        marker: "[ASI-TEST-PROFILE-REJECTION]",
        cases: 12,
      },
      {
        path: "packages/core/src/test-execution-profile.test.ts",
        marker: "[ASI-TEST-PROFILE-ROUTING]",
        cases: 12,
      },
      {
        path: "packages/core/src/test-execution-profile.test.ts",
        marker: "[ASI-TEST-PROFILE-POSITIVE]",
        cases: 1,
      },
      {
        path: "packages/core/src/test-execution-profile.test.ts",
        marker: "[ASI-TEST-PROFILE-INVALID]",
        cases: 14,
      },
      {
        path: "packages/core/src/test-execution-profile.test.ts",
        marker: "[ASI-TEST-PROFILE-EXTENSIONS]",
        cases: 4,
      },
      {
        path: "packages/core/src/test-execution-profile.test.ts",
        marker: "[ASI-TEST-PROFILE-DIAGNOSTICS]",
        cases: 1,
      },
    ],
  },
  {
    id: "test-outcome-default-routing",
    sections: ["2.9", "4.5"],
    elements: ["qti-outcome-declaration"],
    boundary: "process",
    disposition: "implemented",
    rule: "Declared test outcomes need initialization even when no outcome-processing rules are present.",
    limitation:
      "Scalar outcome defaults in the closed test execution profile. The runtime does not invent score aggregation when no rules are authored.",
    evidence: [
      {
        path: "packages/core/src/test-execution-profile.test.ts",
        marker: "[ASI-TEST-DEFAULT-OUTCOME]",
        cases: 1,
      },
    ],
  },
] as const satisfies readonly QtiInformationModelRequirement[];
