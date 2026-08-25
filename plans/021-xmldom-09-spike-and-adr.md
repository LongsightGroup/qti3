# Plan 021: Decide and execute the xmldom 0.9 migration

> This is an investigation-first dependency decision. Update `plans/README.md` with the outcome.
>
> **Drift check**: `git diff --stat 646dd16..HEAD -- packages/migrator/package.json packages/transcoder/package.json packages/migrator/src/xml.ts packages/transcoder/src/xml.ts pnpm-lock.yaml`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: migration / dependency decision
- **Planned at**: commit `646dd16`, 2026-08-25

## Why this matters

The registry currently labels xmldom 0.8.x as LTS and 0.9.x as latest, so this is not an emergency
security migration. It is still worth deciding deliberately because migrator/transcoder parse
untrusted legacy XML and serialization changes affect fidelity evidence. The separate hand-written
core XML stack is intentional under the zero-runtime-dependency rule and should be documented.

## Scope and deliverable

Create `docs/decisions/xmldom-and-xml-stack-boundaries.md` (or the repository's established ADR
location if one appears). Record: core owns dependency-free QTI 3 XML; xmldom is confined to legacy
migrator/transcoder dialects; and the tested 0.9 migration outcome. Manifests, lockfile, and adapter
changes are in scope only if the migration is accepted.

## Steps

1. Record `pnpm view @xmldom/xmldom dist-tags --json`, release notes, engine support, and relevant
   security history. Do not call 0.8 unsupported while it is labeled LTS.
2. Upgrade both packages together on the working branch. Restrict code changes to their XML adapter
   modules and mechanically required call sites.
3. Run focused and full tests. Classify every XML/snapshot delta as API-only, lexical serialization,
   or semantic. Accept lexical changes only after proving reparsed models are equivalent.
4. If accepted, retain the upgrade and record it in the ADR. If rejected, restore the two manifests
   and lockfile through a normal patch, record the exact blocker and revisit condition, and mark the
   plan REJECTED rather than BLOCKED.

## Verification and done criteria

- Accepted path: `pnpm verify && pnpm check:transcoder-support` pass with 0.9.x.
- Rejected path: no dependency diff remains and the ADR records reproducible evidence.

## STOP conditions

Stop before changing expected semantic output, weakening parser diagnostics, or modifying core XML.
