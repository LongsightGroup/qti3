import { expect, test } from "@playwright/test";
import { expectResponse, loadFixture } from "./player-helpers.js";

test.describe("player portable custom", () => {
  test("exposes a portable custom host contract and accepts response events", async ({ page }) => {
    await page.goto("/");
    await page.locator("qti-assessment-item-player").evaluate((element) => {
      const target = window as unknown as {
        __qti3PortableCustomMount?: Promise<{
          responseIdentifier: string;
          module: string | undefined;
          primaryConfiguration: string | undefined;
          interactionMarkupRaw: string | undefined;
        }>;
      };
      target.__qti3PortableCustomMount = new Promise((resolve) => {
        element.addEventListener(
          "qti-portable-custom-mount",
          (event) => {
            const detail = (event as CustomEvent).detail;
            resolve({
              responseIdentifier: detail.responseIdentifier,
              module: detail.definition.module,
              primaryConfiguration: detail.definition.interactionModules?.primaryConfiguration,
              interactionMarkupRaw: detail.definition.interactionMarkupRaw,
            });
          },
          { once: true },
        );
      });
    });
    await loadFixture(page, "portableCustom");

    const host = page.locator("qti-assessment-item-player .qti3-portable-custom-host");
    await expect(host).toBeVisible();
    await host.focus();
    await expect(host).toBeFocused();
    await expect(host).toHaveAttribute("data-type-identifier", "urn:qti3:fixture:portable-custom");
    await expect(host).toHaveAttribute("data-module", "fixture-portable-custom");
    await expect(host).toHaveAttribute(
      "data-primary-configuration",
      "modules/module_resolution.js",
    );
    await expect(host.locator(".qti3-fixture-pci-markup")).toHaveText(
      "Portable custom fixture markup",
    );
    const mount = await page.evaluate(() => {
      const target = window as unknown as {
        __qti3PortableCustomMount?: Promise<{
          responseIdentifier: string;
          module: string | undefined;
          primaryConfiguration: string | undefined;
          interactionMarkupRaw: string | undefined;
        }>;
      };
      return target.__qti3PortableCustomMount;
    });
    expect(mount).toEqual({
      responseIdentifier: "RESPONSE",
      module: "fixture-portable-custom",
      primaryConfiguration: "modules/module_resolution.js",
      interactionMarkupRaw:
        '<div class="qti3-fixture-pci-markup">Portable custom fixture markup</div>',
    });
    await expect(host).not.toHaveAttribute("data-interaction-markup", /.*/);

    const responseMirror = page.locator(
      "qti-assessment-item-player input.qti3-portable-custom-response",
    );
    await expect(responseMirror).toBeHidden();
    await expect(responseMirror).toHaveAttribute("aria-hidden", "true");

    await host.evaluate((element) => {
      element.dispatchEvent(
        new CustomEvent("qti3-portable-custom-response", {
          detail: { value: "A", state: { selected: ["A"], step: 1 } },
          bubbles: true,
        }),
      );
    });
    await expectResponse(page, "A");

    await page.locator("#debug-score").click();
    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(state.outcomes.SCORE).toBe(1);
    expect(state.interactionStates.RESPONSE).toEqual({ selected: ["A"], step: 1 });
  });
});
