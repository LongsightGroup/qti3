# Public manual conversion demos

- **Status:** Accepted
- **Decision date:** 2026-09-16

The public manual's `convert.html` page demonstrates the writer, migrator, and transcoder with
synthetic, MIT-licensed individual-item examples. It imports their public browser-capable entry
points and keeps conversion rules in those packages. Migration uses the migrator's strict defaults
and its existing writer finalization. The page does not use the Node-only transcoder evidence entry
point.

The manual adds workspace dependencies on `qti3-writer`, `qti3-migrator`, and `qti3-transcoder`.
These reuse existing, reviewed dependencies and introduce no new third-party versions. They remain
optional to consumers of the core and player. The core and CLI dependency policies are unchanged.
Vite loads the conversion page through its own entry point, keeping its conversion-specific imports
out of the main manual's entry module.

Inputs and generated output remain in browser memory. Copy and download actions require user
interaction. Individual-item demos do not bundle assets, persist inputs, upload content, or infer
LMS compatibility. The preview blocks external asset, stylesheet, and XML resolution. Diagnostics
are displayed as text beside output; source XML is never injected as application markup. The
writer's prompt is plain text escaped before entering its trusted-fragment API.

Edits clear stale output and previews. Errors disable output actions. The transcoder's mapping
report is available with successful output so visitors can inspect fidelity and scoring decisions.
The initial targets are explicit `qti12-standard@1`, `qti21-standard@1`, and `qti22-standard@1` profiles.
