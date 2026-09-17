import { inflateRawSync } from "node:zlib";
import { expect, test } from "@playwright/test";
import { parseQtiPackage } from "../../packages/core/src/index.js";
import {
  createDeflatedZip,
  createItemPackageZip,
  createStoredZip,
  qtiItemResource,
} from "./player-helpers.js";

const itemXml = `<?xml version="1.0"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="saved-choice" title="Saved choice" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"><qti-correct-response><qti-value>A</qti-value></qti-correct-response></qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"><qti-default-value><qti-value>0</qti-value></qti-default-value></qti-outcome-declaration>
  <qti-item-body><qti-choice-interaction response-identifier="RESPONSE" max-choices="1"><qti-prompt>One plus one?</qti-prompt><qti-simple-choice identifier="A">Two</qti-simple-choice><qti-simple-choice identifier="B">Three</qti-simple-choice></qti-choice-interaction></qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`;

for (const compression of ["stored", "deflated"] as const) {
  test(`browser ${compression} extraction and import agree with the core importer`, async ({
    page,
  }) => {
    const zip = createItemPackageZip({
      resources: [qtiItemResource("choice", "items/choice.xml", ["image.svg"])],
      files: {
        "items/choice.xml": itemXml,
        "image.svg": '<svg xmlns="http://www.w3.org/2000/svg"/>',
        "unused.bin": Buffer.from([0, 255, 1, 2]),
      },
      compression,
    });
    const core = parseQtiPackage(zip, { inflateRaw: (bytes) => inflateRawSync(bytes) });
    expect(core.ok).toBe(true);
    await page.goto("/");
    const actual = await page.evaluate(
      async (input) => {
        const modulePath = "/src/package-library/browser-package.ts";
        const { readBrowserPackageZip, importPackageEntries } = await import(
          /* @vite-ignore */ modulePath
        );
        const extracted = await readBrowserPackageZip(new Uint8Array(input));
        if (!extracted.ok) return extracted;
        const imported = await importPackageEntries(extracted.entries);
        if (!imported.ok) return imported;
        return {
          ok: true,
          items: imported.items,
          summary: imported.summary,
          entries: imported.entries.map((entry: { path: string; bytes: Uint8Array }) => ({
            path: entry.path,
            bytes: [...entry.bytes],
          })),
        };
      },
      [...zip],
    );
    expect(actual.ok).toBe(true);
    expect(actual.items).toEqual(JSON.parse(JSON.stringify(core.items)));
    expect(actual.summary.title).toBe(core.title);
    expect(actual.summary.assets).toEqual(core.assets);
    expect(actual.summary.manifestResources).toEqual(core.manifestResources);
    expect(actual.entries).toEqual(
      core.entries.map((entry) => ({ path: entry.path, bytes: [...entry.bytes] })),
    );
  });
}

test("rejects malformed ZIP headers, ambiguous paths, unsupported methods, and resource overruns", async ({
  page,
}) => {
  await page.goto("/");
  const mismatch = createStoredZip({ "item.xml": itemXml });
  mismatch.writeUInt32LE(1, 22);
  const unsupported = createStoredZip({ "item.xml": itemXml });
  unsupported.writeUInt16LE(99, 8);
  const central = unsupported.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  unsupported.writeUInt16LE(99, central + 10);
  const cases = [
    { bytes: Buffer.from("not a ZIP") },
    { bytes: mismatch },
    { bytes: unsupported },
    { bytes: createStoredZip({ "../item.xml": itemXml }) },
    { bytes: createStoredZip({ "items/../item.xml": itemXml }) },
    { bytes: createStoredZip({ a: "a", b: "b" }), limits: { maxEntries: 1 } },
    { bytes: createStoredZip({ a: "1234" }), limits: { maxEntryUncompressedBytes: 3 } },
    { bytes: createStoredZip({ a: "123", b: "456" }), limits: { maxTotalUncompressedBytes: 5 } },
    { bytes: createDeflatedZip({ a: "x".repeat(2000) }), limits: { maxCompressionRatio: 2 } },
  ];
  for (const input of cases) {
    const result = await page.evaluate(
      async ({ bytes, limits }) => {
        const modulePath = "/src/package-library/browser-package.ts";
        const { readBrowserPackageZip } = await import(/* @vite-ignore */ modulePath);
        return readBrowserPackageZip(new Uint8Array(bytes), {
          maxEntries: 4096,
          maxEntryUncompressedBytes: 134217728,
          maxTotalUncompressedBytes: 536870912,
          maxCompressionRatio: 200,
          ...limits,
        });
      },
      { bytes: [...input.bytes], limits: input.limits },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0].severity).toBe("error");
  }
});

