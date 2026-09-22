import { expect, test } from "@playwright/test";
import type { QtiBaseType, QtiCardinality } from "../../packages/core/src/types.js";
import type { QtiPortableCustomMountEventDetail } from "../../packages/player/src/player-types.js";
import { expectNoAxeViolationsOnPlayer } from "./axe-helpers.js";
import { expectResponse, loadFixture } from "./player-helpers.js";

const responseShapes: Array<
  | [Exclude<QtiCardinality, "record">, QtiBaseType, string | string[]]
  | ["record", undefined, { answer: string }]
> = [
  ["single", "identifier", "A"],
  ["single", "string", "A,B"],
  ["ordered", "identifier", ["A", "B"]],
  ["multiple", "identifier", ["A", "B"]],
  ["multiple", "directedPair", ["A G1", "B G2"]],
  ["single", "directedPair", "A G1"],
  ["single", "pair", "A B"],
  ["multiple", "pair", ["A B", "C D"]],
  ["ordered", "string", ["first", "second"]],
  ["multiple", "string", ["first", "second"]],
  ["record", undefined, { answer: "A" }],
];

test.describe("player portable custom", () => {
  for (const [cardinality, baseType, response] of responseShapes) {
    test(`mounts, scores and restores ${cardinality}/${baseType ?? "record fields"} responses`, async ({
      page,
    }) => {
      const correctResponse =
        cardinality === "record"
          ? `<qti-value field-identifier="answer" base-type="identifier">${response.answer}</qti-value>`
          : (Array.isArray(response) ? response : [response])
              .map((value) => `<qti-value>${value}</qti-value>`)
              .join("");
      const xml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="pci-response-shape" title="PCI response shape" time-dependent="false" xml:lang="en">
        <qti-response-declaration identifier="RESPONSE" cardinality="${cardinality}" ${baseType ? `base-type="${baseType}"` : ""}>
          <qti-correct-response>${correctResponse}</qti-correct-response>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
          <qti-default-value><qti-value>0</qti-value></qti-default-value>
        </qti-outcome-declaration>
        <qti-item-body>
          <qti-portable-custom-interaction response-identifier="RESPONSE" custom-interaction-type-identifier="urn:qti3:test:response-shape" module="response-shape">
            <qti-prompt>Custom response</qti-prompt>
            <qti-interaction-modules><qti-interaction-module id="response-shape" primary-path="modules/response-shape"/></qti-interaction-modules>
          </qti-portable-custom-interaction>
        </qti-item-body>
        <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
      </qti-assessment-item>`;
      await page.goto("/");
      const player = page.locator("qti-assessment-item-player");
      const result = await player.evaluate(
        async (element, input) => {
          const mounts: Array<
            Pick<QtiPortableCustomMountEventDetail, "responseIdentifier" | "value" | "state">
          > = [];
          const onMount = (event: Event) => {
            // SAFETY: This listener handles the player's typed PCI mount event only.
            const { responseIdentifier, value, state } = (
              event as CustomEvent<QtiPortableCustomMountEventDetail>
            ).detail;
            mounts.push({ responseIdentifier, value, state });
          };
          element.addEventListener("qti-portable-custom-mount", onMount);
          try {
            await element.loadXml(input.xml);
            const initialMounts = mounts.slice();
            const host = element.querySelector(".qti3-portable-custom-host");
            if (!host) return { initialMounts };
            host.dispatchEvent(
              new CustomEvent("qti3-portable-custom-response", {
                detail: { value: input.response, state: { step: 2, selection: input.response } },
                bubbles: true,
              }),
            );
            const score = element.scoreAttempt();
            const saved = element.serialize();
            element.clearItem();
            mounts.length = 0;
            await element.loadXml(input.xml, { state: saved });
            return {
              initialMounts,
              score,
              saved,
              restoredMounts: mounts,
              restored: element.serialize(),
            };
          } finally {
            element.removeEventListener("qti-portable-custom-mount", onMount);
          }
        },
        { xml, response },
      );
      expect(result.initialMounts).toEqual([
        { responseIdentifier: "RESPONSE", value: null, state: undefined },
      ]);
      expect(result.score?.outcomes.SCORE).toBe(1);
      expect(result.saved?.responses.RESPONSE).toEqual(response);
      expect(result.saved?.interactionStates.RESPONSE).toEqual({ step: 2, selection: response });
      expect(result.restoredMounts).toEqual([
        {
          responseIdentifier: "RESPONSE",
          value: response,
          state: { step: 2, selection: response },
        },
      ]);
      expect(result.restored?.responses.RESPONSE).toEqual(response);
      expect(result.restored?.interactionStates.RESPONSE).toEqual({ step: 2, selection: response });
      const host = player.getByRole("application", { name: "Custom response" });
      await expect(host).toBeVisible();
      await host.focus();
      await page.keyboard.press("Shift+Tab");
      await expect(host).not.toBeFocused();
      await page.keyboard.press("Tab");
      await expect(host).toBeFocused();
      await expect(player).not.toContainText("No choices are defined");
      await expectNoAxeViolationsOnPlayer(page);
    });
  }

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
      "Custom graphing widget placeholder for sample data",
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
        '<div class="qti3-fixture-pci-markup">Custom graphing widget placeholder for sample data</div>',
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
