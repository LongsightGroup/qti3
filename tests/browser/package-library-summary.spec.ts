import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { createItemPackageZip, qtiItemResource } from "./player-helpers.js";
import { installAxe } from "./axe-helpers.js";

const mapped = `<?xml version="1.0"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="compact-mapping" title="Compact mapping" adaptive="false" time-dependent="false" xml:lang="en">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value><qti-value>B</qti-value></qti-correct-response>
    <qti-mapping lower-bound="0" upper-bound="2" default-value="0">
      <qti-map-entry map-key="A" mapped-value="1" case-sensitive="false"/>
      <qti-map-entry map-key="B" mapped-value="-1"/>
    </qti-mapping>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="0" shuffle="false" class="qti-labels-suffix-none">
      <qti-prompt>Choose a label.</qti-prompt>
      <qti-simple-choice identifier="A" fixed="false">&lt;sample&gt;</qti-simple-choice>
      <qti-simple-choice identifier="B">Second label</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/map_response.xml"/>
</qti-assessment-item>`;

async function importItem(page: Page, xml: string): Promise<void> {
  await page.goto("/library.html");
  await page.getByLabel("Import package", { exact: true }).setInputFiles({
    name: "summary.zip",
    mimeType: "application/zip",
    buffer: createItemPackageZip({
      resources: [qtiItemResource("summary", "item.xml")],
      files: { "item.xml": xml },
    }),
  });
  await expect(page.getByRole("status", { name: "Package library status" })).toContainText(
    "Reopened 1 question",
  );
  await page.getByText("Imported QTI", { exact: true }).click();
}

test("compact import tables preserve zeros, false values, mapping details and NULL defaults", async ({
  page,
}) => {
  await importItem(page, mapped);
  const summary = page.getByRole("region", { name: "Imported QTI data" });
  const root = summary.getByRole("table", { name: "Item", exact: true });
  await expect(root.getByRole("row").filter({ hasText: "adaptive" }).getByRole("cell")).toHaveText([
    "adaptive",
    "false",
  ]);
  const interaction = summary.getByRole("table", { name: "Interaction 1", exact: true });
  await expect(
    interaction.getByRole("row").filter({ hasText: "max-choices" }).getByRole("cell"),
  ).toHaveText(["max-choices", "0"]);
  await expect(
    interaction.getByRole("row").filter({ hasText: "shuffle" }).getByRole("cell"),
  ).toHaveText(["shuffle", "false"]);
  await expect(interaction).toContainText("qti-labels-suffix-none");
  await expect(
    summary.getByRole("table", { name: "Responses", exact: true }).getByRole("cell"),
  ).toHaveText(["RESPONSE", "multiple / identifier", "NULL", '["A","B"]']);
  await expect(
    summary.getByRole("table", { name: "Mapping bounds: RESPONSE", exact: true }).getByRole("cell"),
  ).toHaveText(["0", "0", "2"]);
  await expect(
    summary.getByRole("table", { name: "Mapping: RESPONSE", exact: true }).getByRole("cell"),
  ).toHaveText(["A", "1", 'case-sensitive="false"', "B", "-1", "—"]);
  await expect(
    summary.getByRole("table", { name: "Choices: RESPONSE", exact: true }),
  ).toContainText("<sample>");
  await expect(summary.locator("sample")).toHaveCount(0);
  const defaults = summary.getByRole("table", { name: "Outcomes", exact: true }).getByRole("cell");
  await expect(defaults).toHaveText(["SCORE", "single / float", "NULL"]);
  await page.getByRole("checkbox", { name: "A <sample>", exact: true }).check();
  await page.getByRole("button", { name: "Submit response", exact: true }).click();
  await expect(page.getByRole("status", { name: "Submission result" })).toContainText("1");
  await expect(defaults).toHaveText(["SCORE", "single / float", "NULL"]);
  await expect(
    summary.getByRole("table", { name: "Template declarations", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("#item-model")).toHaveCount(0);
  expect(await summary.innerText()).not.toMatch(/sourceChildren|registryStatus|bodyText|"offset"/);
});

test("custom processing expands as QTI rules without a full parsed JSON option", async ({
  page,
}) => {
  const xml = readFileSync(
    "packages/fixtures/packages/sv-matrix/items/interaction-input-width-five.xml",
    "utf8",
  );
  await importItem(page, xml);
  const summary = page.getByRole("region", { name: "Imported QTI data" });
  const toggle = summary.getByText("Processing rules", { exact: true });
  await toggle.focus();
  await toggle.press("Enter");
  const rules = summary.getByRole("region", { name: "Processing rules", exact: true });
  await expect(rules).toContainText('<qti-set-outcome-value identifier="SCORE">');
  await expect(rules).not.toContainText('"type"');
  await toggle.press("Tab");
  await expect(rules).toBeFocused();
  await expect(page.getByText("Parsed item (JSON)", { exact: true })).toHaveCount(0);
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
});
