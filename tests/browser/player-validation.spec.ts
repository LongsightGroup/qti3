import { expect, test } from "@playwright/test";
import { interactionFixtures } from "../../packages/fixtures/src/index.js";
import { expectResponse, pasteXml } from "./player-helpers.js";

test.describe("player validation", () => {
  test("associates validation messages with unanswered controls", async ({ page }) => {
    const fixture =
      interactionFixtures.find((item) => item.interactionType === "choice") ??
      interactionFixtures[0];
    if (!fixture) throw new Error("Missing choice fixture.");

    await page.goto("/");
    await pasteXml(page, fixture.xml);
    await page.locator("#debug-score").click();
    await expect(page.locator("#score-panel")).toHaveAttribute("data-status", "blocked");
    await expect(page.locator("#score-status")).toContainText("Score blocked");
    await expect(page.locator("#validation-count")).toHaveText("1");

    const radio = page.locator('qti-assessment-item-player [data-choice-identifier="A"] input');
    await expect(radio).toHaveAttribute("aria-invalid", "true");
    const describedBy = await radio.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`#${describedBy}`)).toContainText("RESPONSE requires a response.");
    await expect(page.locator("#events")).toContainText("response.required");

    await radio.check();
    await expect(radio).not.toHaveAttribute("aria-invalid", "true");
  });

  test("can bypass response validation when scoring or ending an attempt", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="validation-bypass" title="validation-bypass" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-outcome-declaration identifier="MAXSCORE" cardinality="single" base-type="float">
    <qti-default-value><qti-value>1</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" min-choices="1">
      <qti-simple-choice identifier="A">Correct</qti-simple-choice>
      <qti-simple-choice identifier="B">Incorrect</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`,
    );

    const blocked = await page.locator("qti-assessment-item-player").evaluate((element) => {
      const validationEvents: Array<{
        validationMessages: unknown[];
        state: { validationMessages: unknown[]; outcomes: Record<string, unknown> };
      }> = [];
      element.addEventListener("qti-validation", (event) => {
        validationEvents.push((event as CustomEvent).detail);
      });
      return {
        blocked: element.scoreAttempt() === undefined,
        validationDetail: validationEvents[0],
        state: element.serialize(),
      };
    });
    expect(blocked.blocked).toBe(true);
    expect(blocked.validationDetail.validationMessages).toEqual([
      expect.objectContaining({ code: "response.required", path: "RESPONSE" }),
    ]);
    expect(blocked.validationDetail.state.validationMessages).toEqual(
      blocked.validationDetail.validationMessages,
    );
    expect(blocked.state.validationMessages).toEqual(blocked.validationDetail.validationMessages);
    expect(blocked.validationDetail.state.outcomes.MAXSCORE).toBe(1);

    const scored = await page.locator("qti-assessment-item-player").evaluate((element) => {
      const scoreEvents: Array<{ state: { validationMessages: unknown[] } }> = [];
      element.addEventListener("qti-score", (event) => {
        scoreEvents.push((event as CustomEvent).detail);
      });
      return {
        result: element.scoreAttempt({ validateResponses: false }),
        scoreDetail: scoreEvents[0],
        state: element.serialize(),
      };
    });
    expect(scored.result.outcomes.SCORE).toBe(0);
    expect(scored.result.state.outcomes.MAXSCORE).toBe(1);
    expect(typeof scored.result.state.outcomes.MAXSCORE).toBe("number");
    expect(scored.result.state.validationMessages).toEqual([]);
    expect(scored.scoreDetail.state.validationMessages).toEqual([]);
    expect(scored.state.validationMessages).toEqual([]);

    const ended = await page.locator("qti-assessment-item-player").evaluate((element) => {
      const endAttemptEvents: Array<{ state: { status: string } }> = [];
      element.addEventListener("qti-endattempt", (event) => {
        endAttemptEvents.push((event as CustomEvent).detail);
      });
      element.reset();
      element.endAttempt({ validateResponses: false });
      return {
        endAttemptDetail: endAttemptEvents[0],
        state: element.serialize(),
      };
    });
    expect(ended.endAttemptDetail.state.status).toBe("completed");
    expect(ended.state.status).toBe("completed");
    expect(ended.state.outcomes.SCORE).toBe(0);
    expect(ended.state.outcomes.MAXSCORE).toBe(1);
  });

  test("honors authored minimum response counts during validation", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="minimum-choice" title="minimum-choice" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="identifier">
    <qti-correct-response>
      <qti-value>A</qti-value>
      <qti-value>B</qti-value>
    </qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" min-choices="2" max-choices="3">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
      <qti-simple-choice identifier="B">B</qti-simple-choice>
      <qti-simple-choice identifier="C">C</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`,
    );

    await page.getByRole("checkbox", { name: "A" }).check();
    await page.locator("#debug-score").click();
    await expect(page.locator("#events")).toContainText("requires at least 2 responses");
    await expect(page.getByRole("checkbox", { name: "A" })).toHaveAttribute("aria-invalid", "true");

    await page.getByRole("checkbox", { name: "B" }).check();
    await expect(page.getByRole("checkbox", { name: "A" })).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await page.locator("#debug-score").click();

    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(state.outcomes.SCORE).toBe(1);
    expect(state.validationMessages).toEqual([]);
  });

  test("rejects authored maximum choice counts during selection", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="maximum-choice" title="maximum-choice" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="identifier">
    <qti-correct-response>
      <qti-value>A</qti-value>
    </qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" min-choices="0" max-choices="1" data-max-selections-message="Select no more than one option.">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
      <qti-simple-choice identifier="B">B</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`,
    );

    await page.getByRole("checkbox", { name: "A" }).check();
    await page.getByRole("checkbox", { name: "B" }).click();

    await expect(page.getByRole("checkbox", { name: "B" })).not.toBeChecked();
    await expectResponse(page, ["A"]);
    await expect(page.locator("#events")).toContainText("response.maximum");
    await expect(page.locator("#events")).toContainText("Select no more than one option.");
    const validationMessage = page.locator('[data-validation-for="RESPONSE"]');
    await expect(validationMessage).toHaveClass(/qti3-validation-message/);
    await expect(validationMessage).toHaveCSS("border-left-width", "4px");
    await expect(validationMessage).toHaveCSS("border-left-style", "solid");
    await expect(validationMessage).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(page.getByRole("checkbox", { name: "A" })).toHaveAttribute("aria-invalid", "true");

    await page.locator("#debug-score").click();
    await expect(page.locator("#score-panel")).toHaveAttribute("data-status", "scored");
  });

  test("honors restored maximum response counts during validation", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="maximum-choice-restore" title="maximum-choice-restore" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="identifier">
    <qti-correct-response>
      <qti-value>A</qti-value>
    </qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" min-choices="0" max-choices="1" data-max-selections-message="Select no more than one option.">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
      <qti-simple-choice identifier="B">B</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`,
    );

    await page.locator("qti-assessment-item-player").evaluate((element) => {
      const state = element.serialize();
      state.responses.RESPONSE = ["A", "B"];
      element.restore(state);
    });
    await page.locator("#debug-score").click();

    await expect(page.locator("#score-panel")).toHaveAttribute("data-status", "blocked");
    await expect(page.locator("#events")).toContainText("response.maximum");
    await expect(page.locator("#events")).toContainText("Select no more than one option.");
  });

  test("rejects authored maximum order counts during selection", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="maximum-order" title="maximum-order" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="ordered" base-type="identifier"/>
  <qti-item-body>
    <qti-order-interaction response-identifier="RESPONSE" min-choices="1" max-choices="1" class="qti-choices-top" data-max-selections-message="Only one ordered choice.">
      <qti-simple-choice identifier="A">Alpha</qti-simple-choice>
      <qti-simple-choice identifier="B">Beta</qti-simple-choice>
      <qti-simple-choice identifier="C">Gamma</qti-simple-choice>
    </qti-order-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    const layout = page.locator("qti-assessment-item-player .qti3-order-sv-layout");
    const bank = layout.locator(".qti3-order-choices-bank");
    await bank.locator('[data-choice-identifier="A"]').click();
    await bank.locator('[data-choice-identifier="B"]').click();

    await expectResponse(page, ["A"]);
    await expect(page.locator('[data-validation-for="RESPONSE"]')).toContainText(
      "Only one ordered choice.",
    );
    await expect(layout.locator(".qti3-order-target-item")).toHaveCount(1);
  });

  test("rejects authored maximum hottext counts during selection", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="maximum-hottext" title="maximum-hottext" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="identifier"/>
  <qti-item-body>
    <qti-hottext-interaction response-identifier="RESPONSE" max-choices="1" data-max-selections-message="Only one phrase.">
      <p>Choose <qti-hottext identifier="A">Alpha</qti-hottext> or <qti-hottext identifier="B">Beta</qti-hottext>.</p>
    </qti-hottext-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    await page.getByRole("button", { name: "Alpha" }).click();
    await page.getByRole("button", { name: "Beta" }).click();

    await expectResponse(page, ["A"]);
    await expect(page.getByRole("button", { name: "Beta" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(page.locator('[data-validation-for="RESPONSE"]')).toContainText(
      "Only one phrase.",
    );
  });

  test("rejects authored maximum associate pair counts during selection", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="maximum-associate" title="maximum-associate" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="pair"/>
  <qti-item-body>
    <qti-associate-interaction response-identifier="RESPONSE" min-associations="0" max-associations="1" data-max-selections-message="Only one pair.">
      <qti-simple-match-set>
        <qti-simple-associable-choice identifier="A" match-max="2">Alpha</qti-simple-associable-choice>
        <qti-simple-associable-choice identifier="B" match-max="2">Beta</qti-simple-associable-choice>
      </qti-simple-match-set>
      <qti-simple-match-set>
        <qti-simple-associable-choice identifier="C" match-max="2">Gamma</qti-simple-associable-choice>
        <qti-simple-associable-choice identifier="D" match-max="2">Delta</qti-simple-associable-choice>
      </qti-simple-match-set>
    </qti-associate-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    await page
      .locator(
        '.qti3-token-region[aria-label="Associate sources"] button[data-choice-identifier="A"]',
      )
      .click();
    await page
      .locator(
        '.qti3-token-region[aria-label="Associate targets"] button[data-choice-identifier="C"]',
      )
      .click();
    await page
      .locator(
        '.qti3-token-region[aria-label="Associate sources"] button[data-choice-identifier="B"]',
      )
      .click();
    await page
      .locator(
        '.qti3-token-region[aria-label="Associate targets"] button[data-choice-identifier="D"]',
      )
      .click();

    await expectResponse(page, ["A C"]);
    await expect(page.locator('[data-validation-for="RESPONSE"]')).toContainText("Only one pair.");
    await expect(page.locator("qti-assessment-item-player .qti3-pair-chip")).toHaveCount(1);
  });

  test("rejects authored maximum match pair counts during selection", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="maximum-match" title="maximum-match" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>
  <qti-item-body>
    <qti-match-interaction response-identifier="RESPONSE" max-associations="1" data-max-selections-message="Only one match.">
      <qti-simple-match-set>
        <qti-simple-associable-choice identifier="A" match-max="2">Alpha</qti-simple-associable-choice>
        <qti-simple-associable-choice identifier="B" match-max="2">Beta</qti-simple-associable-choice>
      </qti-simple-match-set>
      <qti-simple-match-set>
        <qti-simple-associable-choice identifier="C" match-max="2">Gamma</qti-simple-associable-choice>
        <qti-simple-associable-choice identifier="D" match-max="2">Delta</qti-simple-associable-choice>
      </qti-simple-match-set>
    </qti-match-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    await page.locator(".qti3-match-source-bank [data-choice-identifier='A']").click();
    await page.locator(".qti3-match-target-bank [data-choice-identifier='C']").click();
    await page.locator(".qti3-match-source-bank [data-choice-identifier='B']").click();
    await page.locator(".qti3-match-target-bank [data-choice-identifier='D']").click();

    await expectResponse(page, ["A C"]);
    await expect(page.locator('[data-validation-for="RESPONSE"]')).toContainText("Only one match.");
    await expect(page.locator("qti-assessment-item-player .qti3-pair-chip")).toHaveCount(1);
  });

  test("honors authored match-max counts during validation", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="match-max-associate" title="match-max-associate" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="pair">
    <qti-correct-response>
      <qti-value>A B</qti-value>
    </qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <qti-associate-interaction response-identifier="RESPONSE" min-associations="0" max-associations="0">
      <qti-simple-match-set>
        <qti-simple-associable-choice identifier="A" match-max="1">Alpha</qti-simple-associable-choice>
        <qti-simple-associable-choice identifier="B" match-max="0">Beta</qti-simple-associable-choice>
        <qti-simple-associable-choice identifier="C" match-max="1">Gamma</qti-simple-associable-choice>
      </qti-simple-match-set>
    </qti-associate-interaction>
  </qti-item-body>
</qti-assessment-item>`,
    );

    await page
      .locator(
        '.qti3-token-region[aria-label="Associate sources"] button[data-choice-identifier="A"]',
      )
      .click();
    await page
      .locator(
        '.qti3-token-region[aria-label="Associate targets"] button[data-choice-identifier="B"]',
      )
      .click();
    await page
      .locator(
        '.qti3-token-region[aria-label="Associate sources"] button[data-choice-identifier="A"]',
      )
      .click();
    await page
      .locator(
        '.qti3-token-region[aria-label="Associate targets"] button[data-choice-identifier="C"]',
      )
      .click();
    await page.locator("#debug-score").click();

    await expect(page.locator("#score-panel")).toHaveAttribute("data-status", "blocked");
    await expect(page.locator("#events")).toContainText("response.matchMax");
    await expect(page.locator("#events")).toContainText("Alpha may be used at most 1 time.");
  });

  test("allows optional responses when authored minimum is zero", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="optional-choice" title="optional-choice" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="identifier">
    <qti-correct-response>
      <qti-value>A</qti-value>
    </qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" min-choices="0" max-choices="1">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
      <qti-simple-choice identifier="B">B</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`,
    );
    await page.locator("#debug-score").click();

    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(state.outcomes.SCORE).toBe(0);
    expect(state.validationMessages).toEqual([]);
    await expect(page.locator("#events")).not.toContainText("response.required");
  });

  test("keeps pattern mask and response validation aria descriptions in sync", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="pattern-mask-validation" title="pattern-mask-validation" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string">
    <qti-correct-response><qti-value>12</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-item-body>
    <qti-extended-text-interaction
      response-identifier="RESPONSE"
      pattern-mask="([0-9]+)"
      data-patternmask-message="Enter at least one digit"
    />
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`,
    );

    const textarea = page.locator("qti-assessment-item-player textarea");
    await page.locator("#debug-score").click();
    await expect(textarea).toHaveAttribute("aria-invalid", "true");

    let describedBy = await textarea.getAttribute("aria-describedby");
    expect(describedBy).toContain("qti3-validation-RESPONSE");

    await textarea.focus();
    await textarea.blur();
    describedBy = await textarea.getAttribute("aria-describedby");
    expect(describedBy).toContain("qti3-validation-RESPONSE");
    expect(describedBy).toContain("qti3-pattern-mask-RESPONSE");

    await textarea.fill("12");
    await page.locator("#debug-score").click();
    await expect(textarea).not.toHaveAttribute("aria-invalid", "true");
    await expect(textarea).not.toHaveAttribute("aria-describedby");
  });
});
