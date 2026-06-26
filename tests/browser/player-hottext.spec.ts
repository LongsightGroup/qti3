import { expect, test } from "@playwright/test";
import { expectResponse, loadFixture, pasteXml } from "./player-helpers.js";

test.describe("player hottext interactions", () => {
  test("renders hottext choices as selectable inline passage text", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "hottext");

    const player = page.locator("qti-assessment-item-player");
    const passage = player.locator(".qti3-hottext-passage");
    await expect(passage).toContainText(
      "The city should convert the vacant lot on Pine Street into a pocket park.",
    );
    await expect(player.locator(".qti3-choice-option")).toHaveCount(0);

    const claim = "A small green space would give nearby residents a shaded place to gather";
    const token = player.locator('.qti3-hottext-token[data-choice-identifier="A"]');
    await expect(player.getByRole("button", { name: claim })).toBeVisible();
    await expect(token).toHaveText(claim);
    await token.click();
    await expect(token).toHaveAttribute("aria-pressed", "true");
    await expectResponse(page, "A");
  });

  test("keeps hottext punctuation attached to authored prose", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="hottext-punctuation" title="hottext-punctuation" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <qti-hottext-interaction response-identifier="RESPONSE">
            <qti-prompt>Select the term before the comma.</qti-prompt>
            <p>Select <qti-hottext identifier="A">Plan route</qti-hottext>, then continue.</p>
          </qti-hottext-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `,
    );

    const passage = page.locator("qti-assessment-item-player .qti3-hottext-passage");
    await expect(passage).toContainText("Select Plan route, then continue.");
  });
});
