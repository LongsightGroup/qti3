# Plan 040: Reopen imported packages from the reference app's database

## Status

- **Status:** DONE
- **Priority / effort / risk:** P1 / S–M / MED
- **Planned at:** `bdd36aa`, 2026-09-17
- **Related work:** Plan 039; this plan supplies the persistent reference application.

## Outcome

Add a small **Saved packages** page to the existing browser demo. A reviewer can import a
QTI package, close the page, reopen it, and inspect the saved questions and their assets.
The application reads the saved content through the core importer and displays it with the
existing player. This demonstrates an actual database-backed import workflow.

Use the browser's IndexedDB as the reference application's native database. It supports
structured records and binary data without a server or additional runtime dependencies.
The submission should identify this reference application and the qti3 version it uses;
the certification decision remains with 1EdTech.

## Smallest design

```text
ZIP → bounded extraction → core import → one IndexedDB record
                                              ↓
                         reopen → core import → existing player
```

Use one database, version 1, and one object store, `packages`. Each record contains an ID,
display title, original filename, import timestamp, and every decoded package entry as
`{ path, bytes: Uint8Array }`. Preserve the original manifest, XML, metadata, stylesheets,
and media bytes, including entries the renderer does not use. Do not regenerate XML from
the parsed model. ZIP compression details are not application content.

The stored entries are the application's source of truth. Build item models and temporary
asset URLs when opening a record; do not persist object URLs or a second serialized model.
Keep the database code in the demo. Core and CLI need no persistence API or dependencies.

The page needs only **Import package**, a saved-package selector, an item selector,
**Delete package**, the player, and expandable source/diagnostic details. Import includes
saving, clearly stated beside the file input. Display success only after the transaction
commits; open the newly imported package by reading it back from the database.

## Current code and constraints

- `examples/manual/src/main.ts:888` has a browser ZIP reader, including native
  `DecompressionStream("deflate-raw")` support. Its current extraction is unbounded and its
  manifest selection uses separate DOM logic; do not use that selection as the new importer.
- `packages/core/src/qti-package-stream.ts:50` exports
  `parseQtiPackageStream(source, limits)`. Its source is an entry inventory plus asynchronous
  `readEntry(path, maxBytes)`. Item events are provisional until `summary.ok` is true.
  It shares manifest/item parsing with the synchronous package importer.
- `packages/core/src/qti-package-zip.ts` defines existing resource limits and ZIP diagnostics.
  The synchronous inflater callback cannot directly accept a browser decompression stream.
- `tests/browser/player-package.spec.ts` demonstrates ZIP upload, stylesheet, and media
  assertions. `tests/browser/player-helpers.ts` supplies synthetic package builders.
- `examples/manual/vite.config.ts` lists demo build inputs. Root `tsconfig.json` explicitly
  lists typechecked projects; follow `examples/manual/tsconfig.convert.json` for the new page.

Use TypeScript, native browser APIs, and typed failure results. IndexedDB and DOM tests run
in Playwright, never DOM shims. Public test packages must be synthetic and MIT-licensed.

## Implementation, in three commits

### 1. Connect browser package input to the core importer

Extract the existing ZIP-reading functions into
`examples/manual/src/package-library/browser-package.ts`; have the old manual loader use
that extraction helper too, adapting entry names without changing its item-selection policy.
Give the helper explicit entry-count, entry-size, total-size, and compression-ratio budgets
using core defaults. Check archive bounds, supported compression, canonical unique paths,
and actual expanded sizes. Consume decompression chunks with a byte limit and cancel on
overflow; do not use an unbounded `Response(...).arrayBuffer()` expansion.

In the same module, adapt the extracted entries to `QtiPackageSource` and collect item and
summary events. Reject failed imports and expose diagnostics. Preserve every entry on
successful imports, rather than filtering the stored record down to rendered item content.
Reuse this import function when reopening database records.

Create the new page's TypeScript project and root reference now. Add browser coverage in
`tests/browser/package-library.spec.ts` for stored and deflated ZIPs, malformed/over-limit
input, and agreement with `parseQtiPackage` on synthetic item models, metadata, and assets.
The browser ZIP helper is transport code; all QTI interpretation belongs to core.

**Verify:** `pnpm typecheck` and
`pnpm exec playwright test tests/browser/package-library.spec.ts tests/browser/player-package.spec.ts`
both exit 0, with no skipped tests.

### 2. Add the saved-package page

Create `examples/manual/src/package-library/store.ts` with four operations: save, list,
read, delete. Store a whole package atomically. Resolve writes on transaction completion,
handle open/abort/quota failures with typed results, and validate records read from storage.
Keep parsing, decompression, and rendering outside live database transactions.

