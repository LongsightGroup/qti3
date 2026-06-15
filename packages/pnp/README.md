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

## Support Metadata

`qti3PnpSupportDefinitions` reports `supportLevel` as the precise support classification:
`recognized`, `catalog`, `runtime`, or `runtime-and-catalog`. The `implemented` boolean is a
summary flag for supports that are more than recognized-only; use `supportLevel` when you need
to distinguish catalog activation from player/runtime behavior.
