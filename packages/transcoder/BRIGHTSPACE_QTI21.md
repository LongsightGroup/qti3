# Brightspace course-import profile

`brightspace-course-import@1` targets the QTI 2.1 path under **Course Admin > Import/Export/Copy
Components** in Brightspace. It does not claim that Brightspace's direct quiz-upload path accepts
the same package.

## Evidence status

D2L documents QTI 2.1 import for quizzes and question banks in its
[Question Library guidance](https://community.d2l.com/brightspace/kb/articles/5040-delete-and-copy-questions-from-question-library-in-a-quiz).
D2L also documents the course-level import flow and its import log in
[Import, export, or copy course components](https://community.d2l.com/brightspace/kb/articles/16788-import-export-or-copy-course-components).

D2L's public documentation does not define a complete QTI 2.1 interaction matrix. Version 1 of
this profile therefore keeps only choice, text-entry, and extended-text interactions native. It
uses a visible manual fallback for every other interaction.

A live Brightspace import has not been recorded. The profile therefore sets
`vendorEvidence.compatibility.productImport` to `unverified`. Do not describe the profile as
product-verified until a reviewed receipt identifies the Brightspace release and includes the
import log.

## Package contract

The profile emits an IMS Content Packaging archive with:

- QTI 2.1 assessment items;
- `imsqti_item_xmlv2p1` resources;
- a QTI 2.1 assessment-test resource when the source package contains an assessment test;
- explicit item, asset, and assessment-test dependencies; and
- the standard qti3 conversion report.

## Mapping policy

The profile emits `choiceInteraction`, `textEntryInteraction`, and `extendedTextInteraction`
natively.

The profile converts every other interaction to `extendedTextInteraction`. The written-response
prompt keeps the source prompt, visible source options, and available text alternatives. The
conversion report marks the mapping as `lossy`, sets scoring to `manual`, and includes a stable
diagnostic. If an item contains a manual fallback, the serializer removes automatic response
processing for that item.

QFlow preflight must show and approve the fallback before export.

## Synthetic package evidence

The package tests build a two-item assessment from the MIT-licensed synthetic `choice-reference`
and `order-reference` QTI 3 fixtures. The choice item remains native. The order item becomes a
manual written response with all four source options visible. Tests inspect the QTI 2.1 manifest,
item XML, mappings, diagnostics, and deterministic package output.

Record a live import at
`packages/transcoder/evidence/vendor-import/brightspace-course-import@1-import.json` only after the
product run occurs.
