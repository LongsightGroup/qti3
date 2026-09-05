# xmldom and XML stack boundaries

- **Status:** Accepted
- **Decision date:** 2026-09-04

## Decision

Upgrade the optional migrator and transcoder packages from `@xmldom/xmldom` 0.8.13 to 0.9.12.
Version 0.9.12 is the non-deprecated latest release, has passed the repository's seven-day package
age gate, and contains parser and serializer security fixes absent from the locked 0.8 release.

Use the 0.9 strict-error API at the two XML adapter boundaries. Recoverable XML errors must stop
parsing instead of allowing a repaired DOM to continue, fatal parser failures must retain the
existing boundary behavior, and serialization must request well-formed output.

## XML stack ownership

- `qti3-core` owns its dependency-free QTI 3 parser and serializer boundaries. This preserves the
  zero-third-party-runtime-dependency contract for core and keeps normal parse failures in the
  typed diagnostic model.
- `@xmldom/xmldom` is confined to the optional migrator and transcoder packages, where it parses
  legacy QTI, vendor, and Moodle XML dialects and validates or assembles transcoded output.
- The 0.9 migration does not modify core XML behavior or weaken migrator/transcoder diagnostics.

## Registry and upstream evidence

Evidence refreshed on 2026-09-04:

- `pnpm view @xmldom/xmldom dist-tags --json` reported `lts: 0.8.15` and `latest: 0.9.12`. The 0.8
  line must therefore not be described as unsupported.
- 0.9.12 declares Node `>=14.6`, which is below this repository's Node 22 minimum, and uses the MIT
  license.
- The upstream [0.9 changelog](https://github.com/xmldom/xmldom/blob/master/CHANGELOG.md) documents
  stricter well-formedness handling, the `onError` API, DOM type changes, iterative traversal, and
  parser and serializer security fixes through 0.9.12.
- The upstream [security policy](https://github.com/xmldom/xmldom/security/policy) aims to maintain
  the latest two pre-1.0 minor lines with security patches.
- `pnpm audit --json` reported no known advisories. Package metadata does not mark 0.9.12 as
  deprecated, and its 2026-08-21 publication date now exceeds the configured 10,080-minute minimum
  release age.

## Migration result

Both package manifests and the lockfile now resolve to 0.9.12. The confined compatibility patch
uses:

- `onError` instead of the removed object-form `errorHandler`;
- strict `onErrorStopParsing` behavior so recoverable XML errors cannot silently use a repaired DOM;
- caught 0.9 fatal parse exceptions at existing adapter boundaries;
- xmldom's exported `Document`, `Element`, and `Node` types instead of browser DOM globals; and
- explicit guards for nullable `documentElement` and `NodeList.item()` results; and
- `{ requireWellFormed: true }` for XML serialization.

After those changes, focused migration verification produced:

- 336 passing migrator/transcoder tests, including new strict parse and serialization regressions;
- a passing repository typecheck and build;
- 176 verified transcoder support-evidence cases.

No snapshots or generated output changed. The observed output delta remains API/type-only; the
intentional behavioral delta is stricter rejection of malformed input and output. Full repository
verification is required before merging the accepted upgrade.
