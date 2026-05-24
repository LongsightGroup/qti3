import { expect, test } from "@playwright/test";
import { interactionFixtures } from "../../packages/fixtures/src/index.js";
import { loadFixture, pasteXml } from "./player-helpers.js";

test.describe("player lifecycle", () => {
  test("supports host lifecycle methods for state restore and attempt control", async ({
    page,
  }) => {
    const fixture =
      interactionFixtures.find((item) => item.interactionType === "choice") ??
      interactionFixtures[0];
    if (!fixture) throw new Error("Missing choice fixture.");

    await page.goto("/");
    await pasteXml(page, fixture.xml);
    await page.locator('qti-assessment-item-player [data-choice-identifier="A"] input').check();

    const answeredState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(answeredState.responses.RESPONSE).toBe("A");
    expect(answeredState.status).toBe("interacting");

    const resetState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      element.reset();
      return element.serialize();
    });
    expect(resetState.responses.RESPONSE).toBeUndefined();
    expect(resetState.status).toBe("initialized");

    const lifecycle = await page
      .locator("qti-assessment-item-player")
      .evaluate((element, state) => {
        const events: string[] = [];
        for (const eventName of ["qti-restore", "qti-suspend", "qti-endattempt"]) {
          element.addEventListener(eventName, () => events.push(eventName));
        }
        element.restore(state);
        const restored = element.serialize();
        element.suspend();
        const suspended = element.serialize();
        element.endAttempt();
        const completed = element.serialize();
        return { events, restored, suspended, completed };
      }, answeredState);

    expect(lifecycle.events).toEqual(["qti-restore", "qti-suspend", "qti-endattempt"]);
    expect(lifecycle.restored.status).toBe("interacting");
    expect(lifecycle.suspended.status).toBe("suspended");
    expect(lifecycle.completed.status).toBe("completed");
    const restoredState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(restoredState.responses.RESPONSE).toBe("A");
    expect(restoredState.outcomes.SCORE).toBe(1);
  });

  test("end-attempt interaction writes its boolean response and reveals adaptive feedback", async ({
    page,
  }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="hint-end" title="hint-end" adaptive="true" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-response-declaration identifier="HINTREQUEST" cardinality="single" base-type="boolean"/>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <p>Use the hint control to request adaptive feedback.</p>
    <qti-choice-interaction response-identifier="RESPONSE" min-choices="0">
      <qti-simple-choice identifier="A">Correct</qti-simple-choice>
      <qti-simple-choice identifier="B">Incorrect</qti-simple-choice>
    </qti-choice-interaction>
    <qti-end-attempt-interaction response-identifier="HINTREQUEST" title="Show Hint"/>
    <qti-feedback-block identifier="HINT" outcome-identifier="FEEDBACK" show-hide="show">
      <qti-content-body><p>Hint feedback is now visible.</p></qti-content-body>
    </qti-feedback-block>
  </qti-item-body>
  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-variable identifier="HINTREQUEST"/>
        <qti-set-outcome-value identifier="FEEDBACK">
          <qti-base-value base-type="identifier">HINT</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-if>
    </qti-response-condition>
    <qti-response-condition>
      <qti-response-if>
        <qti-match><qti-variable identifier="RESPONSE"/><qti-correct identifier="RESPONSE"/></qti-match>
        <qti-set-outcome-value identifier="SCORE">
          <qti-base-value base-type="float">1</qti-base-value>
        </qti-set-outcome-value>
        <qti-set-outcome-value identifier="completionStatus">
          <qti-base-value base-type="identifier">completed</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-if>
    </qti-response-condition>
  </qti-response-processing>
</qti-assessment-item>`;

    await page.goto("/");
    await pasteXml(page, xml);
    await page.getByRole("button", { name: "Show Hint" }).click();

    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(state.responses.HINTREQUEST).toBe(true);
    expect(state.outcomes.FEEDBACK).toBe("HINT");
    expect(state.status).toBe("interacting");
    await expect(page.locator("qti-assessment-item-player .qti3-feedback-block")).toContainText(
      "Hint feedback is now visible.",
    );

    await page.locator('qti-assessment-item-player [data-choice-identifier="A"] input').check();
    await page.locator("#debug-score").click();

    const completedState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(completedState.outcomes.completionStatus).toBe("completed");
    expect(completedState.status).toBe("completed");
  });

  test("end-attempt does not complete an invalid attempt", async ({ page }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="blocked-end" title="blocked-end" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-response-declaration identifier="END" cardinality="single" base-type="boolean"/>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE">
      <qti-simple-choice identifier="A">Correct</qti-simple-choice>
      <qti-simple-choice identifier="B">Incorrect</qti-simple-choice>
    </qti-choice-interaction>
    <qti-end-attempt-interaction response-identifier="END" title="Finish"/>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`;

    await page.goto("/");
    await pasteXml(page, xml);
    await page.getByRole("button", { name: "Finish" }).click();

    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(state.responses.END).toBe(true);
    expect(state.status).toBe("interacting");
    expect(state.validationMessages).toEqual([
      expect.objectContaining({ code: "response.required", path: "RESPONSE" }),
    ]);
    await expect(page.locator("#score-status")).toHaveText(
      "Score blocked by 1 validation message.",
    );

    const restoredState = await page
      .locator("qti-assessment-item-player")
      .evaluate((element, attemptState) => {
        element.reset();
        element.restore(attemptState);
        attemptState.validationMessages[0]!.message = "mutated after restore";
        return element.serialize();
      }, state);
    await expect(
      page.locator('qti-assessment-item-player [data-choice-identifier="A"] input'),
    ).toHaveAttribute("aria-invalid", "true");
    expect(restoredState.validationMessages).toEqual(state.validationMessages);
  });

  test("response state events preserve remaining restored validation messages", async ({
    page,
  }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="multi-validation" title="multi-validation" time-dependent="false">
  <qti-response-declaration identifier="FIRST" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-response-declaration identifier="SECOND" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>C</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <p>Answer both required choices.</p>
    <qti-choice-interaction response-identifier="FIRST">
      <qti-simple-choice identifier="A">First answer</qti-simple-choice>
      <qti-simple-choice identifier="B">Other first answer</qti-simple-choice>
    </qti-choice-interaction>
    <qti-choice-interaction response-identifier="SECOND">
      <qti-simple-choice identifier="C">Second answer</qti-simple-choice>
      <qti-simple-choice identifier="D">Other second answer</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`;

    await page.goto("/");
    await pasteXml(page, xml);
    await page.locator("#debug-score").click();

    const blockedState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(blockedState.validationMessages.map((message) => message.path)).toEqual([
      "FIRST",
      "SECOND",
    ]);

    const emittedState = await page
      .locator("qti-assessment-item-player")
      .evaluate(async (element, attemptState) => {
        element.reset();
        element.restore(attemptState);
        const nextState = new Promise((resolve) => {
          element.addEventListener("qti-statechange", (event) => resolve(event.detail.state), {
            once: true,
          });
        });
        const firstChoice = element.querySelector<HTMLInputElement>(
          '[data-response-identifier="FIRST"] [data-choice-identifier="A"] input',
        );
        if (!firstChoice) throw new Error("Missing first choice control.");
        firstChoice.click();
        return nextState;
      }, blockedState);

    expect(emittedState.responses.FIRST).toBe("A");
    expect(emittedState.validationMessages).toEqual([
      expect.objectContaining({ code: "response.required", path: "SECOND" }),
    ]);
  });

  test("completed attempts render as non-mutable review state", async ({ page }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="completed-review" title="completed-review" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-response-declaration identifier="END" cardinality="single" base-type="boolean"/>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE">
      <qti-simple-choice identifier="A">Correct</qti-simple-choice>
      <qti-simple-choice identifier="B">Incorrect</qti-simple-choice>
    </qti-choice-interaction>
    <qti-end-attempt-interaction response-identifier="END" title="Finish"/>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`;

    await page.goto("/");
    await pasteXml(page, xml);
    await page.locator('qti-assessment-item-player [data-choice-identifier="A"] input').check();
    await page.getByRole("button", { name: "Finish" }).click();

    await expect(page.locator("qti-assessment-item-player")).toHaveAttribute(
      "data-status",
      "completed",
    );
    await expect(
      page.locator('qti-assessment-item-player [data-choice-identifier="A"] input'),
    ).toBeDisabled();
    await expect(
      page.locator('qti-assessment-item-player [data-choice-identifier="B"] input'),
    ).toBeDisabled();
    await expect(
      page.locator('qti-assessment-item-player [data-interaction-type="endAttempt"] button'),
    ).toBeDisabled();
    await expect(page.locator("qti-assessment-item-player .qti3-actions")).toHaveCount(0);

    const completedState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(completedState.responses.RESPONSE).toBe("A");

    const restoredCompletedState = await page
      .locator("qti-assessment-item-player")
      .evaluate((element, state) => {
        element.reset();
        element.restore(state);
        const choice = element.querySelector<HTMLInputElement>(
          '[data-choice-identifier="B"] input',
        );
        choice?.click();
        return element.serialize();
      }, completedState);
    expect(restoredCompletedState.responses.RESPONSE).toBe("A");
    await expect(
      page.locator('qti-assessment-item-player [data-choice-identifier="A"] input'),
    ).toBeDisabled();
    await expect(
      page.locator('qti-assessment-item-player [data-choice-identifier="B"] input'),
    ).toBeDisabled();

    await page.locator("#debug-reset").click();
    await expect(page.locator("qti-assessment-item-player")).toHaveAttribute(
      "data-status",
      "initialized",
    );
    await expect(
      page.locator('qti-assessment-item-player [data-choice-identifier="B"] input'),
    ).toBeEnabled();
  });

  test("restores serialized responses into visible controls", async ({ page }) => {
    await page.goto("/");
    const restoreCurrentAttempt = async () => {
      const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
        return element.serialize();
      });
      await page.locator("qti-assessment-item-player").evaluate((element, attemptState) => {
        element.reset();
        element.restore(attemptState);
      }, state);
    };

    await loadFixture(page, "choice");
    await page.locator('qti-assessment-item-player [data-choice-identifier="A"] input').check();
    await restoreCurrentAttempt();
    await expect(
      page.locator('qti-assessment-item-player [data-choice-identifier="A"] input'),
    ).toBeChecked();
    await expect(
      page.locator('qti-assessment-item-player .qti3-choice-option[data-choice-identifier="A"]'),
    ).toHaveAttribute("data-selected", "true");

    await loadFixture(page, "textEntry");
    await page
      .locator('qti-assessment-item-player input:not([type="file"]):not([type="range"])')
      .fill("SCORE");
    await restoreCurrentAttempt();
    await expect(
      page.locator('qti-assessment-item-player input:not([type="file"]):not([type="range"])'),
    ).toHaveValue("SCORE");
    await expect(page.locator("qti-assessment-item-player .qti3-inline-counter")).toHaveCount(0);

    await loadFixture(page, "order");
    await page
      .locator('qti-assessment-item-player .qti3-reorder-handle[data-choice-identifier="B"]')
      .focus();
    await page.keyboard.press("ArrowUp");
    await restoreCurrentAttempt();
    await expect(
      page.locator("qti-assessment-item-player .qti3-reorder-item").first(),
    ).toHaveAttribute("data-choice-identifier", "B");

    await loadFixture(page, "hotspot");
    await page
      .locator("qti-assessment-item-player .qti3-hotspot-surface")
      .getByRole("button", { name: "A" })
      .click();
    await restoreCurrentAttempt();
    await expect(
      page.locator("qti-assessment-item-player .qti3-hotspot-button[data-choice-identifier='A']"),
    ).toHaveAttribute("data-selected", "true");
    await expect(page.locator("qti-assessment-item-player .qti3-selection-summary")).toContainText(
      "Selected A",
    );
  });
});
