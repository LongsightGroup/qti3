import { expect, test } from "@playwright/test";
import {
  clickAuthoredCoordinate,
  expectResponse,
  loadFixture,
  setPlayerMessageCatalog,
} from "./player-helpers.js";
import {
  germanPlayerMessageCatalog,
  spanishPlayerMessageCatalog,
  swedishPlayerMessageCatalog,
} from "./catalogs/player-message-catalogs.fixture.js";

test.describe("player graphic chrome locale", () => {
  test("localizes position object status from host catalog", async ({ page }) => {
    await page.goto("/");
    await setPlayerMessageCatalog(page, swedishPlayerMessageCatalog);
    await loadFixture(page, "positionObject");

    const stage = page.locator("qti-assessment-item-player .qti3-position-object-stage");
    await expect(stage.getByRole("button", { name: "Flyttbart objekt" })).toBeVisible();
    await clickAuthoredCoordinate(stage, 254, 210);
    await expect(page.locator("qti-assessment-item-player .qti3-coordinate-output")).toHaveText(
      "Objekt placerat vid 254 210",
    );
  });

  test("localizes hotspot selection summary from host catalog", async ({ page }) => {
    await page.goto("/");
    await setPlayerMessageCatalog(page, swedishPlayerMessageCatalog);
    await loadFixture(page, "hotspot");

    const surface = page.locator("qti-assessment-item-player .qti3-hotspot-surface");
    const hotspot = surface.getByRole("button", { name: "A" });
    await hotspot.click();
    await expect(page.locator("qti-assessment-item-player .qti3-selection-summary")).toHaveText(
      "Valt A",
    );
  });

  test("localizes graphic associate remove control from host catalog", async ({ page }) => {
    await page.goto("/");
    await setPlayerMessageCatalog(page, spanishPlayerMessageCatalog);
    await page.locator("qti-assessment-item-player").evaluate((element) => {
      element.setAttribute("language-of-interface", "es-MX");
    });
    await loadFixture(page, "graphicAssociate");

    const surface = page.locator("qti-assessment-item-player .qti3-graphic-associate-surface");
    await surface.getByRole("button", { name: "Item XML" }).click();
    await surface.getByRole("button", { name: "Response capture" }).click();

    const remove = page.getByRole("button", { name: "Eliminar Item XML con Response capture" });
    await expect(remove).toHaveAttribute("title", "Eliminar");
    await remove.click();
    await expectResponse(page, []);
  });

  test("localizes graphic associate chrome in German from host catalog", async ({ page }) => {
    await page.goto("/");
    await setPlayerMessageCatalog(page, germanPlayerMessageCatalog);
    await loadFixture(page, "graphicAssociate");

    const surface = page.locator("qti-assessment-item-player .qti3-graphic-associate-surface");
    await surface.getByRole("button", { name: "Item XML" }).click();
    await surface.getByRole("button", { name: "Response capture" }).click();

    const remove = page.getByRole("button", {
      name: "Item XML mit Response capture entfernen",
    });
    await expect(remove).toHaveAttribute("title", "Entfernen");
    await expect(page.locator("qti-assessment-item-player .qti3-selection-summary")).toHaveText(
      "1 Zuordnung erstellt.",
    );
  });
});
