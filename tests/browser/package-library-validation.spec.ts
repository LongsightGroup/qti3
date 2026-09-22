import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  createItemPackageZip,
  qtiAssessmentTestResource,
  qtiItemResource,
} from "./player-helpers.js";
import { installAxe } from "./axe-helpers.js";
import { parseQtiPackage } from "../../packages/core/src/index.js";

const itemXml = readFileSync(
  "packages/fixtures/packages/basic-item-player/valid-item-only/items/choice.xml",
  "utf8",
);
const testXml =
  '<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="test" title="Subset"><qti-test-part identifier="part" navigation-mode="linear" submission-mode="individual"><qti-assessment-section identifier="section" title="Section" visible="true"><qti-assessment-item-ref identifier="selected" href="selected.xml"/></qti-assessment-section></qti-test-part></qti-assessment-test>';

function mixedPackage(extraXml: string): Buffer {
  return createItemPackageZip({
    resources: [
      qtiItemResource("extra", "extra.xml"),
      qtiItemResource("selected", "selected.xml"),
      qtiAssessmentTestResource("test", "test.xml"),
    ],
    files: { "extra.xml": extraXml, "selected.xml": itemXml, "test.xml": testXml },
  });
}

for (const [defect, xml, code] of [
  ["unterminated declaration", '<?xml version="1.0"?', "xml.parse"],
  ["wrong namespace", itemXml.replaceAll("imsqtiasi_v3p0", "imsqti_v2p2"), "qti.root"],
  ["trailing content", `${itemXml}stray text`, "xml.parse"],
  [
    "invalid choice limit",
    itemXml.replace('max-choices="1"', 'max-choices="-1"'),
    "interaction.integerAttribute",
  ],
] as const) {
  test(`saves valid items and excludes an unreferenced item with ${defect}`, async ({
    page,
    context,
  }) => {
    const zip = mixedPackage(xml);
    const parsed = parseQtiPackage(zip);
    expect(parsed.ok).toBe(false);
    await page.goto("/library.html");
    await page
      .getByLabel("Import package", { exact: true })
      .setInputFiles({ name: "mixed.zip", mimeType: "application/zip", buffer: zip });
    await expect(page.getByRole("status", { name: "Package library status" })).toContainText(
      "Saved mixed.zip. Reopened 1 question from the database. Rejected 1 question.",
    );
    await expect(page.locator("#library-diagnostics")).toBeVisible();
    await expect(page.locator("#library-diagnostics")).toContainText(code);
    await expect(page.locator("#library-diagnostics")).toContainText("extra.xml");
    await expect(page.locator("#package-items option")).toHaveCount(1);
    await expect(page.locator("#package-items option")).toContainText("selected.xml");
    await expect(page.getByRole("button", { name: "Submit response", exact: true })).toBeEnabled();
    await page.getByRole("radio", { name: "A. response declaration", exact: true }).check();
    await page.getByRole("button", { name: "Submit response", exact: true }).click();
    await expect(page.getByRole("status", { name: "Submission result" })).toContainText("Score: 1");
    const id = await page.getByLabel("Saved package", { exact: true }).inputValue();
    await page.close();
    const reopened = await context.newPage();
    await reopened.goto("/library.html");
    await reopened.getByLabel("Saved package", { exact: true }).selectOption(id);
    await expect(reopened.getByRole("status", { name: "Package library status" })).toContainText(
      "1 question. Rejected 1 question.",
    );
    await expect(reopened.locator("#package-items option")).toHaveCount(1);
    expect(await reopened.locator("#item-source").textContent()).toBe(itemXml);
    await expect(reopened.locator("#library-diagnostics")).toBeVisible();
    await expect(reopened.locator("#library-diagnostics")).toContainText("extra.xml");
    await expect(reopened.locator("#library-diagnostics")).toContainText(code);
    const stored = await reopened.evaluate(async (recordId) => {
      const storePath = "/src/package-library/store.ts";
      const result = await (await import(/* @vite-ignore */ storePath)).readPackage(recordId);
      if (!result.ok || !result.value) throw new Error("Saved package missing");
      return result.value.entries.map((entry: { path: string; bytes: Uint8Array }) => ({
        path: entry.path,
        bytes: [...entry.bytes],
      }));
    }, id);
    expect(stored).toEqual(
      parsed.entries.map((entry) => ({ path: entry.path, bytes: [...entry.bytes] })),
    );
  });
}

test("filters invalid items without shifting the question source or scoring model", async ({
  page,
}) => {
  const secondXml = itemXml
    .replaceAll("basic-choice", "second-choice")
    .replace("<qti-value>A</qti-value>", "<qti-value>B</qti-value>")
    .replace('base-type="float"/>', 'base-type="float" normal-maximum="2"/>');
  await page.goto("/library.html");
  await page.getByLabel("Import package", { exact: true }).setInputFiles({
    name: "item-only.zip",
    mimeType: "application/zip",
    buffer: createItemPackageZip({
      resources: [
        qtiItemResource("bad-first", "bad-first.xml"),
        qtiItemResource("first", "first.xml"),
        qtiItemResource("bad-middle", "bad-middle.xml"),
        qtiItemResource("second", "second.xml"),
      ],
      files: {
        "bad-first.xml": "<broken",
        "first.xml": itemXml,
        "bad-middle.xml": `${itemXml}stray text`,
        "second.xml": secondXml,
      },
    }),
  });
  await expect(page.getByRole("status", { name: "Package library status" })).toContainText(
    "Reopened 2 questions from the database. Rejected 2 questions.",
  );
  await expect(page.locator("#package-items option")).toHaveCount(2);
  await expect(page.locator("#question-title")).toHaveText("basic-choice");
  expect(await page.locator("#item-source").textContent()).toBe(itemXml);
  await page.getByLabel("Question", { exact: true }).selectOption("1");
  await expect(page.locator("#question-title")).toHaveText("second-choice");
  expect(await page.locator("#item-source").textContent()).toBe(secondXml);
  await page.getByRole("radio", { name: "B. outcome declaration", exact: true }).check();
  await page.getByRole("button", { name: "Submit response", exact: true }).click();
  await expect(page.getByRole("status", { name: "Submission result" })).toHaveText(
    "Score: 1 / 2 points.",
  );
});

