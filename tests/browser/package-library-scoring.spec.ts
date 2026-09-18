import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { installAxe } from "./axe-helpers.js";
import { createItemPackageZip, qtiItemResource } from "./player-helpers.js";

const choice = readFileSync(
  "packages/fixtures/packages/basic-item-player/valid-item-only/items/choice.xml",
  "utf8",
);
const adaptive = readFileSync("packages/fixtures/xml/adaptive-feedback-reference.xml", "utf8");
const template =
  '<qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>';

async function importQuestions(page: Page, files: Record<string, string>): Promise<void> {
  const zip = createItemPackageZip({
    resources: Object.keys(files).map((path, index) => qtiItemResource(`item-${index}`, path)),
    files,
  });
  await page.getByLabel("Import package", { exact: true }).setInputFiles({
    name: "scoring.zip",
    mimeType: "application/zip",
    buffer: zip,
  });
  await expect(page.getByRole("status", { name: "Package library status" })).toContainText(
    "Reopened",
  );
}

test("submits through keyboard, validates blanks, scores both answers, and clears stale results", async ({
  page,
}) => {
  await page.goto("/library.html");
  const submit = page.getByRole("button", { name: "Submit response", exact: true });
  const reset = page.getByRole("button", { name: "Reset attempt", exact: true });
  const result = page.getByRole("status", { name: "Submission result" });
  await expect(submit).toBeDisabled();
  await expect(reset).toBeDisabled();
  await importQuestions(page, { "choice.xml": choice });
  await submit.focus();
  await submit.press("Enter");
  await expect(result).toContainText("Submission blocked.");
  await expect(page.locator("qti-assessment-item-player")).toContainText(
    "RESPONSE requires a response.",
  );
  await page.getByRole("radio", { name: "B. outcome declaration", exact: true }).check();
  await submit.click();
  await expect(result).toHaveText("Score: 0 points.");
  await page.getByText("Response and outcome details", { exact: true }).click();
  await expect(page.locator("#attempt-values")).toContainText('"RESPONSE": "B"');
  await page.getByRole("radio", { name: "A. response declaration", exact: true }).check();
  await expect(result).toContainText("Response changed.");
  await expect(page.locator("#attempt-values")).toHaveText("No submission yet.");
  await submit.focus();
  await submit.press("Enter");
  await expect(result).toHaveText("Score: 1 point.");
  await expect(page.locator("#attempt-values")).toContainText('"SCORE": 1');
  await expect(result).toHaveAttribute("aria-live", "polite");
  await installAxe(page);
  expect(
    await page.evaluate(async () => {
      if (!window.axe) throw new Error("axe unavailable");
      return (await window.axe.run(document.documentElement)).violations;
    }),
  ).toEqual([]);
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.emulateMedia({ forcedColors: "active" });
  await reset.focus();
  expect(await reset.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe(
    "none",
  );
  await reset.press("Enter");
  await expect(submit).toBeFocused();
  await expect(result).toContainText("Attempt reset.");
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
});

test("shows partial credit, the authored maximum, outcomes, and authored feedback", async ({
  page,
}) => {
  const mapped = choice
    .replace(
      "</qti-response-declaration>",
      `
    <qti-mapping default-value="0"><qti-map-entry map-key="A" mapped-value="2"/><qti-map-entry map-key="B" mapped-value="0.5"/></qti-mapping>
    </qti-response-declaration>`,
    )
    .replace('base-type="float"/>', 'base-type="float" normal-maximum="2"/>')
    .replace(
      "<qti-item-body>",
      '<qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier"/><qti-item-body>',
    )
    .replace(
      template,
      `<qti-response-processing>
      <qti-set-outcome-value identifier="SCORE"><qti-map-response identifier="RESPONSE"/></qti-set-outcome-value>
      <qti-set-outcome-value identifier="FEEDBACK"><qti-base-value base-type="identifier">review</qti-base-value></qti-set-outcome-value>
      </qti-response-processing>
      <qti-modal-feedback identifier="review" outcome-identifier="FEEDBACK" show-hide="show"><qti-content-body>Review the declaration types.</qti-content-body></qti-modal-feedback>`,
    );
  await page.goto("/library.html");
  await importQuestions(page, { "partial.xml": mapped });
  await page.getByRole("radio", { name: "B. outcome declaration", exact: true }).check();
  await page.getByRole("button", { name: "Submit response", exact: true }).click();
  await expect(page.getByRole("status", { name: "Submission result" })).toHaveText(
    "Score: 0.5 / 2 points.",
  );
  await expect(page.getByText("Review the declaration types.", { exact: true })).toBeVisible();
  await page.getByText("Response and outcome details", { exact: true }).click();
  await expect(page.locator("#attempt-values")).toContainText('"FEEDBACK": "review"');
});

test("does not mistake an initialized zero for an automatic score and preserves custom outcomes", async ({
  page,
}) => {
  const unscored = choice.replace(template, "");
  const custom = choice
    .replace(
      'identifier="SCORE" cardinality="single" base-type="float"',
      'identifier="GRADE" cardinality="single" base-type="string"',
    )
    .replace(
      template,
      '<qti-response-processing><qti-set-outcome-value identifier="GRADE"><qti-base-value base-type="string">Reviewed</qti-base-value></qti-set-outcome-value></qti-response-processing>',
    );
  await page.goto("/library.html");
  await importQuestions(page, { "unscored.xml": unscored, "custom.xml": custom });
  const result = page.getByRole("status", { name: "Submission result" });
  await page.getByRole("radio", { name: "A. response declaration", exact: true }).check();
  await page.getByRole("button", { name: "Submit response", exact: true }).click();
  await expect(result).toHaveText("Submitted. This question has no automatic response processing.");
  await page.getByLabel("Question", { exact: true }).selectOption("1");
  await expect(result).toHaveText("Submit response to see your score.");
  await page.getByRole("radio", { name: "A. response declaration", exact: true }).check();
  await page.getByRole("button", { name: "Submit response", exact: true }).click();
  await expect(result).toContainText("No numeric SCORE was returned.");
  await page.getByText("Response and outcome details", { exact: true }).click();
  await expect(page.locator("#attempt-values")).toContainText('"GRADE": "Reviewed"');
});

test("handles item-triggered scoring, adaptive retries, completion, and reset", async ({
  page,
}) => {
  await page.goto("/library.html");
  await importQuestions(page, { "adaptive.xml": adaptive });
  const submit = page.getByRole("button", { name: "Submit response", exact: true });
  const result = page.getByRole("status", { name: "Submission result" });
  await page.getByRole("radio", { name: /^B\./ }).check();
  await page.getByRole("button", { name: "Show hint", exact: true }).click();
  await expect(result).toHaveText("Score: 0 points.");
  await expect(page.getByText(/^Hint: Compare the rows/)).toBeVisible();
  await expect(submit).toBeEnabled();
  await page.getByRole("radio", { name: /^A\./ }).check();
  await submit.click();
  await expect(result).toHaveText("Score: 1 point.");
  await expect(submit).toBeDisabled();
  await page.getByRole("button", { name: "Reset attempt", exact: true }).click();
  await expect(submit).toBeEnabled();
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
});

test("reports processing errors instead of presenting an initialized score as valid", async ({
  page,
}) => {
  const xml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="pattern" title="Pattern" time-dependent="false">
    <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
    <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
    <qti-outcome-declaration identifier="MATCH" cardinality="single" base-type="boolean"/>
    <qti-item-body><p>Pattern: <qti-text-entry-interaction response-identifier="RESPONSE"/></p></qti-item-body>
    <qti-response-processing><qti-set-outcome-value identifier="MATCH"><qti-pattern-match pattern="{RESPONSE}"><qti-base-value base-type="string">example</qti-base-value></qti-pattern-match></qti-set-outcome-value></qti-response-processing>
    </qti-assessment-item>`;
  await page.goto("/library.html");
  await importQuestions(page, { "pattern.xml": xml });
  await page.getByRole("textbox").fill("[");
  await page.getByRole("button", { name: "Submit response", exact: true }).click();
  await expect(page.getByRole("status", { name: "Submission result" })).toContainText(
    "Scoring failed.",
  );
  await page.getByText("Response and outcome details", { exact: true }).click();
  await expect(page.locator("#attempt-values")).toContainText("processing.pattern.syntax");
});

test("clears scores when switching, reopening, or deleting packages", async ({ page }) => {
  await page.goto("/library.html");
  await importQuestions(page, {
    "first.xml": choice,
    "second.xml": choice.replaceAll("basic-choice", "second-choice"),
  });
  const submit = page.getByRole("button", { name: "Submit response", exact: true });
  const result = page.getByRole("status", { name: "Submission result" });
  await page.getByRole("radio", { name: "A. response declaration", exact: true }).check();
  await submit.click();
  await expect(result).toHaveText("Score: 1 point.");
  await page.getByLabel("Question", { exact: true }).selectOption("1");
  await expect(result).toHaveText("Submit response to see your score.");
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  const savedId = await page.getByLabel("Saved package", { exact: true }).inputValue();
  await page.reload();
  await expect(submit).toBeDisabled();
  await page.getByLabel("Saved package", { exact: true }).selectOption(savedId);
  await expect(result).toHaveText("Submit response to see your score.");
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Delete package", exact: true }).click();
  await expect(submit).toBeDisabled();
  await expect(page.getByRole("button", { name: "Reset attempt", exact: true })).toBeDisabled();
  await expect(result).toHaveText("Select a question to begin.");
});
