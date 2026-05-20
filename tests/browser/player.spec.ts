import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { expect, test } from "@playwright/test";
import { interactionFixtures } from "../../packages/fixtures/src/index.js";

const require = createRequire(import.meta.url);

test.describe("manual harness", () => {
  test("loads every reference interaction fixture without axe violations", async ({ page }) => {
    await page.goto("/");
    const axeSource = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");

    for (const fixture of interactionFixtures) {
      await page.locator("#fixture").selectOption(fixture.id);
      await page.locator("#load-fixture").click();
      await expect(page.locator("qti-assessment-item-player")).toContainText(fixture.id);
      await expect(
        page.locator(`[data-interaction-type="${fixture.interactionType}"]`),
      ).toBeVisible();

      await page.addScriptTag({ content: axeSource });
      const result = await page.evaluate(async () => {
        return await window.axe.run(document.querySelector("qti-assessment-item-player"));
      });
      expect(result.violations, fixture.id).toEqual([]);
    }
  });

  test("accepts pasted QTI XML and emits score state", async ({ page }) => {
    const fixture =
      interactionFixtures.find((item) => item.interactionType === "choice") ??
      interactionFixtures[0];
    if (!fixture) throw new Error("Missing choice fixture.");

    await page.goto("/");
    await page.locator("#xml").fill(fixture.xml);
    await page.locator("#load-xml").click();
    await page.getByRole("radio", { name: "A" }).check();
    await page.getByRole("button", { name: "Score" }).click();
    await expect(page.locator("#events")).toContainText("qti3.attempt-state.v1");
  });

  test("captures and scores every reference interaction fixture", async ({ page }) => {
    await page.goto("/");

    for (const fixture of interactionFixtures) {
      await page.locator("#fixture").selectOption(fixture.id);
      await page.locator("#load-fixture").click();

      const attempt = fixture.attempts[0];
      if (!attempt) throw new Error(`Missing attempt for ${fixture.id}.`);

      const response = attempt.responses.RESPONSE;
      if (response !== undefined) {
        await provideResponse(page, fixture.interactionType, response);
      }

      await page.getByRole("button", { name: "Score" }).click();
      const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
        return element.serialize();
      });

      expect(state.schema, fixture.id).toBe("qti3.attempt-state.v1");
      for (const [identifier, expected] of Object.entries(attempt.expectedOutcomes)) {
        expect(state.outcomes[identifier], `${fixture.id} ${identifier}`).toEqual(expected);
      }
    }
  });

  test("supports host lifecycle methods for state restore and attempt control", async ({
    page,
  }) => {
    const fixture =
      interactionFixtures.find((item) => item.interactionType === "choice") ??
      interactionFixtures[0];
    if (!fixture) throw new Error("Missing choice fixture.");

    await page.goto("/");
    await page.locator("#xml").fill(fixture.xml);
    await page.locator("#load-xml").click();
    await page.getByRole("radio", { name: "A" }).check();

    const answeredState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(answeredState.responses.RESPONSE).toBe("A");

    const resetState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      element.reset();
      return element.serialize();
    });
    expect(resetState.responses.RESPONSE).toBeUndefined();

    const lifecycleEvents = await page
      .locator("qti-assessment-item-player")
      .evaluate((element, state) => {
        const events: string[] = [];
        for (const eventName of ["qti-restore", "qti-suspend", "qti-endattempt"]) {
          element.addEventListener(eventName, () => events.push(eventName));
        }
        element.restore(state);
        element.suspend();
        element.endAttempt();
        return events;
      }, answeredState);

    expect(lifecycleEvents).toEqual(["qti-restore", "qti-suspend", "qti-endattempt"]);
    const restoredState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(restoredState.responses.RESPONSE).toBe("A");
    expect(restoredState.outcomes.SCORE).toBe(1);
  });
});

declare global {
  interface Window {
    axe: {
      run: (context: Element | null) => Promise<{ violations: unknown[] }>;
    };
  }
}

async function provideResponse(
  page: import("@playwright/test").Page,
  interactionType: string,
  response: unknown,
): Promise<void> {
  if (interactionType === "slider") {
    await page.locator('input[type="range"]').evaluate((element, value) => {
      const input = element as HTMLInputElement;
      input.value = String(value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, response);
    return;
  }

  if (interactionType === "upload") {
    await page.locator('qti-assessment-item-player input[type="file"]').setInputFiles({
      name: String(response),
      mimeType: "text/plain",
      buffer: Buffer.from("qti3 upload fixture"),
    });
    return;
  }

  if (Array.isArray(response) && response.some((value) => String(value).includes(" "))) {
    const [source, target] = String(response[0]).split(" ");
    await page
      .locator('qti-assessment-item-player select[aria-label$="source"]')
      .selectOption(source);
    await page
      .locator('qti-assessment-item-player select[aria-label$="target"]')
      .selectOption(target);
    return;
  }

  if (
    Array.isArray(response) &&
    (interactionType === "order" || interactionType === "graphicOrder")
  ) {
    const selects = page.locator("qti-assessment-item-player select");
    for (const [index, value] of response.entries()) {
      await selects.nth(index).selectOption(String(value));
    }
    return;
  }

  const value = Array.isArray(response) ? String(response[0]) : String(response);
  const checkbox = page.getByRole("checkbox", { name: value }).first();
  if (await checkbox.isVisible().catch(() => false)) {
    await checkbox.check();
    return;
  }

  const radio = page.getByRole("radio", { name: value }).first();
  if (await radio.isVisible().catch(() => false)) {
    await radio.check();
    return;
  }

  const select = page.locator("qti-assessment-item-player select").first();
  if (await select.isVisible().catch(() => false)) {
    await select.selectOption(value);
    return;
  }

  const textarea = page.locator("qti-assessment-item-player textarea").first();
  if (await textarea.isVisible().catch(() => false)) {
    await textarea.fill(value);
    return;
  }

  const input = page
    .locator('qti-assessment-item-player input:not([type="file"]):not([type="range"])')
    .first();
  if (await input.isVisible().catch(() => false)) {
    await input.fill(value);
    await input.dispatchEvent("change");
  }
}
