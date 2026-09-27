# Minimum regression value for tests

A test earns its place by detecting a plausible defect in a project contract. Test count,
assertion count, file size, and line coverage do not establish that value. Apply this bar to
new and materially changed tests, and use it when reviewing existing suites.

## Required evidence

A reviewer must be able to answer all five questions:

1. **What breaks for a caller?** Name an observable result: a grade, diagnostic, accepted or
   rejected input, restored state, rendered behavior, shipped artifact, or public type contract.
2. **What plausible defect does this detect?** State the wrong behavior concretely, such as
   "restoration loses the score" or "a missing translation silently uses its key as its label."
3. **Why is the expected result trustworthy?** Use a cited spec rule, an independently authored
   example, an explicit truth table, or an independently owned artifact. Do not calculate the
   expected value with the implementation being checked.
4. **Does the decisive assertion fail for that defect?** Demonstrate a pre-fix failure or a
   targeted mutation. A compile failure unrelated to the contract, fixture parse failure, or
   test-runner failure is not evidence that a behavioral assertion works. Public type contracts
   are checked by the compiler, including negative examples where appropriate.
5. **Does this protect something the retained tests do not already protect as well?** A distinct
   boundary, input partition, or failure diagnostic can justify another test. A different test
   name or another copy of the same implementation does not.

Record this evidence concisely in the PR. A single explanation can cover a parameterized family
when its rows represent distinct input partitions. Do not add bookkeeping comments to every
assertion or maintain a second catalog of all tests.

## Below the bar

Remove or replace tests that only:

- Assert language/library facts, such as a local variable initialized to `undefined` being
  undefined, or a derived `Set` equaling `new Set` of its own source array.
- Check `typeof exportedFunction === "function"` without exercising the exported behavior.
- Compare one instance of a formatter/parser/helper with another instance of the same code.
- Freeze internal array order, function identity, file placement, or barrel-file spelling where
  the caller contract is routing precedence or rendered output.
- Match English documentation sentences and call that accessibility, scoring, or conformance proof.
- Search source text for `it(` or `expect(` and claim that tests execute meaningful assertions.
- Duplicate a stronger check of the same artifact, input partition, and public boundary.

A round trip alone proves consistency, not correctness. Snapshots protect observable output
changes, but a scoring claim also needs explicit expected scores. Updating a snapshot requires
review of the changed behavior; regeneration is not validation.

## Small tests and reference data

A three-line test can prevent a serious regression. Preserve focused tests for NULL semantics,
cardinality, invalid namespaces, numeric limits, routing precedence, and diagnostic distinctions.
Do not delete them merely because a larger integration test exercises nearby code.

Reference-data checks can qualify when they enforce a meaningful independent invariant:
unique identifiers, complete translations, shipped XML matching its generator, or every supported
interaction having an accessibility contract. They must not simply restate the same constant or
assert prose. Label them as metadata/artifact integrity, not proof of runtime behavior.

## Removing tests

Identify the surviving assertion and its input coverage before deleting a duplicate. For an
important behavior, inject the relevant fault and show that the retained test fails. Keep real
browser assertions when removing Node checks of renderer identity or accessibility prose. Move
type-export checks to a compiler-only suite rather than disguising them as runtime tests.

For each pruning batch, record removed test families, the replacement/retained evidence, and any
unreviewed areas. Fewer tests is not the objective; less maintenance with equal or stronger
regression detection is.

## Enforcement and limits

The PR template requires regression evidence, and review must reject tests below this bar.
`pnpm verify` checks types, tests, and the conformance evidence ledger. `pnpm release:check` also
runs the curated semantic mutation gate, schemas, and browser tests. These gates establish their
stated scopes; they do not automatically determine whether every test has a sound oracle.

See [spec regression testing](spec-regression-testing.md) for QTI-specific expectations and
[semantic testing pilots](semantic-testing.md) for fault injection and generated action sequences.
