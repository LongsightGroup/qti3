import { expect, test, type Page } from "@playwright/test";
import { interactionFixtures } from "../../packages/fixtures/src/index.js";
import { ORDER_SHARED_VOCABULARY_ITEM } from "./fixtures/dom-behavior-items.js";
import { GRAPHIC_GAP_UNSELECTED_HIDDEN_ITEM } from "./player-graphic-gap-fixtures.js";
import { dragCenter, loadFixture, pasteXml } from "./player-helpers.js";

type RegionSnapshot = {
  kind: string;
  interactionType: string;
  responseIdentifier?: string;
  choiceIdentifier?: string;
  label?: string;
  width: number;
  height: number;
  tagName: string;
  markerKind: string | null;
};

const requiredRegionKindsByInteractionType: Record<string, string[]> = {
  associate: ["interaction", "source", "target"],
  choice: ["choice", "interaction"],
  drawing: ["interaction", "surface"],
  endAttempt: ["control", "interaction"],
  extendedText: ["control", "interaction"],
  gapMatch: ["interaction", "source", "target"],
  graphicAssociate: ["choice", "interaction", "surface"],
  graphicGapMatch: ["interaction", "source", "target"],
  graphicOrder: ["choice", "interaction", "surface"],
  hotspot: ["choice", "interaction", "surface"],
  hottext: ["choice", "interaction"],
  inlineChoice: ["control", "interaction"],
  match: ["interaction", "source", "target"],
  media: ["control", "interaction"],
  order: ["choice", "interaction"],
  positionObject: ["interaction", "placement", "surface"],
  portableCustom: ["control", "interaction"],
  selectPoint: ["interaction", "surface"],
  slider: ["control", "interaction"],
  textEntry: ["control", "interaction"],
  upload: ["control", "interaction"],
};

async function regionSnapshots(page: Page): Promise<RegionSnapshot[]> {
  return page.locator("qti-assessment-item-player").evaluate((element) =>
    element.getInteractionRegions().map((region) => ({
      kind: region.kind,
      interactionType: region.interactionType,
      responseIdentifier: region.responseIdentifier,
      choiceIdentifier: region.choiceIdentifier,
      label: region.label,
      width: region.bounds.width,
      height: region.bounds.height,
      tagName: region.element.tagName.toLowerCase(),
      markerKind: region.element.getAttribute("data-qti-player-region-kind"),
    })),
  );
}

async function regionKindSet(page: Page): Promise<string[]> {
  const regions = await regionSnapshots(page);
  return [...new Set(regions.map((region) => region.kind))].toSorted();
}

test.describe("player interaction regions", () => {
  for (const fixture of interactionFixtures) {
    test(`exposes visible regions for ${fixture.interactionType}`, async ({ page }) => {
      if (!fixture.interactionType) throw new Error(`Missing interaction type for ${fixture.id}.`);
      await page.goto("/");
      await loadFixture(page, fixture.interactionType);

      const regions = await regionSnapshots(page);
      const kinds = await regionKindSet(page);
      const requiredKinds = requiredRegionKindsByInteractionType[fixture.interactionType];
      if (!requiredKinds) {
        throw new Error(`Missing region-kind expectation for ${fixture.interactionType}.`);
      }
      expect(regions.length).toBeGreaterThan(0);
      expect(kinds).toEqual(expect.arrayContaining(requiredKinds));
      expect(regions.every((region) => region.markerKind === region.kind)).toBe(true);
      expect(regions.every((region) => region.width > 0 && region.height > 0)).toBe(true);
    });
  }

  test("exposes stable DOM markers with response and choice identifiers", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "choice");

    const player = page.locator("qti-assessment-item-player");
    const interaction = player.locator('[data-qti-player-region-kind="interaction"]').first();
    await expect(interaction).toHaveAttribute("data-qti-player-interaction-type", "choice");
    await expect(interaction).toHaveAttribute("data-qti-player-response-identifier", "RESPONSE");

    const choice = player.locator('[data-qti-player-region-kind="choice"]').first();
    await expect(choice).toHaveAttribute("data-qti-player-choice-identifier", /.+/);
    await expect(choice).toHaveAttribute("data-qti-player-response-identifier", "RESPONSE");
    await expect(choice).not.toHaveAttribute("aria-label", /.+/);
  });

  test("excludes closed inline-choice options and includes visible options after opening", async ({
    page,
  }) => {
    await page.goto("/");
    await loadFixture(page, "inlineChoice");

    const closed = await regionSnapshots(page);
    expect(closed.filter((region) => region.kind === "choice")).toHaveLength(0);
    expect(closed.some((region) => region.kind === "control")).toBe(true);

    await page
      .locator(
        'qti-assessment-item-player [data-response-identifier="RESPONSE_DECLARATION"] .qti3-inline-choice-trigger',
      )
      .click();

    const open = await regionSnapshots(page);
    expect(open.filter((region) => region.kind === "choice")).toHaveLength(4);
    expect(open.some((region) => region.choiceIdentifier === "A")).toBe(true);
  });

  test("exposes placement regions after assigning a hotspot-backed graphic gap-match token", async ({
    page,
  }) => {
    await page.goto("/");
    await pasteXml(page, GRAPHIC_GAP_UNSELECTED_HIDDEN_ITEM);
    await expect(page.locator("qti-assessment-item-player .qti3-graphic-gap-hotspot")).toHaveCount(
      2,
    );

    const source = page.locator('[data-choice-identifier="A"]').first();
    const target = page.locator('[data-gap-identifier="T1"]').first();
    await source.click();
    await target.click();

    const kinds = await regionKindSet(page);
    expect(kinds).toContain("placement");
    expect(
      (await regionSnapshots(page)).some(
        (region) => region.kind === "placement" && region.choiceIdentifier === "A",
      ),
    ).toBe(true);
  });

  test("exposes shared-vocabulary order source, target, and placement regions", async ({
    page,
  }) => {
    await page.goto("/");
    await pasteXml(page, ORDER_SHARED_VOCABULARY_ITEM);
    await expect(page.locator("qti-assessment-item-player .qti3-order-choice")).toHaveCount(3);

    const kinds = await regionKindSet(page);
    expect(kinds).toEqual(["interaction", "source", "target"]);
    expect((await regionSnapshots(page)).filter((region) => region.kind === "source")).toHaveLength(
      3,
    );
    expect((await regionSnapshots(page)).filter((region) => region.kind === "target")).toHaveLength(
      3,
    );

    const player = page.locator("qti-assessment-item-player");
    const source = player.locator(".qti3-order-choice").first();
    const target = player.locator(".qti3-order-target-slot").first();
    await dragCenter(page, source, target);

    const assignedKinds = await regionKindSet(page);
    expect(assignedKinds).toContain("placement");
    expect(
      (await regionSnapshots(page)).some(
        (region) => region.kind === "placement" && region.choiceIdentifier === "A",
      ),
    ).toBe(true);
  });

  test("returns no regions after clearing the loaded item", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "choice");

    await page.locator("qti-assessment-item-player").evaluate((element) => element.clearItem());

    expect(await regionSnapshots(page)).toEqual([]);
  });
});
