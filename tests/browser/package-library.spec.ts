import { inflateRawSync } from "node:zlib";
import { expect, test } from "@playwright/test";
import {
  parseQtiPackage,
  readQtiPackageZipEntries,
  type QtiDiagnostic,
} from "../../packages/core/src/index.js";
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
        const { readBrowserPackageZip } = await import(/* @vite-ignore */ modulePath);
        const extracted = await readBrowserPackageZip(new Uint8Array(input.bytes));
        if (!extracted.ok) return extracted;
        const corePath = input.corePath;
        const { parseQtiPackageFromEntries } = await import(/* @vite-ignore */ corePath);
        const imported = parseQtiPackageFromEntries(extracted.entries);
        if (!imported.ok) return imported;
        return {
          ok: true,
          items: imported.items,
          summary: imported,
          entries: imported.entries.map((entry: { path: string; bytes: Uint8Array }) => ({
            path: entry.path,
            bytes: [...entry.bytes],
          })),
        };
      },
      { bytes: [...zip], corePath: `/@fs/${process.cwd()}/packages/core/src/index.ts` },
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
    const diagnostics: QtiDiagnostic[] = [];
    readQtiPackageZipEntries(
      input.bytes,
      {
        limits: input.limits,
        inflateRaw: (bytes, context) =>
          inflateRawSync(bytes, { maxOutputLength: context.maxOutputLength }),
      },
      diagnostics,
    );
    expect(result.diagnostics).toEqual(JSON.parse(JSON.stringify(diagnostics)));
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
  expect(result.diagnostics[0].code).toBe("package.zip.entry.inflate");
});

