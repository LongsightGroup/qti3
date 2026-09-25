# Spec regression tests

A passing round trip can preserve the same mistake on both sides. Conformance regressions
must establish the expected behavior independently of the implementation being tested.

For each changed rule:

1. Cite the specification section or official algorithm beside the test. Use synthetic,
   MIT-licensed inputs. Do not copy private certification fixtures into the repository.
2. State the expected grades, values, or DOM semantics explicitly. Do not derive expected
   results using the writer, parser, or processing helper under test.
3. Parse **and validate** positive XML fixtures before scoring. A parsed document alone
   does not establish that the item is valid. Keep intentionally invalid inputs in separate
   diagnostic tests.
4. Exercise the public path: XML to session outcomes, source XML to migration to outcomes,
   or XML to browser DOM. Test helpers must not bypass the contract being claimed.
5. Cover the semantic boundaries: unanswered values, empty strings/containers, equivalent
   lexical forms, significant whitespace, collection cardinalities, and positive/negative
   controls. Preserve cases that must remain distinct, such as directed pairs.
6. Verify that removing the behavior change makes the new regression fail. A failure caused
   only by malformed fixture XML is not regression evidence.

For built-in processing templates, compare the optimized dispatch with an explicit expression
of the published algorithm **and** fixed expected outcomes. This catches both drift between
the paths and shared mistakes in their operator implementations.

For migration, an interaction-shape assertion is insufficient. Verify the source scoring
truth table against migrated outcomes, or require an error diagnostic and no successful item.
Unsupported source programs must remain rejected when safe repair is enabled. When narrowing
support, retain rejection coverage for the formerly accepted source; do not simply rewrite it
into a supported example.

For browser substitutions, assert element names, namespaces, and unaffected content as well as
text. Text-only assertions cannot distinguish a MathML identifier from a numeric token.

Examples:

- `packages/core/src/scoring-spec-contracts.test.ts`: QTI 3 NULL and typed mapping semantics;
  standard template algorithms compared with fixed scores.
- `packages/migrator/src/scoring-fidelity.test.ts`: preserved grades or explicit refusal,
  plus significant string whitespace through migration and direct authoring.
- `tests/browser/player-mathml.spec.ts`: MathML token replacement and XML Boolean spellings.

Normative sources: [QTI 3 information model](https://www.imsglobal.org/sites/default/files/spec/qti/v3/info/index.html),
[standard map-response template](https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/map_response.xml),
[QTI 2.1 information model, response processing](https://www.imsglobal.org/question/qtiv2p1/imsqti_infov2p1.html),
and [QTI 1.2 condition and score semantics](https://www.imsglobal.org/node/52326).
