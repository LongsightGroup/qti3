import { expect, test } from "@playwright/test";
import { expectNoAxeViolationsOnPlayer } from "./axe-helpers.js";
import { pasteXml } from "./player-helpers.js";

import { feedbackReleaseItemXml } from "../fixtures/feedback-release-item.js";

for (const adaptive of [false, true]) {
  test(`host withholding omits feedback through active processing and state restoration (adaptive=${adaptive})`, async ({
    page,
  }) => {
    await page.goto("/");
    const xml = feedbackReleaseItemXml(adaptive);
    await pasteXml(page, xml);
    const player = page.locator("qti-assessment-item-player");
    await player.evaluate(async (element, input) => {
      await element.loadXml(input, {
        feedbackRelease: "withheld",
        sessionOptions: { now: () => 0 },
        sessionControl: { showFeedback: true },
      });
    }, xml);
    for (const phase of [
      "initial",
      "score",
      "restore",
      "reload",
      "rerender",
      "end",
      "reset",
    ] as const) {
      if (phase === "score" || phase === "end") {
        await page.getByRole("radio", { name: "A. Alpha" }).check();
        await page.locator(phase === "score" ? "#debug-score" : "#debug-end").click();
        const state = await player.evaluate((element) => element.serialize());
        expect(state?.outcomes.SCORE).toBe(2.5);
        expect(state?.outcomes.FEEDBACK).toBe("RIGHT");
        expect(state?.responses.RESPONSE).toBe("A");
      }
      if (phase === "restore") {
        await player.evaluate((element) => {
          const state = element.serialize();
          if (!state) throw new Error("Missing attempt.");
          element.reset();
          element.restore(state);
        });
      }
      if (phase === "reload") {
        await player.evaluate(async (element, input) => {
          const state = element.serialize();
          if (!state) throw new Error("Missing attempt.");
          await element.loadXml(input, {
            sessionOptions: { now: () => 0 },
            state,
            feedbackRelease: "withheld",
          });
        }, xml);
      }
      if (phase === "rerender")
        await player.evaluate((element) => element.setAttribute("language-of-interface", "en-US"));
      if (phase === "reset") await player.evaluate((element) => element.reset());
      await expect(player).toContainText("Choose Alpha.");
      await expect(player.locator(".qti3-feedback-block, .qti3-feedback-inline")).toHaveCount(0);
      await expect(player.locator(".qti3-feedback")).toBeHidden();
      await expect(player).not.toContainText("explanation.");
      await expect(player.getByRole("link", { name: "Answer link" })).toHaveCount(0);
    }
    await expectNoAxeViolationsOnPlayer(page);
  });

  test(`host release reloads the preserved attempt and retains QTI review policy (adaptive=${adaptive})`, async ({
    page,
  }) => {
    await page.goto("/");
    const xml = feedbackReleaseItemXml(adaptive);
    await pasteXml(page, xml);
    const player = page.locator("qti-assessment-item-player");
    await player.evaluate(async (element, input) => {
      await element.loadXml(input, {
        sessionOptions: { now: () => 0 },
        feedbackRelease: "withheld",
      });
    }, xml);
    await page.getByRole("radio", { name: "A. Alpha" }).check();
    await page.locator("#debug-score").click();
    await expect(player).not.toContainText("Modal explanation.");
    const saved = await player.evaluate((element) => element.serialize());
    if (!saved) throw new Error("Missing scored attempt.");
    expect(saved.outcomes.SCORE).toBe(2.5);
    expect(saved).not.toHaveProperty("feedbackRelease");
    await player.evaluate(
      async (element, input) => {
        await element.loadXml(input.xml, {
          state: input.state,
          sessionOptions: { now: () => 0 },
          feedbackRelease: "released",
          sessionControl: { showFeedback: false },
        });
      },
      { xml, state: saved },
    );
    expect(await player.evaluate((element) => element.serialize())).toEqual(saved);
    await expect(player.getByText("Block explanation.", { exact: true })).toBeVisible();
    await expect(player.locator(".qti3-feedback")).toContainText("Modal explanation.");
    await expect(player.getByRole("link", { name: "Answer link" })).toHaveAttribute(
      "href",
      "https://example.org/answer",
    );
    await page.locator("#debug-end").click();
    if (adaptive) await expect(player.locator(".qti3-feedback")).toBeVisible();
    else await expect(player.locator(".qti3-feedback")).toBeHidden();
    await expectNoAxeViolationsOnPlayer(page);
  });
}
