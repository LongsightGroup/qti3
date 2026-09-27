# Test execution acceptance review

Reviewed against the pinned September 2024 [QTI 3.0.1 ASI information model](https://www.imsglobal.org/sites/default/files/spec/qti/v3/info/imsqti_asi_v3p0p1_infomodel_v1p0.html)
and the corresponding official schema. This review covers XML accepted by `parseQtiTest` and
`parseQtiTestExecution`. Package interchange is a separate capability; preserving a test's XML
or metadata does not authorize its execution.

## Findings and corrections

The classifier previously returned `fixed` before validating tests without routing or processing
instructions. The following schema-valid inputs reached that path despite being outside the runtime:

| Authored feature                             | Relevant clauses | Current execution disposition                                                    |
| -------------------------------------------- | ---------------- | -------------------------------------------------------------------------------- |
| Multiple test parts                          | §4.4             | Reject with `test.mode`; the runtime owns one part                               |
| Nonlinear navigation                         | §5.159           | Reject with `test.mode`; the runtime advances a single forward frontier          |
| Simultaneous submission                      | §5.159           | Reject with `test.mode`; submissions process one item at a time                  |
| Nested sections                              | §4.2             | Reject with `test.xml.unsupported`; the runtime owns flat sections               |
| External section references                  | §7.5             | Reject with `test.xml.unsupported`; execution does not resolve section documents |
| Invisible sections / `keep-together="false"` | §4.2             | Reject outside the visible, contiguous section profile                           |
| Item-reference weights                       | §7.50            | Reject; authored weights must not disappear from score semantics                 |
| Item-reference variable mappings             | §7.48            | Reject; aliases must not disappear during outcome aggregation                    |
| Item-reference template defaults             | §5.152           | Reject; execution does not instantiate referenced items with these overrides     |

The correction removes the classifier's separate XML feature scan. Both public entry points now
use the same closed-profile parsing and validation. Classification happens only after that
validation succeeds, so adding an unsupported attribute or child cannot bypass validation merely
because the document has no branches.

Two neighboring gaps were also corrected:

- Declared outcome defaults now select the outcome runtime even without outcome-processing rules.
  The regression preserves `TOTAL=7` after an item score of `3.5`; it does not invent summation.
- Root diagnostics survive a simultaneous part-mode failure. Returning the mode error previously
  discarded errors already collected for the root.

Selection and ordering were already rejected when they triggered the old runtime path. They remain
rejected and are included as controls. Foreign extension elements now receive the general unsupported
XML diagnostic; they are not interpreted as QTI elements or silently accepted for execution.

## Supported boundary

The accepted execution profile remains deliberately narrow:

| Accepted data                                     | Consumer or restriction                                                                       |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Test identifier and title                         | Validated test definition and session identity                                                |
| Test tool name/version                            | Recognized provenance metadata; not an execution instruction                                  |
| One part identifier, `linear`, `individual`       | Part identity and the single-item submission state machine                                    |
| Section identifier and title                      | Forward branch targets and section metadata                                                   |
| Section `visible="true"` / `"1"`                  | Required by this profile                                                                      |
| Absent or true `keep-together`                    | Contiguous flat sections; no shuffle or reparenting                                           |
| Item-reference identifier and package-local href  | Unique route identity and content reference; repeated hrefs are outside this profile          |
| Item-reference categories                         | Category-based score aggregation                                                              |
| Scalar outcome declarations and optional defaults | Outcome initialization and reset                                                              |
| Supported outcome assignments and expressions     | The closed test expression interpreter                                                        |
| Supported forward section branches                | The next section or `EXIT_TEST` after a section's final item                                  |
| XML namespace declarations                        | Namespace resolution; foreign element/attribute semantics are not inferred                    |
| XML language/schema-location annotations          | Recognized XML metadata; this runtime has no test-content renderer and does not fetch schemas |

Other attributes or children are rejected by the owning container's closed XML check. Test feedback,
rubrics, timing limits, and inherited session controls retain their specific unsupported-delivery
diagnostics. Empty structures, missing required data, duplicate identifiers, unsafe hrefs, invalid
expressions, and invalid branch targets must also pass the common validator before classification.

## Evidence and limits

`test-execution-profile.test.ts` covers both public entry points, the supported route's actual
submissions, default outcomes, malformed-input controls, namespace/attribute extensions, and retained
diagnostics. The independent XML fixtures under `tests/fixtures/test-profile` are also validated by
`pnpm check:test-xsd`. Restoring the previous parser makes 30 of the 33 new cases fail; the supported
route and existing selection/ordering rejections remain passing controls.

This closes the recorded **fixed-versus-sequenced acceptance bypass** review for the declared
profile. It does not implement the rejected QTI features, replace runtime XSD validation, or claim
that every ASI clause or processing algorithm has been audited. The larger inventory continues to
report headings with no reviewed requirement. Browser presentation and external item loading remain
separate boundaries with their own evidence.