test("does not save a batch containing a valid item and a missing referenced item", async ({
  page,
}) => {
  const zip = createItemPackageZip({
    resources: [qtiItemResource("good", "good.xml"), qtiItemResource("missing", "missing.xml")],
    files: { "good.xml": itemXml },
  });
  const core = parseQtiPackage(zip);
  expect(core.ok).toBe(false);
  expect(core.items).toHaveLength(1);
  await page.goto("/library.html");
  await page
    .getByLabel("Import package", { exact: true })
    .setInputFiles({ name: "partial.zip", mimeType: "application/zip", buffer: zip });
  await expect(page.getByRole("status")).toContainText("Package import failed. Nothing was saved.");
  await expect(page.locator("#saved-packages option")).toHaveCount(1);
  await expect(page.getByRole("radio")).toHaveCount(0);
  await page.getByText("Import and player diagnostics", { exact: true }).click();
  for (const diagnostic of core.diagnostics.filter((entry) => entry.severity === "error")) {
    await expect(page.locator("#library-diagnostics")).toContainText(diagnostic.code);
  }
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

test("a duplicate ID aborts the write and leaves the earlier package usable", async ({ page }) => {
  const zip = createItemPackageZip({
    resources: [qtiItemResource("choice", "item.xml")],
    files: { "item.xml": itemXml },
  });
  await page.goto("/library.html");
  const result = await page.evaluate(
    async (bytes) => {
      const modulePath = "/src/package-library/store.ts";
      const packagePath = "/src/package-library/browser-package.ts";
      const { savePackage, readPackage } = await import(/* @vite-ignore */ modulePath);
      const extracted = await (
        await import(/* @vite-ignore */ packagePath)
      ).readBrowserPackageZip(new Uint8Array(bytes));
      const record = {
        id: "same-id",
        title: "Original",
        filename: "a.zip",
        importedAt: "2026-09-17T12:00:00.000Z",
        entries: extracted.entries,
      };
      const first = await savePackage(record);
      const duplicate = await savePackage({ ...record, title: "Replacement" });
      const read = await readPackage(record.id);
      return { first, duplicate, read };
    },
    [...zip],
  );
  expect(result.first.ok).toBe(true);
  expect(result.duplicate).toMatchObject({ ok: false, code: "aborted" });
  expect(result.read.value.title).toBe("Original");
  await page.reload();
  await page.getByLabel("Saved package", { exact: true }).selectOption("same-id");
  await expect(page.getByRole("status")).toContainText("Opened a.zip from the database.");
  await expect(page.getByRole("radio", { name: "A. Two", exact: true })).toBeVisible();
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
  await expect(page.locator("#library-diagnostics")).toContainText(
    "package.zip.centralDirectory.missing",
  );
});

test("a fresh page restores every byte, full item models, images, styles, and responses without uploading", async ({
  page,
  context,
}) => {
  const illustrated = itemXml
    .replace(
      "<qti-item-body>",
      '<qti-stylesheet href="../styles/item.css?version=1#sheet" type="text/css"/><qti-item-body><p class="saved-evidence">Database restoration</p><img src="../images/square.svg?version=1#square" alt="Saved square"/>',
    )
    .replace(
      "<qti-item-body>",
      '<qti-template-declaration identifier="HIDDEN_METADATA" cardinality="single" base-type="string"><qti-default-value><qti-value>Preserve this invisible value.</qti-value></qti-default-value></qti-template-declaration><qti-item-body>',
    );
  const second = itemXml
    .replaceAll("saved-choice", "second-choice")
    .replaceAll("Saved choice", "Second choice");
  const zip = createItemPackageZip({
    resources: [
      qtiItemResource("first", "items/first.xml", ["styles/item.css", "images/square.svg"]),
      qtiItemResource("second", "items/second.xml"),
    ],
    files: {
      "items/first.xml": illustrated,
      "items/second.xml": second,
      "images/square.svg":
        '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="navy"/></svg>',
      "styles/item.css":
        ".saved-evidence { border-left: 7px solid rgb(23, 45, 67); padding-left: 5px; }",
      "metadata/unrendered.xml":
        "<metadata><author>Example author</author><note>Preserved but not rendered</note></metadata>",
      "unused.bin": Buffer.from([0, 255, 128, 31, 13, 10]),
    },
    compression: "deflated",
  });
  const original = parseQtiPackage(zip, { inflateRaw: (bytes) => inflateRawSync(bytes) });
  expect(original.ok).toBe(true);
  await page.goto("/library.html");
  await page
    .getByLabel("Import package", { exact: true })
    .setInputFiles({ name: "preservation.zip", mimeType: "application/zip", buffer: zip });
  await expect(page.getByRole("status")).toContainText("Reopened 2 questions from the database.");
  const id = await page.getByLabel("Saved package", { exact: true }).inputValue();
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto("/library.html");
  await expect(reopened.getByRole("status")).toHaveText("Select a saved package to reopen it.");
  const restored = await reopened.evaluate(
    async ({ packageId, importPath }) => {
      const storePath = "/src/package-library/store.ts";
      const saved = await (await import(/* @vite-ignore */ storePath)).readPackage(packageId);
      if (!saved.ok) return saved;
      const imported = await (
        await import(/* @vite-ignore */ importPath)
      ).parseQtiPackageFromEntries(saved.value.entries);
      return {
        imported,
        entries: saved.value.entries.map((entry: { path: string; bytes: Uint8Array }) => ({
          path: entry.path,
          bytes: [...entry.bytes],
        })),
      };
    },
    { packageId: id, importPath: `/@fs/${process.cwd()}/packages/core/src/index.ts` },
  );
  expect(restored.entries).toEqual(
    original.entries.map((entry) => ({ path: entry.path, bytes: [...entry.bytes] })),
  );
  expect(restored.imported.items).toEqual(JSON.parse(JSON.stringify(original.items)));
  expect(restored.imported.manifestResources).toEqual(original.manifestResources);
  expect(restored.imported.assets).toEqual(original.assets);
  const contentRequests: string[] = [];
  reopened.on("request", (request) => {
    if (/^https?:/.test(request.url())) contentRequests.push(request.url());
  });
  await reopened.route("**/*", (route) => route.abort());
  await reopened.getByLabel("Saved package", { exact: true }).selectOption(id);
  await expect(reopened.getByRole("status")).toContainText(
    "Opened preservation.zip from the database. 2 questions.",
  );
  await expect(reopened.locator("#package-items option")).toHaveCount(2);
  const image = reopened.getByRole("img", { name: "Saved square" });
  await expect(image).toHaveAttribute("src", /^blob:.*#square$/);
  await expect
    .poll(() =>
      image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth),
    )
    .toBe(40);
  await expect
    .poll(() =>
      reopened
        .locator(".saved-evidence")
        .evaluate((element) => getComputedStyle(element).borderLeftWidth),
    )
    .toBe("7px");
  await reopened.getByRole("radio", { name: "A. Two", exact: true }).check();
  await expect(reopened.getByRole("radio", { name: "A. Two", exact: true })).toBeChecked();
  const response = await reopened.locator("qti-assessment-item-player").evaluate((element) => {
    // SAFETY: The page defines this custom element with the public player API.
    return (
      element as HTMLElement & { serialize: () => { responses: Record<string, unknown> } }
    ).serialize().responses.RESPONSE;
  });
  expect(response).toBe("A");
  await reopened.getByText("Original question XML", { exact: true }).click();
  await expect(reopened.locator("#item-source")).toHaveText(illustrated);
  await reopened.getByLabel("Question", { exact: true }).selectOption("1");
  await expect(reopened.locator("#item-source")).toHaveText(second);
  expect(contentRequests).toEqual([]);
  await reopened.unrouteAll();
  await reopened.getByRole("button", { name: "Delete package", exact: true }).click();
  await expect(reopened.getByRole("status")).toHaveText("Package deleted from this browser.");
  await expect(reopened.getByLabel("Import package", { exact: true })).toBeFocused();
  await reopened.reload();
  await expect(reopened.getByRole("status")).toHaveText(
    "No saved packages. Import a QTI ZIP to begin.",
  );
  await expect(reopened.locator("#saved-packages option")).toHaveCount(1);
});

test("missing saved assets are diagnosed without fetching the demo server", async ({ page }) => {
  const zip = createItemPackageZip({
    resources: [qtiItemResource("choice", "item.xml")],
    files: {
      "item.xml": itemXml.replace(
        "<qti-item-body>",
        '<qti-item-body><img src="missing.svg" alt="Unavailable illustration"/>',
      ),
    },
  });
  await page.goto("/library.html");
  const missingRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("missing.svg")) missingRequests.push(request.url());
  });
  await page
    .getByLabel("Import package", { exact: true })
    .setInputFiles({ name: "missing-asset.zip", mimeType: "application/zip", buffer: zip });
  await expect(page.getByRole("status")).toContainText("Package import failed. Nothing was saved.");
  await page.getByText("Import and player diagnostics", { exact: true }).click();
  await expect(page.locator("#library-diagnostics")).toContainText("missing.svg");
  await expect(page.locator("#saved-packages option")).toHaveCount(1);
  expect(missingRequests).toEqual([]);
});

