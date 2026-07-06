# @longsightgroup/qti3-migrator

Framework-neutral QTI 1.2 and QTI 2.x to QTI 3 migration utilities.

The migrator reads legacy QTI package or item XML and produces QTI-shaped authoring models from `@longsightgroup/qti3-writer`. It does not own application-specific draft models or authoring UI review policy.

```ts
import { migrateQtiToQti3 } from "@longsightgroup/qti3-migrator";

const result = await migrateQtiToQti3({ filename: "quiz.zip", bytes });
```

Use `migrateQtiToQti3Package` when the output should be passed directly to
`@longsightgroup/qti3-writer` package APIs. Package migration preserves manifest item and asset
paths from the source package:

```ts
import { migrateQtiToQti3Package } from "@longsightgroup/qti3-migrator";
import { writeQti3PackageZipResult } from "@longsightgroup/qti3-writer";

const migrated = await migrateQtiToQti3Package({ filename: "quiz.zip", bytes });

if (migrated.ok) {
  const qti3Package = writeQti3PackageZipResult(migrated.package);
  console.log(qti3Package);
}
```

Defaults are strict: source repair is disabled and unsupported interactions are reported as diagnostics instead of silently converted.
