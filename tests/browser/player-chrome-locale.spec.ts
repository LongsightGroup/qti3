import { expect, test } from "@playwright/test";
import {
  assignMatch,
  expectResponse,
  loadFixture,
  setPlayerMessageCatalog,
} from "./player-helpers.js";
import {
  spanishPlayerMessageCatalog,
  swedishPlayerMessageCatalog,
} from "./catalogs/player-message-catalogs.fixture.js";

test.describe("player chrome locale", () => {
  test("localizes extended text counter from host catalog", async ({ page }) => {
    await page.goto("/");
    await setPlayerMessageCatalog(page, swedishPlayerMessageCatalog);
    await loadFixture(page, "extendedText");

    await page.locator("qti-assessment-item-player textarea").fill("Hej");
    await expect(page.locator("qti-assessment-item-player .qti3-counter")).toHaveText(
      "3 tecken, 1 ord",
    );
  });

  test("localizes match pair labels from host catalog", async ({ page }) => {
    await page.goto("/");
    await setPlayerMessageCatalog(page, swedishPlayerMessageCatalog);
    await loadFixture(page, "match");

    await assignMatch(page, "B", "G1");
    await expect(
      page.locator("qti-assessment-item-player .qti3-pair-chip span").first(),
    ).toHaveText("Outcome declaration med Candidate response value");
  });

  test("resolves language-of-interface from browser and attribute", async ({ page }) => {
    await page.goto("/");
    const browserLocale = await page.locator("qti-assessment-item-player").evaluate((element) => {
      const language = navigator.languages[0] ?? navigator.language;
      return {
        locale: (element as HTMLElement & { languageOfInterface: string }).languageOfInterface,
        expected: Intl.getCanonicalLocales(language)[0],
      };
    });
    expect(browserLocale.locale).toBe(browserLocale.expected);

    await setPlayerMessageCatalog(page, spanishPlayerMessageCatalog);
    await page.locator("qti-assessment-item-player").evaluate((element) => {
      element.setAttribute("language-of-interface", "es-MX");
    });
    const locale = await page
      .locator("qti-assessment-item-player")
      .evaluate(
        (element) => (element as HTMLElement & { languageOfInterface: string }).languageOfInterface,
      );
    expect(locale).toBe("es-MX");
  });

  test("keeps English chrome when only language-of-interface changes without a catalog", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator("qti-assessment-item-player").evaluate((element) => {
      element.setAttribute("language-of-interface", "de-DE");
    });
    await loadFixture(page, "graphicAssociate");

    const surface = page.locator("qti-assessment-item-player .qti3-graphic-associate-surface");
    await surface.getByRole("button", { name: "Item XML" }).click();
    await surface.getByRole("button", { name: "Response capture" }).click();

    const remove = page.getByRole("button", {
      name: "Remove Item XML to Response capture",
    });
    await expect(remove).toHaveAttribute("title", "Remove");
    await remove.click();
    await expectResponse(page, []);
  });
});