test("rejects invalid stored records and reports a real database-open failure", async ({
  page,
}) => {
  await page.goto("/library.html");
  await expect(page.getByRole("status")).toContainText("No saved packages");
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("qti3-saved-packages", 1);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("packages", "readwrite");
        transaction.objectStore("packages").add({
          id: "corrupt",
          title: "Corrupt",
          filename: "bad.zip",
          importedAt: "2026-09-17T12:00:00Z",
          entries: [{ path: "../outside.xml", bytes: new Uint8Array([1]) }],
        });
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.addEventListener("abort", () => {
          database.close();
          reject(transaction.error);
        });
      };
      request.addEventListener("error", () => reject(request.error));
    });
  });
  const result = await page.evaluate(async () => {
    const path = "/src/package-library/store.ts";
    return (await import(/* @vite-ignore */ path)).readPackage("corrupt");
  });
  expect(result).toMatchObject({ ok: false, code: "invalid-record" });
  await page.reload();
  await page.getByLabel("Saved package", { exact: true }).selectOption("corrupt");
  await expect(page.getByRole("status")).toContainText("saved package record is invalid");
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("qti3-saved-packages", 2);
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.addEventListener("error", () => reject(request.error));
    });
  });
  await page.reload();
  await expect(page.getByRole("status")).toHaveText(
    "Browser storage is unavailable. The package was not saved.",
  );
});

