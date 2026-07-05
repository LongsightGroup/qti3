# @longsightgroup/qti3-migrator

Framework-neutral QTI 1.2 and QTI 2.x to QTI 3 migration utilities.

The migrator reads legacy QTI package or item XML and produces QTI-shaped authoring models from `@longsightgroup/qti3-writer`. It does not own application-specific draft models or authoring UI review policy.

```ts
import { migrateQtiToQti3 } from "@longsightgroup/qti3-migrator";

const result = await migrateQtiToQti3({ filename: "quiz.zip", bytes });
```

Defaults are strict: source repair is disabled and unsupported interactions are reported as diagnostics instead of silently converted.
