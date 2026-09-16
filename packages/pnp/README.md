# @longsightgroup/qti3-pnp

Dependency-free TypeScript resolver for QTI 3 Personal Needs and Preferences data.

The package accepts PNP data supplied by a host application, normalizes it into stable
preference records, validates profile-level issues, and resolves those preferences against
player capabilities and QTI catalog support metadata.

It does not fetch, store, authorize, or transmit PNP records. LMS identity, consent,
institutional policy, persistence, LTI launch handling, and AfA PNP service access belong
outside this package.

```ts
import {
  createDefaultQti3PnpCapabilities,
  normalizeQti3Pnp,
  parseQti3PnpXml,
  resolveQti3Pnp,
} from "@longsightgroup/qti3-pnp";

const parsed = parseQti3PnpXml(pnpXml);
const normalized = normalizeQti3Pnp(parsed);

const resolution = resolveQti3Pnp(normalized.profile, {
  capabilities: createDefaultQti3PnpCapabilities(),
  qti: { catalogResolution },
  activity: { language: "en" },
});

console.log(resolution.display);
console.log(resolution.catalogRequests);
console.log(resolution.diagnostics);
```

## Default player integration

`createPnpPlayerOptions(resolution)` maps an already resolved profile to properties accepted by
`@longsightgroup/qti3-player` and its React/Preact adapters. It is a pure function with no player
dependency, DOM access, fetching, persistence, or institutional policy enforcement.

```ts
import { createPnpPlayerOptions } from "@longsightgroup/qti3-pnp";

const { playerOptions, hostRequired } = createPnpPlayerOptions(resolution);
player.keywordEmphasisEnabled = playerOptions.keywordEmphasisEnabled;
player.catalogRequestPolicy = playerOptions.catalogRequestPolicy;

// Review hostRequired.diagnostics and hostRequired.unresolved, and implement
// any remaining display, tools, media, session, or extension requirements.
```

Assign both properties each time the profile changes. These are replacement values: missing or
disabled keyword emphasis becomes `false`, and an empty catalog request list produces an exact
selection list of `[]`, disabling all catalog request controls. The mapping replaces any previous
host catalog request policy; it does not merge with it. Re-resolve against the current item's
catalog metadata when loading a different item, then apply the new options.

| Resolution data                                               | Mapping behavior                                                 |
| ------------------------------------------------------------- | ---------------------------------------------------------------- |
| `display.keywordEmphasis`                                     | Sets `keywordEmphasisEnabled`                                    |
| `catalogRequests`                                             | Enables controls for exact catalog/support/entry-language tuples |
| Other display settings, tools, media, session                 | Returned in `hostRequired`; no player behavior is claimed        |
| Extensions, prohibitions, unresolved preferences, diagnostics | Retained in `hostRequired` for host handling/review              |

Catalog selections preserve the resolver's chosen language, including its fallback result.
The player does not repeat language fallback or enable other catalogs with the same support.
An absent `entryLanguage` matches only content without a language. Duplicate selections do not
duplicate delivered content. The tuple identifies all authored entries sharing those three values;
it is not an individual card-entry identifier.

The host must handle `qti-catalogrequest` to present the player's sanitized delivery content.
`hostRequired.catalogRequests` retains the original requests and their reasons, including
`pnp-initial`; the mapper never opens presentations or fires requests automatically. Enabling
controls alone does not fulfill a required accommodation. The general resolver's default
capabilities describe resolution capabilities, not a promise that the default player implements
every resulting setting. Supply the capabilities your host actually delivers.

The mapper does not reinterpret policy or decide whether diagnostics permit delivery. Review
the resolution before applying it. `hostRequired` retains input records by reference; treat them
as read-only. The player settings are newly constructed and do not mutate the resolution.

## Support Metadata

`qti3PnpSupportDefinitions` reports `supportLevel` as the precise support classification:
`recognized`, `catalog`, `runtime`, or `runtime-and-catalog`. The `implemented` boolean is a
summary flag for supports that are more than recognized-only; use `supportLevel` when you need
to distinguish catalog activation from player/runtime behavior.
