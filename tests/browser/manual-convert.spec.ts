import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { parseQtiXml, validateAssessmentItem } from "../../packages/core/src/index.js";
import { canonicalFixtures } from "../../packages/fixtures/src/index.js";
import { installAxe } from "./axe-helpers.js";

test.beforeEach(async ({ page }) => {
  await page.goto("/convert.html");
  await expect(page.getByRole("button", { name: "Write QTI 3 XML", exact: true })).toBeEnabled();
});

test("writes escaped text, previews a scorable item, copies and downloads the actual output", async ({
  page,
  context,
}) => {
  const prompt = 'Choose <Mars> & avoid <img src="https://example.invalid/tracker">.';
  await page.getByLabel("Question", { exact: true }).fill(prompt);
  await page.getByRole("button", { name: "Write QTI 3 XML", exact: true }).click();
  await expect(page.locator("#write-result").getByRole("status")).toHaveText(
    "Completed successfully.",
  );
  const xml = await page.locator("#write-output").inputValue();
  expect(xml).toContain("&lt;Mars&gt; &amp;");
  const parsed = parseQtiXml(xml);
  expect(parsed.ok).toBe(true);
  if (!parsed.document) throw new Error("Expected generated QTI 3 document.");
  expect(
    validateAssessmentItem(parsed.document).diagnostics.filter(
      (entry) => entry.severity === "error",
    ),
  ).toEqual([]);
  await page.locator("#write-result").getByRole("button", { name: "Preview QTI 3" }).click();
  await expect(page.locator("#preview-heading")).toBeFocused();
  const player = page.locator("qti-assessment-item-player");
  await expect(player).toContainText(prompt);
  await expect(player.locator("img")).toHaveCount(0);
  await player.getByRole("radio", { name: "B. Mars", exact: true }).check();
  const score = await player.evaluate((element) => element.scoreAttempt());
  expect(score?.outcomes.SCORE).toBe(1);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.locator("#write-result").getByRole("button", { name: "Copy XML" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(xml);
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#write-result").getByRole("button", { name: "Download XML" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("written-qti3.xml");
  const path = await download.path();
  if (!path) throw new Error("Expected downloaded XML file.");
  expect(await readFile(path, "utf8")).toBe(xml);
});

for (const version of ["1.2", "2.1"]) {
  test(`migrates the QTI ${version} sample and previews its QTI 3 output`, async ({ page }) => {
    await page.getByRole("button", { name: `Load QTI ${version} sample`, exact: true }).click();
    await page.getByRole("button", { name: "Migrate to QTI 3", exact: true }).click();
    await expect(page.locator("#migrate-output")).not.toHaveValue("");
    const parsed = parseQtiXml(await page.locator("#migrate-output").inputValue());
    expect(parsed.ok).toBe(true);
    if (!parsed.document) throw new Error("Expected migrated document.");
    expect(
      validateAssessmentItem(parsed.document).diagnostics.filter(
        (entry) => entry.severity === "error",
      ),
    ).toEqual([]);
    await page.locator("#migrate-result").getByRole("button", { name: "Preview QTI 3" }).click();
    await expect(page.locator("#preview-status")).toContainText("loaded");
    await expect(page.locator("qti-assessment-item-player").getByRole("radio")).toHaveCount(3);
  });
}

for (const [label, namespace] of [
  ["QTI 1.2", "questestinterop"],
  ["QTI 2.1", "http://www.imsglobal.org/xsd/imsqti_v2p1"],
  ["QTI 2.2", "http://www.imsglobal.org/xsd/imsqti_v2p2"],
]) {
  test(`transcodes into the explicit ${label} standards profile`, async ({ page }) => {
    await page.getByRole("radio", { name: label, exact: true }).check();
    await page.getByRole("button", { name: "Transcode item", exact: true }).click();
    await expect(page.locator("#transcode-output")).not.toHaveValue("");
    expect(await page.locator("#transcode-output").inputValue()).toContain(namespace);
    await page.locator("#transcode-result summary").click();
    await expect(page.locator("#transcode-result pre")).toContainText(
      '"sourceInteraction": "choice"',
    );
    await expect(
      page.locator("#transcode-result").getByRole("button", { name: "Download XML" }),
    ).toBeEnabled();
  });
}

test("reports a lossy fallback beside output rather than presenting it as exact conversion", async ({
  page,
}) => {
  const drawing = canonicalFixtures.find((fixture) => fixture.interactionType === "drawing");
  if (!drawing) throw new Error("Expected a synthetic drawing fixture.");
  await page.getByLabel("QTI 3 item XML", { exact: true }).fill(drawing.xml);
  await page.getByRole("radio", { name: "QTI 1.2", exact: true }).check();
  await page.getByRole("button", { name: "Transcode item", exact: true }).click();
  await expect(page.locator("#transcode-result").getByRole("status")).toContainText("warning");
  await expect(page.locator("#transcode-result [data-diagnostics]")).toContainText("warning:");
  await expect(page.locator("#transcode-output")).not.toHaveValue("");
  await page.locator("#transcode-result summary").click();
  await expect(page.locator("#transcode-result pre")).toContainText('"fidelity": "lossy"');
});

test("clears stale XML and preview on edits, and shows writer and migration failures", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Write QTI 3 XML", exact: true }).click();
  await page.locator("#write-result").getByRole("button", { name: "Preview QTI 3" }).click();
  await expect(page.locator("#preview")).toBeVisible();
  await page.getByLabel("Item identifier", { exact: true }).fill("not a valid identifier");
  await expect(page.locator("#write-output")).toHaveValue("");
  await expect(page.locator("#preview")).toBeHidden();
  await expect(
    page.locator("#write-result").getByRole("button", { name: "Download XML" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Write QTI 3 XML", exact: true }).click();
  await expect(page.locator("#write-result").getByRole("status")).toContainText("failed");
  await expect(page.locator("#write-result [data-diagnostics]")).toContainText("error:");
  await page.getByRole("button", { name: "Migrate to QTI 3", exact: true }).click();
  await expect(page.locator("#migrate-output")).not.toHaveValue("");
  await page
    .getByLabel("Legacy item XML", { exact: true })
    .fill(
      '<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="unsupported" title="Unsupported"><itemBody><unknownInteraction responseIdentifier="RESPONSE"/></itemBody></assessmentItem>',
    );
  await page.getByRole("button", { name: "Migrate to QTI 3", exact: true }).click();
  await expect(page.locator("#migrate-result").getByRole("status")).toContainText("failed");
  await expect(page.locator("#migrate-output")).toHaveValue("");
  await expect(page.locator("#migrate-result [data-diagnostics]")).toContainText("error:");
  await page.getByLabel("Legacy item XML", { exact: true }).fill("<assessmentItem>");
  await page.getByRole("button", { name: "Migrate to QTI 3", exact: true }).click();
  await expect(page.locator("#migrate-result").getByRole("status")).toContainText("failed");
  await expect(
    page.locator("#migrate-result").getByRole("button", { name: "Preview QTI 3" }),
  ).toBeDisabled();
});

test("clears transcoder output on target changes and invalid input", async ({ page }) => {
  await page.getByRole("button", { name: "Transcode item", exact: true }).click();
  await expect(page.locator("#transcode-output")).not.toHaveValue("");
  await page.getByRole("radio", { name: "QTI 2.2", exact: true }).check();
  await expect(page.locator("#transcode-output")).toHaveValue("");
  await expect(page.locator("#transcode-result [data-report]")).toBeHidden();
  await page.getByLabel("QTI 3 item XML", { exact: true }).fill("<broken>");
  await page.getByRole("button", { name: "Transcode item", exact: true }).click();
  await expect(page.locator("#transcode-result").getByRole("status")).toContainText("failed");
  await expect(
    page.locator("#transcode-result").getByRole("button", { name: "Copy XML" }),
  ).toBeDisabled();
});

test("supports keyboard operation, narrow reflow, forced colors, and accessible names", async ({
  page,
}) => {
  const submit = page.getByRole("button", { name: "Write QTI 3 XML", exact: true });
  await page.getByLabel("Choice C text").focus();
  await page.keyboard.press("Tab");
  await expect(submit).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#write-output")).not.toHaveValue("");
  await page.locator("#write-result").getByRole("button", { name: "Preview QTI 3" }).click();
  await installAxe(page);
  const violations = await page.evaluate(async () => {
    if (!window.axe) throw new Error("Missing axe.");
    return (await window.axe.run(document.documentElement)).violations;
  });
  expect(violations).toEqual([]);
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await expect(
      page.locator("#write-result").getByRole("button", { name: "Copy XML" }),
    ).toBeVisible();
  }
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.getByLabel("Choice C text").focus();
  await page.keyboard.press("Tab");
  await expect(submit).toBeFocused();
  await expect(submit).toHaveCSS("outline-style", "solid");
  await expect(submit).toHaveCSS("outline-width", "3px");
});

test("links the conversion page from the main manual", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Create and convert", exact: true }).click();
  await expect(page).toHaveURL(/convert\.html$/);
  await page.getByRole("link", { name: "Return to the interactive manual" }).click();
  await expect(page).toHaveURL(/#manual$/);
});

test("keeps external preview media local and rejects multi-item input", async ({ page }) => {
  const externalRequests: string[] = [];
  await page.route("https://example.invalid/**", async (route) => {
    externalRequests.push(route.request().url());
    await route.abort();
  });
  const source = await page.locator("#migration-xml").inputValue();
  await page
    .locator("#migration-xml")
    .fill(
      source.replace(
        "<prompt>",
        '<prompt><img src="https://example.invalid/image.png" alt="External illustration"/>',
      ),
    );
  await page.getByRole("button", { name: "Migrate to QTI 3", exact: true }).click();
  await expect(page.locator("#migrate-output")).not.toHaveValue("");
  await page.locator("#migrate-result").getByRole("button", { name: "Preview QTI 3" }).click();
  await expect(page.locator("#preview-status")).toContainText("loaded");
  const image = page.locator("qti-assessment-item-player img");
  await expect(image).toHaveCount(1);
  await expect
    .poll(() => image.evaluate((element: HTMLImageElement) => element.complete))
    .toBe(true);
  expect(externalRequests).toEqual([]);

  await page.getByRole("button", { name: "Load QTI 1.2 sample", exact: true }).click();
  const legacy = await page.locator("#migration-xml").inputValue();
  const item = legacy.slice(legacy.indexOf("<item "), legacy.indexOf("</item>") + "</item>".length);
  await page
    .locator("#migration-xml")
    .fill(
      `<questestinterop>${item}${item.replace('ident="planets"', 'ident="second"')}</questestinterop>`,
    );
  await page.getByRole("button", { name: "Migrate to QTI 3", exact: true }).click();
  await expect(page.locator("#migrate-result").getByRole("status")).toContainText("failed");
  await expect(page.locator("#migrate-result [data-diagnostics]")).toContainText(
    "demo.single_item_required",
  );
  await expect(page.locator("#migrate-output")).toHaveValue("");
});
