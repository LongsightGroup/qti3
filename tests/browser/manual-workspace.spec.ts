import { expect, test } from "@playwright/test";
import { installAxe } from "./axe-helpers.js";
import { loadFixture, pasteXml, selectFixtureById, waitForPlayerLoad } from "./player-helpers.js";

test("inspection tabs expose one panel and support keyboard navigation", async ({ page }) => {
  await page.goto("/");
  await loadFixture(page, "choice");
  const responses = page.getByRole("tab", { name: "Responses", exact: true });
  await responses.focus();
  await responses.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Outcomes", exact: true })).toBeFocused();
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await expect(page.getByRole("tabpanel")).toContainText('"SCORE": 0');
  await expect(responses).toHaveAttribute("tabindex", "-1");
  await page.getByRole("tab", { name: "Outcomes", exact: true }).press("End");
  await expect(page.getByRole("tab", { name: "Accessibility", exact: true })).toBeFocused();
  await page.getByRole("tab", { name: "Accessibility", exact: true }).press("ArrowRight");
  await expect(responses).toBeFocused();
  await responses.press("ArrowLeft");
  await expect(page.getByRole("tab", { name: "Accessibility", exact: true })).toBeFocused();
  await page.getByRole("tab", { name: "Accessibility", exact: true }).press("Home");
  await expect(responses).toBeFocused();
  await page.getByRole("tab", { name: "XML", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText('identifier="choice-reference"');
  await page.getByRole("tab", { name: "Events", exact: true }).click();
  await expect(page.getByText("Action log", { exact: true })).toBeVisible();
  await expect(page.locator("#debug-action-log")).not.toBeVisible();
});

test("flight guidance explains partial credit and clears after reset or another item", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await waitForPlayerLoad(page);
  await selectFixtureById(page, "challenge-flight-order");
  await page.locator("#challenge-guide summary").click();
  await expect(page.locator("#challenge-examples")).toContainText(
    "Ignition, Enter orbit, Liftoff, Landing: 2 points.",
  );
  for (const identifier of ["LANDING", "LIFTOFF", "ORBIT", "IGNITION"]) {
    const handle = page.locator(`.qti3-reorder-handle[data-choice-identifier="${identifier}"]`);
    for (let move = 0; move < 3; move++) await handle.press("ArrowUp");
  }
  await page.locator("#debug-score").click();
  await expect(page.locator("#challenge-result")).toHaveText(
    "2 of 4 stages are in the correct position.",
  );
  await expect(page.locator("#score-value")).toHaveText("2");
  await page
    .locator(".player-stage")
    .screenshot({ path: testInfo.outputPath("flight-workspace.png") });
  await page.locator("#debug-reset").click();
  await expect(page.locator("#challenge-result")).toBeEmpty();
  await expect(page.locator("#score-status")).toHaveText("Not scored yet.");
  await loadFixture(page, "choice");
  await expect(page.locator("#challenge-guide")).not.toBeVisible();
  const customXml = (await page.locator("#xml").inputValue()).replaceAll(
    "choice-reference",
    "constructor",
  );
  await pasteXml(page, customXml);
  await expect(page.locator("#challenge-guide")).not.toBeVisible();
  await page.locator('qti-assessment-item-player [data-choice-identifier="A"] input').check();
  await page.locator("#debug-score").click();
  await expect(page.locator("#score-status")).toHaveText("Scored successfully.");
});

test("integration entry navigates to the separate installation guide", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Use in your app", exact: true }).click();
  await expect(page).toHaveURL(/\/integration\.html$/);
  await expect(
    page.getByRole("heading", { name: "Use qti3 in your app", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#integration")).toContainText("pnpm add @longsightgroup/qti3-player");
  await expect(page.locator("#integration")).toContainText("defineQtiAssessmentItemPlayer();");
  await expect(page.locator("#integration")).toContainText("player.loadXml(await response.text())");
  await expect(page.locator("#integration")).toContainText("player.scoreAttempt()");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Use qti3 in your app", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.getByRole("link", { name: "Return to the interactive manual", exact: true }).click();
  await expect(page).toHaveURL(/\/#manual$/);
});

test("workspace keeps host scoring after the item and reflows with accessible tabs", async ({
  page,
}) => {
  await page.goto("/");
  await loadFixture(page, "choice");
  const geometry = await page.locator(".player-stage").evaluate((stage) => {
    const player = stage.querySelector("qti-assessment-item-player")?.getBoundingClientRect();
    const result = stage.querySelector("#score-panel")?.getBoundingClientRect();
    return { itemBottom: player?.bottom, resultTop: result?.top };
  });
  if (geometry.itemBottom === undefined || geometry.resultTop === undefined)
    throw new Error("Missing player/result geometry");
  expect(geometry.resultTop).toBeGreaterThanOrEqual(geometry.itemBottom);
  await expect(page.locator("#pnp-xml")).not.toBeVisible();
  await installAxe(page);
  const violations = await page.evaluate(async () => {
    if (!window.axe) throw new Error("Missing axe");
    return (await window.axe.run(document.querySelector(".inspector"))).violations;
  });
  expect(violations).toEqual([]);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.getByRole("tab", { name: "Accessibility", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toHaveAccessibleName("Accessibility");
});
