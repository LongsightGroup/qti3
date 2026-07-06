# @longsightgroup/qti3-migrator

Framework-neutral QTI 1.2 and QTI 2.x to QTI 3 migration utilities.

The migrator reads legacy QTI package or item XML and produces QTI-shaped authoring models from `@longsightgroup/qti3-writer`. It does not own application-specific draft models or authoring UI review policy.

```ts
import { migrateQtiToQti3 } from "@longsightgroup/qti3-migrator";

const result = await migrateQtiToQti3({ filename: "quiz.zip", bytes });
```

Use `migrateQtiToQti3Package` for complete legacy QTI packages when the output should be passed directly to
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

Use `migrateQtiResourceToQti3` when a host package, such as IMS Common Cartridge, has already
identified one QTI resource and can provide that resource's local file closure. The result includes
the underlying migration, launchable QTI 3 package entries, a `launchHref`, item hrefs, and
diagnostics:

```ts
import { migrateQtiResourceToQti3 } from "@longsightgroup/qti3-migrator";

const migrated = await migrateQtiResourceToQti3({
  sourcePath: "assessment/quiz.xml",
  files: {
    "assessment/quiz.xml": quizXmlBytes,
    "assessment/map.png": mapPngBytes,
  },
});

if (migrated.ok) {
  console.log(migrated.title);
  console.log(migrated.launchHref);
  console.log(migrated.entries);
}
```

`files` is the local file closure for one IMS Common Cartridge QTI resource: keys are package-relative
paths within that resource, backslashes are normalized to forward slashes, and `sourcePath` must match
one of those keys after normalization. On success, `entries` is a standalone QTI 3 package file set
rooted at `imsmanifest.xml`; the caller decides where to store or repackage those files.

QTI 1.2 XML resources that contain multiple `<item>` elements are emitted as stable sibling item
paths so package output does not duplicate item paths while source-relative asset references keep the
same base directory.

Resource migration attaches every non-XML file in the provided closure to each migrated item. The
writer emits shared asset paths once when the referenced bytes are identical across items.

Defaults are strict: source repair is disabled and unsupported interactions are reported as diagnostics instead of silently converted.

QTI assessment-test structure preservation is not implemented yet. When a legacy package contains an
assessment-test resource, migration returns a flat review part and reports
`assessment_test_structure_not_migrated`.
