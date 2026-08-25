# Plan 029: Mark delivered design notes and supersede discredited docs

> **Executor instructions**: Docs-only plan. Update your status row in
> `plans/README.md` when done.
>
> **Drift check (run first)**: `ls docs/plans/`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `646dd16`, 2026-08-25
- **Status**: DONE, 2026-08-25

The discredited response-processing serialization note now opens with a superseded warning and a
link to the authoritative revision. The revised response serializer and owned XML parser carry
v0.8.0 DELIVERED banners; the PNP resolver carries a v0.9.0 DELIVERED banner. Each banner links to
the changelog and names the live implementation location.

## Why this matters

`docs/plans/issue-12-response-processing-serialization.md` is superseded by the `-revised`
variant, whose opening section says the original's core rule "is wrong and would fail its
own round-trip test" — yet both sit side by side with no marker, so an implementer can
follow the discredited spec. Two other design notes describe work long since delivered
(own XML parser; pnp resolver) with no DONE markers, inviting re-proposals (this audit
nearly did).

## Current state

- `docs/plans/issue-12-response-processing-serialization.md` — original, discredited by
  revised doc's "Critique of the Original Plan" section (~line 7-12).
- `docs/plans/issue-12-response-processing-serialization-revised.md` — authoritative;
  delivered (`serializeResponseProcessing` exported from core index).
- `docs/plans/own-xml-parser-remove-stax-xml.md` — delivered (stax-xml absent from lockfile;
  core parser hand-written).
- `docs/plans/qti3-pnp-resolver-package.md` — delivered (`@longsightgroup/qti3-pnp` shipped).
- Convention precedent: `plans/README.md` tracks DONE statuses in a table.

## Commands you will need

None (docs only). Final gate: `pnpm verify` untouched-behavior sanity.

## Scope

**In scope**:

- The four files under `docs/plans/` listed above

**Out of scope**:

- Deleting git history; rewriting doc content beyond banners/status headers
- `plans/` directory (separate lifecycle)

## Git workflow

- Branch: `advisor/029-design-note-status`
- Commit style: short imperative

## Steps

### Step 1: Banner the superseded doc

Prepend to `issue-12-response-processing-serialization.md`:

```markdown
> **SUPERSEDED — do not implement.** The serialization rule in this plan is wrong and
> would fail its own round-trip test. See issue-12-response-processing-serialization-revised.md
> for the authoritative design (delivered).
```

**Verify**: banner is the first content block of the file.

### Step 2: Status-mark delivered docs

Add a status header to each delivered note, mirroring plans/README.md convention:

```markdown
> **Status: DELIVERED** (<CHANGELOG version/link>). Kept for design rationale; behavior now
> lives in <code location>.
```

Fill real locations: own-xml-parser → `packages/core/src/xml.ts`; pnp → `packages/pnp/`;
issue-12 revised → `serializeResponseProcessing` export in `packages/core/src/index.ts`.

**Verify**: all three files carry the header.

## Test plan

None; run `pnpm format:check` (docs may be covered by formatting).

## Done criteria

- [ ] Superseded banner + three DELIVERED headers in place
- [ ] `pnpm format:check` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

None anticipated.

## Maintenance notes

Optionally move delivered notes into `docs/plans/archive/` in a future pass; banners are the
minimum safe step now.