test("cancels DEFLATE that expands beyond its declared size", async ({ page }) => {
  const zip = createDeflatedZip({ "entry.txt": "repeat".repeat(10000) });
  const central = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  zip.writeUInt32LE(16, 22);
  zip.writeUInt32LE(16, central + 24);
  await page.goto("/");
  const result = await page.evaluate(
    async (bytes) => {
      const modulePath = "/src/package-library/browser-package.ts";
      return (await import(/* @vite-ignore */ modulePath)).readBrowserPackageZip(
        new Uint8Array(bytes),
      );
    },
    [...zip],
  );
  expect(result.ok).toBe(false);
  expect(result.diagnostics[0].message).toContain("declared byte budget");
});

test("discards provisional item events when the terminal core summary fails", async ({ page }) => {
  const zip = createItemPackageZip({
    resources: [qtiItemResource("good", "good.xml"), qtiItemResource("missing", "missing.xml")],
    files: { "good.xml": itemXml },
  });
  await page.goto("/");
  const result = await page.evaluate(
    async (bytes) => {
      const modulePath = "/src/package-library/browser-package.ts";
      const { readBrowserPackageZip, importPackageEntries } = await import(
        /* @vite-ignore */ modulePath
      );
      const extracted = await readBrowserPackageZip(new Uint8Array(bytes));
      return extracted.ok ? importPackageEntries(extracted.entries) : extracted;
    },
    [...zip],
  );
  expect(result.ok).toBe(false);
  expect(result).not.toHaveProperty("items");
});

test("imports, commits, and immediately opens the saved record", async ({ page }) => {
  const zip = createItemPackageZip({
    resources: [qtiItemResource("choice", "item.xml")],
    files: { "item.xml": itemXml },
  });
  await page.goto("/library.html");
  await page
    .getByLabel("Import package", { exact: true })
    .setInputFiles({ name: "choice.zip", mimeType: "application/zip", buffer: zip });
  await expect(page.getByRole("status")).toHaveText(
    "Saved choice.zip. Reopened 1 question from the database.",
  );
  await expect(page.getByRole("radio", { name: "A. Two", exact: true })).toBeVisible();
  const stored = await page.evaluate(async () => {
    const modulePath = "/src/package-library/store.ts";
    const { listPackages, readPackage } = await import(/* @vite-ignore */ modulePath);
    const listed = await listPackages();
    if (!listed.ok) return listed;
    return readPackage(listed.value[0].id);
  });
  expect(stored.ok).toBe(true);
  expect(stored.value.filename).toBe("choice.zip");
  expect(stored.value.entries).toHaveLength(2);
});

test("a duplicate ID aborts the write and leaves the earlier record intact", async ({ page }) => {
  await page.goto("/library.html");
  const result = await page.evaluate(async () => {
    const modulePath = "/src/package-library/store.ts";
    const { savePackage, readPackage } = await import(/* @vite-ignore */ modulePath);
    const record = {
      id: "same-id",
      title: "Original",
      filename: "a.zip",
      importedAt: "2026-09-17T12:00:00.000Z",
      entries: [{ path: "original.xml", bytes: new Uint8Array([65]) }],
    };
    const first = await savePackage(record);
    const duplicate = await savePackage({ ...record, title: "Replacement" });
    const read = await readPackage(record.id);
    return { first, duplicate, read };
  });
  expect(result.first.ok).toBe(true);
  expect(result.duplicate).toMatchObject({ ok: false, code: "aborted" });
  expect(result.read.value.title).toBe("Original");
});

test("a failed import reports diagnostics without adding a saved package", async ({ page }) => {
  await page.goto("/library.html");
  await page.getByLabel("Import package", { exact: true }).setInputFiles({
    name: "broken.zip",
    mimeType: "application/zip",
    buffer: Buffer.from("broken"),
  });
  await expect(page.getByRole("status")).toContainText("Package import failed. Nothing was saved.");
  await expect(page.locator("#saved-packages option")).toHaveCount(1);
  await page.getByText("Import and player diagnostics", { exact: true }).click();
  await expect(page.locator("#library-diagnostics")).toContainText("package.zip.invalid");
});
