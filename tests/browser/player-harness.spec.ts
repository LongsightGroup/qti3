import { expect, test } from "@playwright/test";
import { interactionFixtures } from "../../packages/fixtures/src/index.js";
import {
  candidateVisibleItemXml,
  catalogDebugItemXml,
  companionMaterialsHostItemXml,
  companionMaterialsOverrideItemXml,
  mediaCatalogItemXml,
  stylesheetDebugItemXml,
} from "./harness-fixtures.js";
import {
  loadedItemIdentifier,
  loadFixture,
  pasteXml,
  selectFixtureById,
} from "./player-helpers.js";
import {
  getCatalogSupportResolution,
  getCompanionMaterialsResolution,
  loadPlayerUrlWithXml,
  loadPlayerXmlWithAssetPrefix,
  playerLocator,
  resolveCompanionMaterialsWithUrlPrefixes,
  serializePlayer,
} from "./player-test-api.js";

test.describe("manual harness", () => {
  test("does not render generic fieldset or legend wrappers around interactions", async ({
    page,
  }) => {
    await page.goto("/");

    for (const fixture of interactionFixtures) {
      await selectFixtureById(page, fixture.id);

      const player = playerLocator(page);
      await expect(player.locator("fieldset"), fixture.id).toHaveCount(0);
      await expect(player.locator("legend"), fixture.id).toHaveCount(0);
    }
  });
  test("does not render host scoring controls inside the item player", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "choice");

    const player = playerLocator(page);
    await expect(player.locator(".qti3-actions")).toHaveCount(0);
    await expect(player.getByRole("button", { name: "Score", exact: true })).toHaveCount(0);
    await expect(page.locator("#debug-score")).toHaveText("Score attempt");
  });
  test("shows dormant catalog metadata in the manual debugger", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, catalogDebugItemXml);

    await expect(page.locator("#debug-catalogs")).toContainText('"id": "term-help"');
    await expect(page.locator("#debug-catalogs")).toContainText('"support": "linguistic-guidance"');
    await expect(page.locator("#debug-catalogs")).toContainText("Accurate means correct.");
  });
  test("exposes resolved catalog supports for media alternatives", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, mediaCatalogItemXml);

    const resolution = await getCatalogSupportResolution(page, {
      supports: ["transcript", "audio-description", "sign-language"],
      languages: ["es", "ase"],
    });

    expect(resolution?.references.map((reference) => reference.idref)).toEqual([
      "audio-transcript",
      "video-alternatives",
    ]);
    expect(resolution?.references[0]?.matches).toEqual([
      expect.objectContaining({
        language: "es",
        support: "transcript",
        htmlContent: expect.objectContaining({ text: "Transcripción en español." }),
      }),
    ]);
    expect(resolution?.references[1]?.matches).toEqual([
      expect.objectContaining({
        support: "audio-description",
        fileHrefs: [
          expect.objectContaining({
            href: "audio/presentation-description.mp3",
            mimeType: "audio/mpeg",
          }),
        ],
      }),
      expect.objectContaining({
        language: "ase",
        support: "sign-language",
        htmlContent: expect.objectContaining({ text: "ASL interpretation clip." }),
      }),
    ]);
  });
  test("shows item stylesheet references in the manual debugger", async ({ page }) => {
    await page.goto("/");
    await pasteXml(page, stylesheetDebugItemXml);

    await expect(page.locator("#debug-stylesheets")).toContainText('"href": "style/item.css"');
    await expect(page.locator("#debug-stylesheets")).toContainText('"type": "text/css"');
    await expect(page.locator("#debug-stylesheets")).toContainText('"media": "screen"');
  });
  test("exposes resolved companion materials for host chrome", async ({ page }) => {
    await page.goto("/");
    await loadPlayerXmlWithAssetPrefix(
      page,
      companionMaterialsHostItemXml,
      "https://package.example/",
    );

    const resolution = await getCompanionMaterialsResolution(page);

    expect(resolution?.physicalMaterials).toEqual([
      expect.objectContaining({ text: "Bring a ruler." }),
    ]);
    expect(resolution?.digitalMaterials).toEqual([
      expect.objectContaining({
        fileHref: "materials/reference.txt",
        resolvedFileHref: "https://package.example/materials/reference.txt",
        label: "Reference card",
        mimeType: "text/plain",
        resourceIcon: "materials/reference.svg",
        resolvedResourceIcon: "https://package.example/materials/reference.svg",
      }),
    ]);
    await expect(page.locator("#debug-companion-materials")).toContainText(
      '"text": "Bring a ruler."',
    );
    await expect(page.locator("#debug-companion-materials")).toContainText(
      '"resolvedFileHref": "https://package.example/materials/reference.txt"',
    );
  });
  test("lets hosts override companion material asset resolution per call", async ({ page }) => {
    await page.goto("/");

    const resolution = await resolveCompanionMaterialsWithUrlPrefixes(
      page,
      companionMaterialsOverrideItemXml,
      "https://load.example/",
      "https://override.example/",
    );

    expect(resolution?.digitalMaterials[0]?.resolvedFileHref).toBe(
      "https://override.example/materials/reference.txt",
    );
  });
  test("shows accessibility proof and manual assistive technology scripts", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "associate");

    await expect(page.locator("#debug-a11y-proof")).toContainText(
      "associate accessibility contract",
    );
    await expect(page.locator("#debug-a11y-proof")).toContainText("Keyboard model");
    await expect(page.locator("#debug-a11y-proof")).toContainText(
      "Remove buttons delete selected pairs.",
    );
    await expect(page.locator("#debug-at-scripts")).toContainText("VoiceOver on macOS");
    await expect(page.locator("#debug-at-scripts")).toContainText("NVDA on Windows");
    await expect(page.locator("#debug-at-scripts")).toContainText("JAWS on Windows");
    await expect(page.locator("#debug-at-scripts ol li").first()).toContainText(
      "Navigate from the item body",
    );
  });
  test("does not render qti-assessment-item title metadata as candidate content", async ({
    page,
  }) => {
    await page.goto("/");
    await pasteXml(page, candidateVisibleItemXml);

    const player = playerLocator(page);
    await expect(player).toContainText("Candidate-visible item body.");
    await expect(player).not.toContainText("Internal Item Bank Title");
    await expect(player.locator("#qti3-item-title")).toHaveCount(0);
  });
  test("keeps manual harness load options in a native exclusive disclosure group", async ({
    page,
  }) => {
    await page.goto("/");

    const reference = page.locator("details.load-option").filter({ hasText: "Reference fixture" });
    const packageLoader = page.locator("#package-loader");
    const xmlLoader = page.locator("#xml-loader");
    await expect(reference).toHaveAttribute("open", "");
    await expect(packageLoader).not.toHaveAttribute("open", "");
    await expect(xmlLoader).not.toHaveAttribute("open", "");

    await packageLoader.locator("summary").click();
    await expect(packageLoader).toHaveAttribute("open", "");
    await expect(reference).not.toHaveAttribute("open", "");

    await xmlLoader.locator("summary").click();
    await expect(xmlLoader).toHaveAttribute("open", "");
    await expect(packageLoader).not.toHaveAttribute("open", "");

    await pasteXml(page, "<qti-assessment-item/>");
    await expect(xmlLoader).toHaveAttribute("open", "");
  });
  test("loads adjacent reference fixtures from the manual harness arrows", async ({ page }) => {
    await page.goto("/");

    const fixtureIds = await page
      .locator("#fixture option")
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value).filter(Boolean),
      );
    const firstFixtureId = fixtureIds[0];
    const secondFixtureId = fixtureIds[1];
    const previousLastFixtureId = fixtureIds.at(-2);
    const lastFixtureId = fixtureIds.at(-1);
    if (!firstFixtureId || !secondFixtureId || !previousLastFixtureId || !lastFixtureId) {
      throw new Error("Missing selectable fixtures.");
    }

    const player = playerLocator(page);
    const previousFixture = page.getByRole("button", { name: "Load previous fixture" });
    const nextFixture = page.getByRole("button", { name: "Load next fixture" });

    await expect(page.locator("#fixture")).toHaveValue(firstFixtureId);
    await expect(previousFixture).toBeDisabled();

    await nextFixture.click();
    await expect(page.locator("#fixture")).toHaveValue(secondFixtureId);
    await expect.poll(() => loadedItemIdentifier(player)).toBe(secondFixtureId);
    await expect(previousFixture).toBeEnabled();

    await page.locator("#fixture").selectOption(lastFixtureId);
    await expect(nextFixture).toBeDisabled();

    await previousFixture.click();
    await expect(page.locator("#fixture")).toHaveValue(previousLastFixtureId);
    await expect.poll(() => loadedItemIdentifier(player)).toBe(previousLastFixtureId);
    await expect(nextFixture).toBeEnabled();
  });
  test("honors load session controls and injected XML fetchers", async ({ page }) => {
    const fixture =
      interactionFixtures.find((item) => item.interactionType === "choice") ??
      interactionFixtures[0];
    if (!fixture) throw new Error("Missing choice fixture.");

    await page.goto("/");
    await loadPlayerUrlWithXml(page, "/items/choice.xml", fixture.xml, {
      status: "interacting",
      sessionControl: { validateResponses: false, showFeedback: false },
    });

    const loadedState = await serializePlayer(page);
    expect(loadedState?.status).toBe("interacting");

    await page.locator("#debug-score").click();
    const scoredState = await serializePlayer(page);
    expect(scoredState?.validationMessages).toEqual([]);
    await expect(page.locator("#events")).not.toContainText("response.required");
  });
});