Create `examples/manual/library.html` and `examples/manual/src/package-library/main.ts`.
Reuse the existing player and manual page styling. Wire the controls described above,
show import and player diagnostics, and provide source inspection for the selected item.
Create asset URLs from saved bytes, resolve references relative to the item path, and revoke
URLs on package changes. Missing package assets must produce a diagnostic instead of
silently falling through to the demo server. Include package-local stylesheet coverage.

Register the page in `examples/manual/vite.config.ts` and link it from
`examples/manual/index.html`. Use native labeled controls and an accessible status region.
Disable conflicting actions while importing so late asynchronous results cannot replace a
new selection. Database failures must never be presented as a successful save.

**Verify:** `pnpm typecheck`, `pnpm pages:build`, and the focused browser command above all
exit 0. An uploaded synthetic package appears in the saved list and opens from its record.

### 3. Prove preservation across a fresh page and document the workflow

Extend `tests/browser/package-library.spec.ts` to prove:

- After import, close the page and create a new page in the same browser context. Select the
  saved package without another upload; all items remain available.
- Every stored entry has exactly the original path and bytes. Reopened item models retain
  declarations, metadata, processing, and content; include fields invisible in the player.
- Reopened questions render and respond, and packaged images/stylesheets load from saved
  bytes. Assert that package content is not fetched from an external host or fixture server.
- Delete survives another reload. A failed import creates no record. A failed or aborted
  write reports failure and leaves existing saved packages usable.
- Import, select, inspect, and delete work by keyboard, with understandable status messages;
  run axe on the new page and assert control names and focus behavior.

Document the workflow in the root README: start the existing demo on a stable local origin,
open `/library.html`, import, close/reopen, and select the saved package. Explain that browser
storage belongs to that browser profile and origin, and can be cleared. Use a normal Chrome
profile for the review. Application offline installation is unnecessary.

**Verify:** `pnpm verify`, `pnpm test:browser`, and `pnpm pages:build` all exit 0.
Record the resulting commit/version, then repeat import → close → reopen with the authorized
external corpus. Inspect the required features from database-restored records and retain
that evidence privately. The existing importer reports alone do not prove persistence.

## Scope and boundaries

Allowed changes: the new `examples/manual/src/package-library/` modules,
`examples/manual/library.html`, `examples/manual/tsconfig.library.json`,
`examples/manual/src/main.ts` (shared extraction only), `examples/manual/index.html`,
`examples/manual/vite.config.ts`, `tsconfig.json`, `tests/browser/package-library.spec.ts`,
`tests/browser/player-package.spec.ts` and `player-helpers.ts` if needed, root README, and
this plan/index. No changes to published package APIs are expected.

This is a local reference application: no backend, accounts, sync, authoring interface,
attempt-state persistence, storage abstraction framework, or additional certification scope.
Keep member packages, worksheets, reports, and completed submission material outside Git.
Describe generic behavior in public documentation without copying member-only instructions.

## Execution and completion

Before implementation, run
`git diff --stat bdd36aa..HEAD -- examples/manual packages/core tests/browser tsconfig.json README.md`
and reconcile relevant changes against the facts above. Make one commit for each numbered
step. Do not publish as part of this plan.

Done means all three steps and their checks pass, a real saved package survives page closure
and reopens without its original input file, and private evidence covers restored content.
Update this plan and its index status after implementation.

If existing public APIs cannot preserve the required data, document that specific gap before
expanding core. If a package depends on a missing renderer feature, report it as a separate
conformance issue; retaining source bytes does not prove visual support. Do not mark the
plan complete while either issue prevents the demonstration.

References: [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API),
[transaction completion](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/complete_event).

## Completion evidence

Completed on 2026-09-17 with qti3 0.10.6. The browser import adapter was committed as
`2520084`; the database-backed page was committed as `d31a90e`. Core and CLI APIs and
runtime dependencies are unchanged.

- Step 1: typecheck and 19 focused browser tests passed.
- Step 2: typecheck, the Pages build, and 22 focused browser tests passed.
- Final gate: `pnpm verify` passed with 159 test files and 2,241 tests; the required
  external-fixture configuration was enabled, with no skips.
- `pnpm test:browser` passed all 544 tests, including 12 synthetic package-library tests.
  The new coverage verifies exact stored bytes and reopened models, responses and assets,
  transaction rollback, invalid records, deletion, keyboard use, axe, 320px reflow, and
  forced-colors focus. `pnpm pages:build` also passed.
- Saved contents were independently compared with the original imports across a full
  browser restart. The restored questions were rendered and inspected; private packages,
  reports, and screenshots remain outside Git.

The README documents browser profile/origin storage and the remaining stylesheet limitation:
relative `url()` and `@import` dependencies inside saved CSS are not rewritten. This does not
prevent the completed demonstration; packages requiring that behavior need separate handling.
Nothing was published as part of this plan.
