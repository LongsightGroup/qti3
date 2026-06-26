import { expect, test } from "@playwright/test";
import {
  assignMatch,
  expectResponse,
  loadFixture,
  pasteXml,
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
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="extended-text-counter-locale" title="extended-text-counter-locale" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
  <qti-item-body>
    <qti-extended-text-interaction response-identifier="RESPONSE" class="qti-counter-up" expected-length="10"/>
  </qti-item-body>
</qti-assessment-item>`,
    );

    await page.locator("qti-assessment-item-player textarea").fill("Hej");
    await expect(page.locator("qti-assessment-item-player .qti3-counter")).toHaveText("3 av 10");
  });

  test("localizes match pair remove labels from host catalog", async ({ page }) => {
    await page.goto("/");
    await setPlayerMessageCatalog(page, spanishPlayerMessageCatalog);
    await loadFixture(page, "match");

    await assignMatch(page, "B", "G1");
    await expect(
      page.locator("qti-assessment-item-player .qti3-pair-chip span").first(),
    ).toHaveText(
      "Uncovered beds had more weeds by the third week. to Mulch helped reduce water loss from the soil.",
    );
    await expect(
      page.getByRole("button", {
        name: "Eliminar Uncovered beds had more weeds by the third week. con Mulch helped reduce water loss from the soil.",
      }),
    ).toBeVisible();
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
    await surface.getByRole("button", { name: "Plan sampling route" }).click();
    await surface.getByRole("button", { name: "Collect water data" }).click();

    const remove = page.getByRole("button", {
      name: "Remove Plan sampling route to Collect water data",
    });
    await expect(remove).toHaveAttribute("title", "Remove");
    await remove.click();
    await expectResponse(page, []);
  });
});
