import { expect, test } from "@playwright/test";
import { pasteXml } from "./player-helpers.js";

test.describe("player feedback", () => {
  test("renders outcome-gated modal feedback after scoring", async ({ page }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="feedback" title="feedback" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
      <qti-simple-choice identifier="B">B</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-match>
          <qti-variable identifier="RESPONSE"/>
          <qti-correct identifier="RESPONSE"/>
        </qti-match>
        <qti-set-outcome-value identifier="FEEDBACK">
          <qti-base-value base-type="identifier">correct</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-if>
      <qti-response-else>
        <qti-set-outcome-value identifier="FEEDBACK">
          <qti-base-value base-type="identifier">incorrect</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-else>
    </qti-response-condition>
  </qti-response-processing>
  <qti-modal-feedback outcome-identifier="FEEDBACK" identifier="correct" show-hide="show">Correct feedback.</qti-modal-feedback>
  <qti-modal-feedback outcome-identifier="FEEDBACK" identifier="incorrect" show-hide="show">Incorrect feedback.</qti-modal-feedback>
</qti-assessment-item>`;

    await page.goto("/");
    await pasteXml(page, xml);
    await page.getByRole("radio", { name: "A" }).check();
    await page.locator("#debug-score").click();

    const feedback = page.locator("qti-assessment-item-player .qti3-feedback");
    await expect(feedback).toBeVisible();
    await expect(feedback).toContainText("Correct feedback.");
    await expect(feedback).not.toContainText("Incorrect feedback.");
    await expect(feedback).toHaveAttribute("aria-live", "polite");
  });

  test("renders printed variables and body feedback from current outcomes", async ({ page }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="body-feedback" title="body-feedback" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <p>Choose the correct response.</p>
    <qti-choice-interaction response-identifier="RESPONSE">
      <qti-simple-choice identifier="A">Correct</qti-simple-choice>
      <qti-simple-choice identifier="B">Incorrect</qti-simple-choice>
    </qti-choice-interaction>
    <p>Current score: <qti-printed-variable identifier="SCORE" format="%.2f"/></p>
    <qti-feedback-block outcome-identifier="FEEDBACK" identifier="correct" show-hide="show">
      <qti-content-body><p>Body feedback is now visible.</p></qti-content-body>
    </qti-feedback-block>
  </qti-item-body>
  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-match><qti-variable identifier="RESPONSE"/><qti-correct identifier="RESPONSE"/></qti-match>
        <qti-set-outcome-value identifier="SCORE"><qti-base-value base-type="float">1</qti-base-value></qti-set-outcome-value>
        <qti-set-outcome-value identifier="FEEDBACK"><qti-base-value base-type="identifier">correct</qti-base-value></qti-set-outcome-value>
      </qti-response-if>
    </qti-response-condition>
  </qti-response-processing>
</qti-assessment-item>`;

    await page.goto("/");
    await pasteXml(page, xml);
    await expect(
      page.locator('qti-assessment-item-player .qti3-printed-variable[data-identifier="SCORE"]'),
    ).toHaveText("0.00");
    await expect(page.locator("qti-assessment-item-player .qti3-feedback-block")).toBeHidden();
    await expect(page.getByRole("radio", { name: "A. Correct" })).toHaveCount(1);
    await expect(page.getByRole("radio", { name: "Correct", exact: true })).toHaveCount(0);

    await page.getByRole("radio", { name: "A. Correct" }).check();
    await page.locator("#debug-score").click();

    await expect(
      page.locator('qti-assessment-item-player .qti3-printed-variable[data-identifier="SCORE"]'),
    ).toHaveText("1.00");
    await expect(page.locator("qti-assessment-item-player .qti3-feedback-block")).toContainText(
      "Body feedback is now visible.",
    );
  });
});
