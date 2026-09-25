import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { playerLocator, serializePlayer, restorePlayerState } from "./player-test-api.js";

const cases = [
  { path: "shuffle/choice", name: "qti-simple-choice", shuffle: undefined },
  { path: "shuffle/choice", name: "qti-simple-choice", shuffle: "false" },
  { path: "shuffle/choice", name: "qti-simple-choice", shuffle: "0" },
  { path: "shuffle/choice", name: "qti-simple-choice", shuffle: "true" },
  { path: "shuffle/inlineChoice", name: "qti-inline-choice", shuffle: "false" },
  { path: "hotspot-reference", name: "qti-hotspot-choice", shuffle: undefined },
  { path: "hottext-reference", name: "qti-hottext", shuffle: undefined },
];

for (const entry of cases) {
  test(`template visibility ${entry.path} shuffle=${entry.shuffle}`, async ({ page }) => {
    const xml = readFileSync(
      new URL(`../../packages/fixtures/xml/${entry.path}.xml`, import.meta.url),
      "utf8",
    )
      .replaceAll(
        ' shuffle="true"',
        entry.shuffle === undefined ? "" : ` shuffle="${entry.shuffle}"`,
      )
      .replaceAll(
        `<${entry.name} identifier="A"`,
        `<${entry.name} template-identifier="VISIBLE" identifier="A"`,
      )
      .replaceAll(
        `<${entry.name} identifier="B"`,
        `<${entry.name} template-identifier="VISIBLE" show-hide="hide" identifier="B"`,
      )
      .replaceAll(
        "<qti-item-body>",
        `<qti-template-declaration identifier="VISIBLE" cardinality="multiple" base-type="identifier"><qti-default-value><qti-value>B</qti-value><qti-value>C</qti-value></qti-default-value></qti-template-declaration><qti-item-body>`,
      );
    await page.goto("/");
    const player = playerLocator(page);
    await player.evaluate(async (element, source) => {
      await element.loadXml(source, { sessionOptions: { presentationSeed: 31 } });
    }, xml);
    const hidden = player.locator(
      '[data-qti-player-choice-identifier="A"], [data-qti-player-choice-identifier="B"]',
    );
    await expect(hidden).toHaveCount(0);
    await expect(player.locator('[data-qti-player-choice-identifier="C"]').first()).toBeAttached();
    if (entry.path === "hottext-reference") {
      await expect(player.locator(".qti3-hottext-passage")).toContainText("The lot is 0.4 acres");
      await expect(
        player.getByRole("button", { name: "The lot is 0.4 acres", exact: true }),
      ).toHaveCount(0);
    }
    const state = await serializePlayer(page);
    await restorePlayerState(page, state);
    await expect(hidden).toHaveCount(0);
  });
}
