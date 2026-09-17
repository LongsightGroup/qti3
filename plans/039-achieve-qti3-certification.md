# Plan 039: Achieve QTI 3 certification

Status: IN PROGRESS. Approved on 2026-09-17. Written against `ca5419b` on
`codex-qti-correctness-fixes`; package version `0.10.6`.

The outcome is a certification decision from 1EdTech for a named product, version,
level, and capability. Passing local tests is a prerequisite and evidence source.
It is not the certification decision.

## Recommended first submission

Target **QTI 3 Basic IMPORT — Item Only Packages**, using the applicable QTI 3.0.1
requirements and the version accepted by the current certification process.
Confirm this precise scope with 1EdTech before making a formal claim. This is the
shortest evidenced route from the current implementation; it does not cap future
conformance work at Basic.

Keep Basic IMPORT — Tests with Item Packages as the next scope candidate: a
four-row test-structure runner exists, but it needs the same completeness and
preservation review. Plan EXPORT, Advanced, and Delivery as explicit extensions
with their own acceptance maps. Do not silently bundle them into the first claim.

The user approved this first scope on 2026-09-17. Formal acceptance of the product
and submission scope by 1EdTech remains part of CERT-01.

The public certification specification distinguishes import test-case evidence
from validation of exported content. A successful content-validator report does
not establish that our importer preserves data. Conversely, writing a report
parser is not automatically a prerequisite to the first IMPORT submission.
See [the official conformance requirements, §§2.2 and 4](https://www.imsglobal.org/spec/qti/v3p0/conf/).

## Current evidence and remaining gaps

### Execution record — 2026-09-17

The first implementation pass completed CERT-02, CERT-03, and CERT-05 for the
selected item-only scope. CERT-04 tooling is implemented and has passed locally.
CERT-01 still needs confirmation of the submission contract, and CERT-06 remains
a draft until those external questions are resolved. Its clean-checkout rehearsal
passed at `8ff1a34`: 2,241 unit tests, 532 browser tests, schema checks, all required
official cases, and reproducible saved-report verification, with no skipped tests.
CERT-07 has not started.

- The acceptance crosswalk preserves all 69 physical worksheet rows, including
  repeated IDs and explicit aliases. All 69 rows pass across 70 executable cases.
  A synthetic supplement proves the expected-length requirement absent from its
  official text-entry fixture. These interpretations remain visible for official review.
- Import evidence now compares exact values from the returned package item models,
  keeps image descriptions associated with their images, and compares imported
  asset bytes with the source resources. Negative controls detect lost or changed data.
- Actual member-validator runs exposed missing manifest metadata and organizations
  in the package writer. Those defects and LOM title round-tripping are fixed.
  A corrected synthetic ZIP passed the official validator's 12 checks with no errors,
  warnings, exceptions, or unrun checks. This establishes content validation only.
- C16 now accepts a matching passing Qti30Inspector JSON report with explicit
  operator-attested capture provenance and artifact binding. Genuine failed evidence
  is rejected. The supported report format does not attest a certification profile
  or independently authenticate its origin.
- Reports record actual revisions, checklist/input/runtime hashes, and clean-source
  status. A saved report must match a fresh full run. The full local gate at
  `fa164d7` passed, including 532 browser tests and the saved-report comparison.
- Certification checks run locally with private inputs and evidence storage. Public
  GitHub Actions runs synthetic tests, browser checks, and release validation. Any
  future recurring certification automation belongs in private CI.

Detailed member instructions returned Access Denied after authentication. Current
checklist acceptance, the library/CLI demonstration, and the alias/supplement
interpretations need 1EdTech confirmation. Account details, original reports, the
completed checklist draft, and submission correspondence belong outside this repository.

### Baseline before implementation

| Evidence at `ca5419b`                                                       | What it establishes                                                                                        | What it does not establish                                                           |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `pnpm verify`: 2,195 tests passed; full browser suite: 532 passed           | Current automated regression baseline, including required external fixture tests in the recorded local run | Complete coverage of an official certification checklist                             |
| `basicImportItemOnlyCriteria`: 69 executable cases                          | An existing Basic item import evidence runner                                                              | A one-to-one reconciliation with every applicable official criterion                 |
| `basicImportTestCriteria`: four cases                                       | Import evidence for one T4/T7 test-structure package                                                       | Complete test-package certification or full test delivery                            |
| Official conformance checkout at `b058156e3d7c7bcc45e18b1c5cb334d8e556c5e2` | Local access to fixture packages and IMPORT, EXPORT, and Delivery checklists                               | Confirmation that this revision is the one currently accepted for submission         |
| C01–C16 fixes and C10/C15 follow-ups                                        | Correctness improvements and regression tests                                                              | External approval or a completed validator integration                               |
| C16 attachment handling                                                     | Arbitrary files cannot masquerade as passing validator evidence                                            | Parsing, scope matching, provenance checking, or a successful required-evidence path |

The current IMPORT workbook has 69 criterion-bearing rows on `Basic IMPORT Items`,
but only 66 distinct AC ID strings. Several choice IDs are repeated; some IDs are
spelled differently from our internal IDs. Our runner also contains extra negative
cases. Equal row counts are therefore not proof of completeness. Preserve workbook
revision, sheet, row, section, and original ID when reconciling requirements.

Other concrete gaps to address:

- `packages/conformance/src/basic-import-items.ts:evidenceDiagnosticFor` checks
  presence for some fields. Its alt-text and fixed-template checks search the
  input XML, which does not prove preservation in the imported representation.
- `packages/conformance/src/basic-import-tests.ts:evidenceDiagnosticFor` checks
  several strings for nonempty values, rather than their expected values.
- `packages/conformance/src/basic.ts` explicitly reports internal readiness, but
  its local Basic feature list includes additional features such as Q-13, I-17,
  and I-18. This list must not become the official checklist by accident.
- Both import runners advertise a hard-coded conformance source revision; neither
  proves that the supplied files actually came from that revision.
- `.github/workflows/ci.yml` runs `release:check`, which does not require the
  member conformance checkout. There is no dedicated official-evidence workflow.
- The final Certification paragraph in `README.md` says validator evidence is
  required; the command and earlier README instructions do not enforce that.

These are evidence and workflow gaps. They do not establish that every underlying
feature is defective. Strengthen the proof, then fix the implementation wherever
that stronger proof finds a failure.

## Execution order

Use these IDs in commits and discussions. Size is a work estimate, not a promised
certification date; external review has a separate schedule.

| ID      | Deliverable                                                   | Owner                            | Depends on                                           | Size                      | Exit gate                                                             |
| ------- | ------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------- | ------------------------- | --------------------------------------------------------------------- |
| CERT-01 | Confirm product, scope, current checklist, and member access  | Maintainer + engineer            | None                                                 | S + external response     | Submission target and applicable materials recorded                   |
| CERT-02 | Reconcile every applicable checklist row with evidence        | Engineer                         | Current local materials; finalize after CERT-01      | M                         | Zero unexplained unmapped rows                                        |
| CERT-03 | Prove preservation and rejection through the real import path | Engineer                         | CERT-02                                              | L, based on failures      | Every mapped requirement has observable passing evidence              |
| CERT-04 | Produce reproducible reports in a dedicated certification run | Engineer                         | CERT-02; complete with CERT-03                       | M                         | Complete report bound to exact code, packages, and checklist          |
| CERT-05 | Complete the official-validator evidence path, including C16  | Engineer + member account holder | Real output contract from CERT-01                    | M + access                | Genuine scoped success can pass; invalid or unrelated evidence cannot |
| CERT-06 | Build and rehearse the submission dossier                     | Engineer + maintainer            | CERT-01–04; CERT-05 when required for selected scope | M                         | Checklist, evidence, and demonstration are submission-ready           |
| CERT-07 | Submit, resolve reviewer findings, obtain the decision        | Authorized maintainer + engineer | CERT-06                                              | External response + fixes | 1EdTech approval for the recorded scope                               |

Start CERT-01 access work and CERT-02 local reconciliation together. Do not suspend
all engineering while waiting for a member portal or a clarification. CERT-05 is
tracked work; an access dependency must identify the missing material and the next
action. It must not become an indefinite “documented limitation.”

## CERT-01 — Establish the submission contract

1. Confirm the certifying organization, member account access, product name, tested
   version, and submission contact. Confirm whether 1EdTech accepts the library/CLI
   distribution as the product or requires a named reference application exercising
   it. Use the real public import APIs in either case.
2. Obtain the current member instructions and confirm which checklist revision,
   QTI version, capabilities, demonstrations, and artifacts apply to the first
   submission. Start with the locally available checklist; compare updates explicitly.
3. Confirm the boundaries of Item Only Packages, including the treatment of test
   resources bundled with item fixtures. Get written clarification for contradictory
   or ambiguous checklist rows; do not quietly delete them.
4. Check access to the official validator now. Obtain its supported report/output
   contract and representative successful, unsuccessful, and incomplete reports.
   Confirm whether a supported local runner or API is available. Do not invent one.
5. Record any registration, submission, or renewal steps from the current member
   instructions. Keep account information and correspondence outside this repo.

**Output:** an external submission-target record containing product/version,
capability/level, applicable checklist revision and hashes, required evidence,
account-holder responsibilities, and unresolved questions with owners.

**Verify:** every field has a source or is explicitly unresolved. No unresolved
scope question may be silently converted into an exemption. Approval review of the
target is a human gate; a test command cannot establish it.

## CERT-02 — Build the acceptance crosswalk

Work in `packages/conformance/src/basic-import-items.ts`,
`basic-import-tests.ts`, their tests, and new focused acceptance-map modules.

1. Inspect every applicable acceptance row and its referenced feature details.
   Keep the licensed workbooks outside the repo. Use the local IMPORT workbook as
   the starting point, including `Basic IMPORT Items`, relevant feature details,
   and `Basic IMPORT Tests` only when that scope is selected.
2. Give each row a stable internal key derived from checklist revision, sheet,
   row/section, and original AC ID. Keep aliases explicit: repeated choice IDs,
   the extended-text ID spelling differences, and `T4-L1I1` must not collapse or
   disappear when matching our current normalized IDs.
3. Map each row to its official fixture(s), manifest resource(s), expected imported
   values/relationships, public API path, test, and report evidence. Keep additional
   regression tests separate from required certification rows.
4. Classify each applicable row as `missing`, `failing`, or `passed`. A proposed
   exclusion needs an applicability reason and, where ambiguous, official clarification.
   Distinguish automated evidence from a required human demonstration.
5. Add an automated coverage check. It must fail for missing/duplicate mappings,
   unknown references, empty selections, or a substituted subset presented as a
   complete certification run. The existing `criteria` override can remain useful
   for tests, but a subset report must not claim complete readiness.
6. Keep the internal player-readiness profile separate from the official acceptance
   map. Correct documentation that conflates them.

**Output:** a complete, reviewable row-to-evidence crosswalk and an executable
coverage check. Do not publish licensed checklist text or private evidence without
permission; public test fixtures remain synthetic and MIT-licensed.

**Verify:** focused conformance tests pass; the new coverage check rejects a missing
row, a colliding AC ID, and an empty scope. Every official row has a disposition.
Do not assert “69/69 complete” until this reconciliation is finished.

## CERT-03 — Strengthen the actual import proof and fix failures

1. Exercise the shipped `parseQtiPackage` path through the conformance adapter and
   the CLI, using official ZIPs, manifest relationships, and assets. A loose XML parse
   must not stand in for a requirement about package import.
2. Compare **expected values**, not just field presence: response cardinality,
   min/max choices, choice identifiers and associations, expected length, pattern
   mask, associated validation messages, shared vocabulary, and fixed-template
   identity. Use requirements from CERT-02 to determine the exact assertions.
3. Prove alt text remains attached to the correct image in the imported model, and
   prove template references survive import. A regex that finds them in input XML
   is insufficient. Where preservation uses retained source rather than normalized
   fields, document that public representation and demonstrate retrieval from it.
4. Preserve the required package resources and references through the product's
   actual storage/retrieval boundary. For a library, document the returned data and
   the host's storage responsibility; confirm the proposed demonstration is accepted.
   Do not invent a database solely to make a certification test pass.
5. Verify that intentionally invalid official fixtures produce the expected typed
   diagnostics while valid fixtures succeed. Invalid samples are positive tests of
   rejection; do not require the entire official corpus to validate as valid content.
6. Strengthen test-structure assertions if that scope is selected: exact test/part/
   section data, item references, resource resolution, and preservation. This does
   not authorize implementing a full assessment-test delivery runtime.
7. Add focused negative controls to the evidence assertions: an imported result
   missing a required field or carrying the wrong value must fail the relevant row.
   Test pure comparison functions with plain data and the full runner through real
   public APIs. Do not mock the parser and then treat that as integration proof.
8. Fix each confirmed implementation deficiency separately, add its regression,
   update support metadata, and commit with the associated CERT/AC ID. Preserve
   the existing one-fix-per-commit practice.

**Verify:** all applicable rows pass, every named preservation assertion has a
negative control, and the documented import/retrieval demonstration reproduces the
same result on the candidate build. Run focused Vitest tests after each change;
run `pnpm verify` and affected Playwright suites before accepting the workstream.

## CERT-04 — Make certification runs complete and reproducible

Extend the conformance report and CLI, with `pnpm certification:check` as the local
entry point. Match existing typed diagnostics and CLI exit code conventions in
`packages/cli/src/commands/certification.ts` and `packages/cli/test/support.test.ts`.

1. Record the actual qti3 commit/version, conformance checkout commit, workbook and
   package SHA-256 values, selected scope, execution time, environment, and row results.
   Check the checkout and bytes; replace the unverified hard-coded source label.
2. Emit a structured report and a readable summary with explicit required,
   exercised, passed, failed, missing, and human-evidence-pending counts. A green
   subset must remain visibly a subset. Empty input must fail a certification run.
3. Add a report completeness check that binds results to the expected crosswalk and
   rejects stale or mismatched inputs. Preserve expected and actual observations for
   failures, with identifiers that can be traced back to the checklist.
4. Run the official corpus in a member-authorized environment. Keep restricted ZIPs,
   raw reports, workbook copies, and screenshots in external/private artifact storage;
   do not attach them to publicly downloadable CI artifacts. Ordinary public CI can
   continue to use synthetic fixtures. Member credentials must not reach untrusted PRs.
5. Make `pnpm certification:check` fail when official inputs are missing.
   Retain useful reports even when tests fail. Keep the publishing workflow's existing
   responsibility intact; a green release build must not acquire a certification label.
6. Correct `README.md` and package documentation to describe the gates actually run,
   including whether validator evidence is applicable and required for this scope.

**Verify:** run the full candidate gate against the pinned official inputs; then
prove the report checker rejects a changed package hash, a missing row, an empty
selection, and mismatched checklist metadata. Repeating a run on unchanged inputs
must reproduce the requirement outcomes; timestamps need not be identical.

## CERT-05 — Complete C16 using real official evidence

This workstream replaces the unconditional failure in
`basic-import-items.ts` when `requireValidatorEvidence` is true. Keep import proof
and content-validation proof distinct. Make requiredness depend on the selected
certification scope and current official instructions, not on convenience.

1. Select one supported official report format after inspecting actual output.
   Record its schema/version or documented structure. Do not assume JSON, infer
   a verdict from filenames, or introduce a generic `{ "ok": true }` certificate.
2. Implement a bounded parser in the conformance package. Extract the verdict,
   errors/warnings, validator/QTI version, profile, and covered artifacts to the extent
   the official format supplies them. Return typed missing, unsupported-format,
   malformed, failed, and successful outcomes.
3. Record provenance separately from parsed content. Prefer capture by a supported
   official runner/API; otherwise define an explicit trusted manual-capture procedure
   using the member tool. Capture the submitted bytes and hashes at run time and bind
   the returned report to that run. A hash computed after the fact does not prove what
   the validator saw. Parsing alone must not imply authenticated origin.
4. Check that evidence covers the requested artifacts, QTI version, and profile.
   Keep official validation of emitted content distinct from our import/rejection
   tests. Define how errors and warnings affect the verdict from the official rules.
5. Make `requireValidatorEvidence` succeed for accepted, correctly scoped passing
   evidence and fail with a specific diagnostic for each other condition. Wire the
   policy consistently through CLI and the local certification commands. A passing report
   must never override a failed importer acceptance row.
6. Add a genuine successful external integration run, plus tests for failed verdict,
   malformed report, partial coverage, wrong version/profile/package, changed content,
   unsupported format, and untrusted provenance. Use authorized scrubbed or synthetic
   format fixtures for public tests; retain original reports outside the repo.

**Verify:** a real successful validation run can make the required-evidence gate
green for its exact content and scope; each mismatch fails. Record the supported
format and trust boundary in `packages/conformance/README.md`.

If member access is unavailable, continue CERT-02–04 and prepare the typed evidence
contract and failure tests. Do not claim the parser or successful integration complete
until actual reports have been exercised. A documented, accepted manual evidence path
may satisfy submission even when automated collection is unavailable; label its role
accurately rather than inventing an API.

## CERT-06 — Assemble and rehearse the submission

1. Freeze the candidate commit and package artifacts. Run the complete certification
   gate on that exact build. Capture reports externally with the artifact manifest.
2. Complete a copy of the official checklist with actual results and references to
   evidence. Preserve the original row IDs and document any agreed aliases or exclusions.
3. Include product/version and capability statement, coverage report, build/input
   manifest, import preservation and invalid-input evidence, relevant logs, and any
   validator reports required by the selected scope. Add demonstration instructions
   and browser/accessibility evidence where requested by the current checklist.
4. Rehearse from a clean checkout using the published commands and the same inputs.
   Have a reviewer follow the evidence links without relying on this conversation.
5. Draft the submission message and assemble the exact attachments for maintainer
   review. Keep the dossier and contact details outside the repository.

**Verify:** every applicable acceptance row resolves to evidence for the frozen
candidate; no required result is missing, failing, stale, or pending; all required
human demonstrations are recorded. A maintainer signs off the actual submission
package. This plan does not authorize sending a message or uploading private content.

## CERT-07 — Obtain the certification decision

The authorized maintainer submits the completed checklist and supporting evidence
through the current member process. Official results are reviewed by 1EdTech;
record the receipt, review findings, and final decision in external records.
See [the official submission process](https://www.1edtech.org/certification/qti).

Address each reviewer finding with a focused fix and regression, rerun affected
evidence, and refresh the frozen submission manifest before resubmission. Do not
mix evidence from different candidate builds without explaining the relationship.

**Done:** 1EdTech has approved the named product/version/scope, and the registration
or directory record has been checked. Only then update certification claims in
public documentation. Record renewal obligations and the owner of that process.
The engineering work can be submission-ready before this external decision exists.

## Commands and implementation boundaries

Run commands from the qti3 repository root. These commands exist today; newly
introduced crosswalk/report checks must document their final invocation when added.

| Purpose                         | Command                                                                                                                                                                 | Expected result                                                    |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Drift check                     | `git diff --stat ca5419b..HEAD -- packages/conformance packages/cli packages/core packages/player packages/writer tests/browser scripts .github README.md package.json` | Inspect relevant changes before applying the plan                  |
| Focused importer evidence tests | `pnpm exec vitest run packages/conformance/src/basic-import-items.test.ts packages/conformance/src/basic-import-tests.test.ts packages/cli/test/support.test.ts`        | All pass                                                           |
| Minimum local gate              | `pnpm verify`                                                                                                                                                           | Exit 0; no format, type, lint, dependency, build, or test failures |
| Required official content       | `QTI3_EXTERNAL_QTI_DIR=/Users/samo/dev/assessor/qti-conformance/qti3.0 pnpm test:external:required`                                                                     | Runs official cases; missing input fails                           |
| Item import report              | `node packages/cli/dist/index.js certification import-basic-items --qti-root /Users/samo/dev/assessor/qti-conformance/qti3.0`                                           | Structured row results; no failed applicable row                   |
| Test import report, if selected | `node packages/cli/dist/index.js certification import-basic-tests --qti-root /Users/samo/dev/assessor/qti-conformance/qti3.0`                                           | Structured test-package results                                    |
| Final candidate gate            | `QTI3_EXTERNAL_QTI_DIR=/Users/samo/dev/assessor/qti-conformance/qti3.0 pnpm certification:check`                                                                        | Exit 0; official tests plus full release checks                    |

Build before using the CLI after source changes. Certification scripts must invoke
new completeness and evidence-policy checks after they are implemented; the current
commands alone do not enforce every exit criterion in this plan.

Primary implementation scope: `packages/conformance`, certification and evidence
commands/tests in `packages/cli`, relevant documentation, `package.json`, focused
scripts, and local certification commands. Modify core/player/writer behavior only for
a demonstrated applicable requirement, with regression and support metadata.
Follow `basic-import-items.test.ts` for real temporary-file tests and typed report
assertions; use `packages/cli/test/cli-harness.ts` for CLI behavior.

Keep TypeScript/ESM, Node 22+, pnpm, DOM-free Vitest, and Playwright for DOM behavior.
Core and CLI retain zero third-party runtime dependencies. Offline schema checks
are allowed evidence tooling; runtime XSD validation remains outside the product.

Do not add a full test delivery shell, migrate unrelated modules, implement deprecated
elements, or count legacy QTI transcoder validation as QTI 3 export certification.
Use `codex-` branch names if a new branch is needed. Commit each confirmed deficiency
separately, naming its CERT/AC reference. Do not push, tag, publish, or send a submission
without the applicable instruction. CI remains responsible for release publishing.

Stop the affected step and report the concrete dependency if the accepted certification
scope conflicts with product boundaries, official materials contradict each other,
report parsing requires an undocumented format, or evidence would require publishing
restricted content. Continue independent steps that do not depend on that decision.

## Remaining execution

1. Restore access to the detailed member instructions and obtain confirmation of
   the applicable checklist, product boundary, and documented aliases/supplement.
2. Run the local certification commands against the final committed candidate and
   retain evidence privately. Consider private CI only if recurring collection is needed.
3. Have the maintainer approve the private checklist, reports, artifact manifest,
   and demonstration instructions, then submit through the accepted
   member process and address official review findings under CERT-07.

An official approval date cannot be promised from the local test count.

## Sources and limitations

- [Public QTI 3 conformance requirements](https://www.imsglobal.org/spec/qti/v3p0/conf/).
- [Official certification process](https://www.1edtech.org/certification/qti).
- [Member certification entry point](https://www.1edtech.org/standards/qti/conformance).
- Local official workbooks in the external `qti-conformance/qti3.0` checkout:
  `QTI 3 IMPORT Certification Checklist.xlsx`, `QTI 3 EXPORT Certification Checklist.xlsx`,
  and `QTI 3 Delivery Certification Checklist.xlsx`. Workbook revision and cell
  references belong in the external crosswalk, not copied member content in this repo.

The original planning pass inspected the evidence runners, CLI paths, workflow, documentation,
and local checklist structure. It did not audit every Advanced/Delivery acceptance
criterion, obtain authenticated validator output, or rerun the release gate. The
automated baseline above comes from the completed verification at `ca5419b`.
The execution record describes the subsequent implementation and external validator runs.
