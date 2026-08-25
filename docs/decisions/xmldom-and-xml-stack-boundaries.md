# xmldom and XML stack boundaries

- **Status:** Rejected for now
- **Decision date:** 2026-08-25
- **Revisit after:** 2026-08-28 22:33 UTC, or later if the registry changes the release status

## Decision

Keep the lockfile and manifests unchanged at `@xmldom/xmldom` 0.8.13 today. Do not retain the
tested 0.9.11 migration because the publisher marks that version as deprecated with critical
issues. Do not bypass the configured seven-day package-age gate to install 0.9.12.

This is a time-bounded rejection, not a technical rejection of the 0.9 API. Once 0.9.12 passes the
age gate, repeat the documented adapter patch and verification against the then-current registry
state. The repository's locked 0.8.13 is also now publisher-deprecated, so this revisit is urgent
and should not wait for unrelated feature work.

## XML stack ownership

- `qti3-core` owns its dependency-free QTI 3 parser and serializer boundaries. This preserves the
  zero-third-party-runtime-dependency contract for core and keeps normal parse failures in the
  typed diagnostic model.
- `@xmldom/xmldom` is confined to the optional migrator and transcoder packages, where it parses
  legacy QTI, vendor, and Moodle XML dialects and validates or assembles transcoded output.
- The 0.9 migration must not modify core XML behavior or weaken migrator/transcoder diagnostics.

## Registry and upstream evidence

Evidence collected on 2026-08-25:

- `pnpm view @xmldom/xmldom dist-tags --json` reported `lts: 0.8.15` and `latest: 0.9.12`. The 0.8
  line must therefore not be described as unsupported.
- 0.9.12 declares Node `>=14.6`, which is below this repository's Node 22 minimum, and uses the MIT
  license.
- The upstream [0.9 changelog](https://github.com/xmldom/xmldom/blob/master/CHANGELOG.md) documents
  stricter well-formedness handling, a mandatory MIME type, the `onError` API, DOM type changes,
  and recent serializer and parser security fixes.
- The upstream [security policy](https://github.com/xmldom/xmldom/security/policy) aims to maintain
  the latest two pre-1.0 minor lines with security patches.
- `pnpm audit --json` reported no known advisories, but package deprecation metadata independently
  marks 0.8.13, 0.8.14, and 0.9.11 as having critical issues. The non-deprecated 0.8.15 and 0.9.12
  releases were published on 2026-08-21 and were still blocked by the configured 10,080-minute
  minimum release age.

## Migration probe

Both package manifests were temporarily moved to 0.9.11 and the lockfile resolved both to 0.9.11.
The confined compatibility patch used:

- `onError` instead of the removed object-form `errorHandler`;
- caught 0.9 fatal parse exceptions at existing adapter boundaries;
- xmldom's exported `Document`, `Element`, and `Node` types instead of browser DOM globals; and
- explicit guards for nullable `documentElement` and `NodeList.item()` results.

After those mechanical changes, the probe produced:

- 331 passing migrator/transcoder tests;
- a passing repository typecheck and build;
- 1,713 passing active repository tests, with the existing three skips unchanged; and
- 176 verified transcoder support-evidence cases.

No snapshots or generated output changed. The observed migration delta was API/type-only: there
were no lexical serialization or semantic model deltas to classify. The probe changes were then
removed through normal patches, and the original manifests and lockfile were restored.

## Revisit procedure

1. Recheck dist-tags, deprecation metadata, release notes, engines, license, and audit output.
2. Require the selected 0.9 patch to pass the configured minimum release age without an exclusion.
3. Reapply the confined adapter changes listed above to both packages together.
4. Run `pnpm verify && pnpm check:transcoder-support`.
5. If snapshots change, classify each delta and prove reparsed model equivalence before acceptance.
