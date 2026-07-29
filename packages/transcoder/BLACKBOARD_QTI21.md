# Blackboard Learn question-bank profile

`blackboard-question-banks@1` targets **Manage banks > Import from QTI 2.1 package** in Blackboard
Learn. It does not claim compatibility with a generic course-import path or with Blackboard's
legacy package formats.

## Evidence status

The contract follows Anthology's current
[QTI package guidance](https://help.anthology.com/blackboard/instructor/en/assessments/questions/reuse-questions/qti-packages.html).
Anthology documents QTI 2.1 question-bank imports and identifies multiple choice, true/false,
fill-in-the-blank, and essay as supported question types. Blackboard imports true/false as multiple
choice.

A live Blackboard import has not been recorded. The profile therefore sets
`vendorEvidence.compatibility.productImport` to `unverified`. Do not describe the profile as
product-verified until a reviewed import receipt identifies the Blackboard version and records the
result for every fixture.

## Package contract

The profile emits an IMS Content Packaging archive with:

- QTI 2.1 assessment items;
- `imsqti_item_xmlv2p1` resources;
- a QTI 2.1 assessment-test resource when the source package contains an assessment test;
- explicit item, asset, and assessment-test dependencies; and
- the standard qti3 conversion report.

## Mapping policy

The profile emits `choiceInteraction`, `textEntryInteraction`, and `extendedTextInteraction`
natively. The profile removes optional QTI response processing from every item because Anthology
documents that Blackboard skips items that contain it. The report therefore marks otherwise
automatic mappings as unscored until a live import verifies the scoring behavior created by
Blackboard.

The profile converts every other interaction to `extendedTextInteraction`. The written-response
prompt keeps the source prompt, visible source options, and available text alternatives. The
conversion report marks the mapping as `lossy`, sets scoring to `manual`, and includes a stable
diagnostic.

This policy prefers a reviewable question over a package that Blackboard may skip or reinterpret.
The author must review and approve the fallback in Qflow preflight.

## Synthetic package evidence

The package tests build a two-item assessment from the MIT-licensed synthetic `choice-reference`
and `order-reference` QTI 3 fixtures. The choice item remains native. The order item becomes a
manual written response with all four source options visible. Tests inspect the QTI 2.1 manifest,
item XML, mappings, diagnostics, and deterministic package output.

Record a live import at
`packages/transcoder/evidence/vendor-import/blackboard-question-banks@1-import.json` only after the
product run occurs.
