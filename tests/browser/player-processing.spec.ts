import { expect, test } from "@playwright/test";
import { processingFixtures } from "../../packages/fixtures/src/index.js";
import {
  formatRandomIntegerTemplatePrompt,
  RANDOM_INTEGER_TEMPLATE_REFERENCE_VALUES,
} from "../../packages/fixtures/src/random-integer-template.fixture.js";
import { TEMPLATE_PROCESSING_CORRECT_RESPONSE } from "../../packages/fixtures/src/template-processing.fixture.js";

async function loadCanonicalFixture(page: import("@playwright/test").Page, fixtureId: string) {
  await page.locator("#fixture").selectOption(fixtureId);
  await page.locator("#load-fixture").click();
}

async function expectDebugTemplateValues(
  page: import("@playwright/test").Page,
  templateValues: Record<string, number>,
): Promise<void> {
  for (const [identifier, value] of Object.entries(templateValues)) {
    await expect(page.locator("#debug-template-values")).toContainText(
      `"${identifier}": ${JSON.stringify(value)}`,
    );
  }
}

test.describe("processing fixtures", () => {
  test("loads template-processing reference from the picker", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("#fixture optgroup[label='Processing references']")).toHaveCount(1);

    const fixture = processingFixtures.find((item) => item.id === "template-processing-reference");
    if (!fixture) throw new Error("Missing template-processing-reference fixture.");

    await loadCanonicalFixture(page, fixture.id);
    await expect(page.locator("qti-assessment-item-player")).toContainText(
      "Template processing generates the correct numeric response before delivery.",
    );
    await expectDebugTemplateValues(page, {
      BASE: 2,
      ANSWER: TEMPLATE_PROCESSING_CORRECT_RESPONSE,
    });
  });

  test("loads random-integer template reference from the picker", async ({ page }) => {
    await page.goto("/");

    const fixture = processingFixtures.find(
      (item) => item.id === "random-integer-template-reference",
    );
    if (!fixture) throw new Error("Missing random-integer-template-reference fixture.");

    await loadCanonicalFixture(page, fixture.id);
    await expect(page.locator("qti-assessment-item-player")).toContainText(
      formatRandomIntegerTemplatePrompt(),
    );
    await expectDebugTemplateValues(page, RANDOM_INTEGER_TEMPLATE_REFERENCE_VALUES);
  });
});