for (const [defect, files, code] of [
  ["malformed manifest", { "imsmanifest.xml": "<manifest" }, "xml.parse"],
  ["malformed assessment test", { "test.xml": "<broken" }, "xml.parse"],
  [
    "missing asset",
    {
      "selected.xml": itemXml.replace(
        "<qti-item-body>",
        '<qti-item-body><img src="missing.png" alt="Diagram"/>',
      ),
    },
    "package.asset.missing",
  ],
] as const) {
  test(`blocks the whole import for ${defect} even alongside an invalid item`, async ({ page }) => {
    await page.goto("/library.html");
    await page.getByLabel("Import package", { exact: true }).setInputFiles({
      name: "broken-package.zip",
      mimeType: "application/zip",
      buffer: createItemPackageZip({
        resources: [
          qtiItemResource("extra", "extra.xml"),
          qtiItemResource("selected", "selected.xml"),
          qtiAssessmentTestResource("test", "test.xml"),
        ],
        files: { "extra.xml": "<broken", "selected.xml": itemXml, "test.xml": testXml, ...files },
      }),
    });
    await expect(page.getByRole("status", { name: "Package library status" })).toContainText(
      "Nothing was saved.",
    );
    await expect(page.locator("#library-diagnostics")).toBeVisible();
    await expect(page.locator("#library-diagnostics")).toContainText(code);
    await expect(page.locator("#saved-packages option")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Submit response", exact: true })).toBeDisabled();
    await page.reload();
    await expect(page.getByRole("status", { name: "Package library status" })).toContainText(
      "No saved packages.",
    );
  });
}

test("reopening an older saved package revalidates every manifest item without deleting it", async ({
  page,
}) => {
  await page.goto("/library.html");
  const zip = mixedPackage(`${itemXml}stray text`);
  // Seed a record saved by the old importer through the actual storage API.
  const saved = await page.evaluate(
    async (bytes) => {
      const packagePath = "/src/package-library/browser-package.ts";
      const storePath = "/src/package-library/store.ts";
      const extracted = await (
        await import(/* @vite-ignore */ packagePath)
      ).readBrowserPackageZip(new Uint8Array(bytes));
      if (!extracted.ok) return extracted;
      return (await import(/* @vite-ignore */ storePath)).savePackage({
        id: "previous-import",
        title: "Previous import",
        filename: "old.zip",
        importedAt: "2026-09-17T12:00:00Z",
        entries: extracted.entries,
      });
    },
    [...zip],
  );
  expect(saved.ok).toBe(true);
  await page.reload();
  await page.getByLabel("Saved package", { exact: true }).selectOption("previous-import");
  await expect(page.getByRole("status", { name: "Package library status" })).toContainText(
    "Opened old.zip from the database. 1 question. Rejected 1 question.",
  );
  await expect(page.locator("#library-diagnostics")).toBeVisible();
  await expect(page.locator("#library-diagnostics")).toContainText("extra.xml");
  await expect(page.locator("#package-items option")).toHaveCount(1);
  await expect(page.locator("#package-items option")).toContainText("selected.xml");
  await expect(page.getByRole("button", { name: "Submit response", exact: true })).toBeEnabled();
  await expect(page.locator("#saved-packages option")).toHaveCount(2);
  await installAxe(page);
  expect(
    await page.evaluate(async () => {
      if (!window.axe) throw new Error("axe unavailable");
      return (await window.axe.run(document.documentElement)).violations;
    }),
  ).toEqual([]);
});

test("retains a good saved package after a rejected import and includes valid extra items", async ({
  page,
}) => {
  await page.goto("/library.html");
  await page.getByLabel("Import package", { exact: true }).setInputFiles({
    name: "good.zip",
    mimeType: "application/zip",
    buffer: mixedPackage(itemXml.replaceAll("basic-choice", "extra-choice")),
  });
  await expect(page.getByRole("status", { name: "Package library status" })).toContainText(
    "Reopened 2 questions",
  );
  await expect(page.locator("#package-items option").first()).toContainText("selected.xml");
  await page.getByLabel("Question", { exact: true }).selectOption("1");
  await expect(page.locator("#item-source")).toContainText('identifier="extra-choice"');
  const id = await page.getByLabel("Saved package", { exact: true }).inputValue();
  await page.getByLabel("Import package", { exact: true }).setInputFiles({
    name: "bad.zip",
    mimeType: "application/zip",
    buffer: createItemPackageZip({
      resources: [qtiItemResource("invalid", "invalid.xml")],
      files: { "invalid.xml": "<broken" },
    }),
  });
  await expect(page.getByRole("status", { name: "Package library status" })).toContainText(
    "Nothing was saved.",
  );
  await expect(page.locator("#saved-packages option")).toHaveCount(2);
  await page.reload();
  await page.getByLabel("Saved package", { exact: true }).selectOption(id);
  await expect(page.getByRole("status", { name: "Package library status" })).toContainText(
    "Opened good.zip",
  );
  await expect(page.locator("#package-items option")).toHaveCount(2);
});
