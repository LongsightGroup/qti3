# Implementation Plans

Audited and reconciled on 2026-08-25 against commit `646dd16`. Every TODO plan listed below is
approved for implementation in its current form. Executors must read the selected plan fully,
honor its stop conditions, and update its status when complete.

## Execution order and status

| Plan | Title                                                                  | Priority | Effort | Depends on        | Status |
| ---- | ---------------------------------------------------------------------- | -------- | ------ | ----------------- | ------ |
| 002  | Give media a core play-count domain and one native playback path       | P1       | M      | —                 | DONE   |
| 020  | Upgrade the vulnerable Vite toolchain and gate dev advisories          | P1       | S      | —                 | DONE   |
| 004  | Validate and drop unsafe interaction asset URLs                        | P1       | M      | —                 | DONE   |
| 007  | Map every matching area at most once across response points            | P1       | S      | —                 | DONE   |
| 003  | Make invalid equal-rounded expressions inert during evaluation         | P1       | S      | —                 | DONE   |
| 019  | Move qti3-fixtures out of player runtime dependencies                  | P1       | S      | —                 | DONE   |
| 009  | Exact decimal rounding for roundTo/equalRounded                        | P2       | M      | —                 | DONE   |
| 005  | Add player session options and preserve them across lifecycle rebuilds | P2       | M      | —                 | DONE   |
| 008  | Keep invalid declaration numbers out of the parsed runtime model       | P2       | M      | —                 | DONE   |
| 014  | Bound repeat expansion in processing                                   | P2       | M      | —                 | DONE   |
| 015  | Validate numeric-operator arity and define empty stats results         | P2       | M      | —                 | DONE   |
| 017  | Separate XML textContent semantics from visible-text flattening        | P2       | M      | —                 | DONE   |
| 018  | Mark modal feedback as rendered in the support matrix                  | P2       | S      | —                 | DONE   |
| 022  | Add characterization tests to the highest-risk migrator seams          | P2       | M      | —                 | DONE   |
| 024  | Capture actionable Playwright failure artifacts with one CI retry      | P2       | S      | 020               | TODO   |
| 026  | Remove duplicate stages from pnpm verify                               | P2       | S      | 020               | TODO   |
| 030  | Consolidate XML escaping with explicit text and attribute APIs         | P2       | M      | —                 | TODO   |
| 037  | Add CLI commands for trusted scoring and candidate-safe delivery XML   | P2       | M      | —                 | TODO   |
| 012  | Require qti-any-n min/max attributes with validation                   | P3       | S      | —                 | TODO   |
| 013  | Diagnose mixed fielded and unfielded declaration values                | P3       | M      | —                 | TODO   |
| 021  | Decide and execute the xmldom 0.9 migration                            | P3       | M      | —                 | TODO   |
| 023  | Split transcoder snapshots without reducing output coverage            | P3       | M      | 022               | TODO   |
| 027  | Test the supported Node version boundaries explicitly                  | P3       | S      | 020, 024          | TODO   |
| 028  | Add an EditorConfig matching repository formatting                     | P3       | S      | —                 | TODO   |
| 029  | Mark delivered design notes and supersede discredited docs             | P3       | S      | —                 | TODO   |
| 032  | Reuse core package-path normalization in the CLI                       | P3       | S      | —                 | TODO   |
| 033  | Split core.test.ts with stable support-evidence paths                  | P3       | L      | correctness plans | TODO   |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (with one-line reason) | REJECTED
(with one-line rationale).

## Coordination notes

- Land 020 before 024, 026, and 027 because all may touch package or CI configuration. Land 024
  before 027 so the Node matrix preserves one intentional browser job.
- Execute 023 after 022 so characterization coverage protects the snapshot reorganization.
- Execute 033 after active core correctness plans to avoid high-conflict test-file moves.
- Plan 021 is a dependency decision with accepted and rejected implementation paths; its ADR is a
  required deliverable even if the upgrade is rejected.
- Plan 030 deliberately adds two small core exports. Treat snapshot changes as review evidence,
  not as output to approve wholesale.

## Audit disposition

Approved without changes: 009, 012, 019, and 029.

Approved after modification: 003, 004, 005, 007, 008, 013, 014, 015, 017, 018, 020, 021, 022,
023, 024, 026, 027, 028, 030, 032, 033, and 037.

Deleted because the repository already had the behavior, the premise was disproved, or the work
was too speculative to retain as an implementation plan: 001, 006, 010, 011, 016, 025, 031, 034,
035, 036, and 038. This includes every plan initially marked for deferral (010, 034, and 035).

Plan 001 had already been completed before this audit; its standalone plan was removed as stale
history. Plan 002 remains as the sole completed plan because it was already tracked and retained.

## Findings considered and rejected

- The hand-written XML parser's entity behavior did not expose an XXE or entity-expansion issue.
- The two `innerHTML` sinks are guarded by an inert-template allowlist walk.
- CLI ZIP inspection is memory-only and rejects package-root escapes.
- Player generation counters already guard stale asynchronous loads.
- Core already rejects protocol-relative asset URLs; plan 004 is limited to the player's broader
  DOM sink policy.
- Browser caching and CI job splitting were removed from plan 026 pending separate timing evidence.
- Pre-commit typechecking was removed from plan 028 because commit-latency policy needs its own
  evidence and decision.