test("keyboard import, reopen, source inspection and delete expose accessible status and controls", async ({
  page,
}) => {
  const zip = createItemPackageZip({
    resources: [qtiItemResource("choice", "item.xml")],
    files: { "item.xml": itemXml },
  });
  await page.goto("/library.html");
  const input = page.getByLabel("Import package", { exact: true });
  await input.focus();
  const chooser = page.waitForEvent("filechooser");
  await input.press("Enter");
  await (
    await chooser
  ).setFiles({ name: "keyboard.zip", mimeType: "application/zip", buffer: zip });
  await expect(page.getByRole("status")).toContainText("Saved keyboard.zip.");
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("Select a saved package to reopen it.");
  const saved = page.getByLabel("Saved package", { exact: true });
  await saved.focus();
  await expect(saved).toBeEnabled();
  await expect(saved).toBeFocused();
  await saved.press("s");
  await expect(page.getByRole("status")).toContainText("Opened keyboard.zip from the database.");
  const sourceSummary = page.getByText("Original question XML", { exact: true });
  await sourceSummary.focus();
  await sourceSummary.press("Enter");
  await expect(page.locator("#item-source")).toBeVisible();
  const { installAxe } = await import("./axe-helpers.js");
  await installAxe(page);
  const violations = await page.evaluate(async () => {
    if (!window.axe) throw new Error("axe is unavailable");
    return (await window.axe.run(document.documentElement)).violations;
  });
  expect(violations).toEqual([]);
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.emulateMedia({ forcedColors: "active" });
  const deleteButton = page.getByRole("button", { name: "Delete package", exact: true });
  await deleteButton.focus();
  await expect(deleteButton).toBeFocused();
  expect(await deleteButton.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe(
    "none",
  );
  await deleteButton.press("Enter");
  await expect(page.getByRole("status")).toHaveText("Package deleted from this browser.");
  await expect(input).toBeFocused();
});

for (const harness of [
  {
    url: "/",
    input: "#file",
    status: "#file-summary",
    ready: "items/choice.xml",
    diagnostics: "#debug-package",
  },
  {
    url: "/library.html",
    input: "#import-package",
    status: "#library-status",
    ready: "Reopened 1 question",
    diagnostics: "#library-diagnostics",
  },
]) {
  test(`${harness.url} resolves local styles and declines external styles without a network request`, async ({
    page,
  }) => {
    const xml = itemXml.replace(
      "<qti-item-body>",
      '<qti-stylesheet href="../styles/local.css?version=1#sheet" type="text/css"/><qti-stylesheet href="HTTPS://external.invalid/private.css" type="text/css"/><qti-item-body>',
    );
    const zip = createItemPackageZip({
      resources: [qtiItemResource("choice", "items/choice.xml", ["styles/local.css"])],
      files: {
        "items/choice.xml": xml,
        "styles/local.css": ".qti3-prompt { border-left: 3px solid blue; }",
      },
    });
    const externalRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("external.invalid")) externalRequests.push(request.url());
    });
    await page.route("**/external.invalid/**", (route) => route.abort());
    await page.goto(harness.url);
    await page
      .locator(harness.input)
      .setInputFiles({ name: "styles.zip", mimeType: "application/zip", buffer: zip });
    await expect(page.locator(harness.status)).toContainText(harness.ready);
    const styles = page.locator('qti-assessment-item-player link[rel="stylesheet"]');
    await expect(styles).toHaveCount(1);
    await expect(styles).toHaveAttribute("href", /^blob:.*#sheet$/);
    await expect(page.locator(harness.diagnostics)).toContainText("asset.unresolved");
    expect(externalRequests).toEqual([]);
  });
}
