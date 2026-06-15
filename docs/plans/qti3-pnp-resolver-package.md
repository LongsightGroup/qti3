# QTI 3 PNP Resolver Package

## Decision

Add `@longsightgroup/qti3-pnp` as an optional, dependency-free TypeScript package that
resolves host-supplied QTI 3 Personal Needs and Preferences data into player-neutral
delivery intents and diagnostics.

## Boundaries

- `@longsightgroup/qti3-core` owns QTI content, scoring, catalog metadata, and session
  state semantics.
- `@longsightgroup/qti3-pnp` owns PNP parse, normalization, profile-aware validation,
  capability/catalog resolution, extension preservation, and safe diagnostics.
- The host/LMS/runner owns identity, authorization, consent, storage, audit, launch
  context, timers, secure-tool policy, and final enforcement.

## Non-Goals

This runtime package does not implement AfA PNP REST service access, LTI connector flows,
candidate record persistence, LMS user lookup, institutional accommodation policy, or
official 1EdTech conformance claims. Official schemas and conformance materials belong in
development and certification workflows, not the dependency-free runtime resolver.
