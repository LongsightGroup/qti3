# Moodle XML profile

`moodle-xml@1` targets Moodle's first-party question-bank XML importer. It does not claim that
Moodle natively imports QTI: current Moodle core has no QTI question-format plugin.

## Evidence baseline

The profile is pinned to
[`moodle/moodle@dd5063e`](https://github.com/moodle/moodle/tree/dd5063e52685f2b77e147619bbdbc75663b36097/public/question/format/xml):

- `format.php` owns the Moodle XML import and export contract;
- Moodle's import/export tests exercise the supported core question types; and
- the committed Moodle fixtures establish multichoice, cloze, feedback, and embedded-file shapes.

## Mapping policy

The profile uses Moodle's native core question types where the response remains usable:

- choice and labeled choice fallbacks become `multichoice`;
- text entry becomes `shortanswer`;
- slider becomes `numerical`;
- match becomes `matching`;
- order and graphic order become matching rows for sequence positions;
- extended text becomes `essay`; and
- upload becomes an essay with one required attachment.

Interactions without a safe core Moodle representation become essay questions with visible,
learner-facing instructions and manual grading. Multiple interactions in one QTI item currently
become one composite essay so Moodle does not silently discard any response part.

Package conversion emits `moodle_questions.xml`, not an IMS manifest. Referenced package assets are
rewritten to `@@PLUGINFILE@@` URLs and embedded as base64 Moodle `<file>` nodes. The deterministic
ZIP returned by the package API is an archive envelope; `moodle_questions.xml` is the artifact to
import in Moodle.

Moodle XML is not QTI and has no applicable IMS QTI XSD or QTI reverse-migration check. Those gates
are explicitly marked not applicable instead of being reported as false passes.

## Product compatibility evidence

A real import run may be recorded at
`packages/transcoder/evidence/vendor-import/moodle-xml@1-import.json`. Do not create a receipt until
the product run has occurred. Import receipts are useful compatibility evidence, but
`release:check` does not require them.
