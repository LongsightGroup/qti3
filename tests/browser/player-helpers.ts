import { expect, type Locator, type Page } from "@playwright/test";
import { interactionFixtures } from "../../packages/fixtures/src/index.js";
import type { PlayerMessageCatalog } from "../../packages/player/src/player-message-catalog.js";
import { reorderMovementDirections } from "../../packages/player/src/movement.js";
import { resetThenRestorePlayerState } from "./player-test-api.js";

export {
  createDeflatedZip,
  createItemPackageZip,
  createStoredZip,
  qtiAssessmentTestResource,
  qtiItemResource,
} from "./player-package-helpers.js";

export const operableControlSelector = [
  "button",
  "input",
  "select",
  "textarea",
  "audio[controls]",
  "video[controls]",
  "a[href]",
  '[role="button"]',
  '[role="slider"]',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export async function loadFixture(page: Page, interactionType: string): Promise<void> {
  const fixture = interactionFixtures.find((item) => item.interactionType === interactionType);
  if (!fixture) throw new Error(`Missing ${interactionType} fixture.`);
  await selectFixtureById(page, fixture.id);
}

export async function selectFixtureById(page: Page, fixtureId: string): Promise<void> {
  await page.locator("#fixture").selectOption(fixtureId);
  await page.locator("#load-fixture").click();
}

/** Applies a host-owned locale catalog in the browser (JSON-serializable). */
export async function setPlayerMessageCatalog(
  page: Page,
  catalog: PlayerMessageCatalog | undefined,
): Promise<void> {
  await page.locator("qti-assessment-item-player").evaluate((element, messageCatalog) => {
    const player = element as HTMLElement & { messageCatalog?: PlayerMessageCatalog };
    player.messageCatalog = messageCatalog;
  }, catalog);
}

export async function pasteXml(page: Page, xml: string): Promise<void> {
  const loader = page.locator("#xml-loader");
  if (!(await loader.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await loader.locator("summary").click();
  }
  await page.locator("#xml").fill(xml);
  await page.locator("#load-xml").click();
  await waitForPlayerLoad(page, itemIdentifierFromXml(xml));
}

function itemIdentifierFromXml(xml: string): string | undefined {
  return /\bidentifier\s*=\s*["']([^"']+)["']/.exec(xml)?.[1];
}

async function waitForPlayerLoad(
  page: Page,
  expectedIdentifier: string | undefined,
): Promise<void> {
  await page.waitForFunction((identifier) => {
    const player = document.querySelector("qti-assessment-item-player") as
      | (HTMLElement & { serialize?: () => { itemIdentifier?: string } })
      | null;
    if (!player) return false;
    if (player.textContent?.includes("Unable to ")) return true;
    return identifier
      ? player.serialize?.().itemIdentifier === identifier
      : player.childElementCount > 0;
  }, expectedIdentifier);
}

export async function dragCenter(page: Page, source: Locator, target: Locator): Promise<void> {
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("Missing drag boxes.");
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
  await page.mouse.up();
}

export async function visibleValidationAlertCount(
  page: Page,
  responseIdentifier = "RESPONSE",
): Promise<number> {
  return page
    .locator(`qti-assessment-item-player [data-validation-for="${responseIdentifier}"]`)
    .evaluateAll(
      (elements) => elements.filter((element) => !element.hidden && element.textContent).length,
    );
}

export async function suspendRestoreCurrentAttempt(page: Page): Promise<void> {
  const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
    element.suspend();
    return element.serialize();
  });
  if (!state) throw new Error("Expected serialized state.");
  await resetThenRestorePlayerState(page, state);
}

export async function scoreCurrentAttempt(page: Page): Promise<
  | {
      outcomes: Record<string, unknown>;
      state: { responses: Record<string, unknown> };
    }
  | undefined
> {
  return page.locator("qti-assessment-item-player").evaluate((element) => {
    return element.scoreAttempt({ validateResponses: false });
  });
}

export async function expectResponse(page: Page, expected: unknown): Promise<void> {
  expect(await currentResponse(page)).toEqual(expected);
}

export async function currentResponse(page: Page): Promise<unknown> {
  const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
    return element.serialize();
  });
  return state.responses.RESPONSE;
}

export async function expectStringResponse(page: Page, pattern: RegExp): Promise<string> {
  await expect
    .poll(async () => {
      const value = await currentResponse(page);
      return typeof value === "string" ? value : "";
    })
    .toMatch(pattern);
  const value = await currentResponse(page);
  if (typeof value !== "string") throw new Error("Expected string response.");
  return value;
}

export async function expectMoveButtons(
  buttons: Locator,
  expectedDirections: Array<"up" | "down" | "left" | "right">,
): Promise<void> {
  await expect(buttons).toHaveCount(expectedDirections.length);
  const actual = await buttons.evaluateAll((elements) =>
    elements.map((button) => {
      const icon = button.querySelector("svg.qti3-movement-icon");
      return {
        direction: (button as HTMLElement).dataset.moveDirection ?? "",
        focusable: icon?.getAttribute("focusable") ?? "",
        hidden: icon?.getAttribute("aria-hidden") ?? "",
        pathCount: icon?.querySelectorAll("path").length ?? 0,
        text: button.textContent?.trim() ?? "",
      };
    }),
  );
  expect(actual).toEqual(
    expectedDirections.map((direction) => ({
      direction,
      focusable: "false",
      hidden: "true",
      pathCount: 3,
      text: "",
    })),
  );
}

export function decodeDataUrlText(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) return "";
  const metadata = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  return metadata.includes(";base64")
    ? Buffer.from(payload, "base64").toString("utf8")
    : decodeURIComponent(payload);
}

export async function expectPointResponse(
  page: Page,
  expected: string | string[],
  tolerance = 1,
): Promise<void> {
  const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
    return element.serialize();
  });
  const actual = state.responses.RESPONSE;
  const actualPoints = Array.isArray(actual) ? actual : [actual];
  const expectedPoints = Array.isArray(expected) ? expected : [expected];
  expect(actualPoints).toHaveLength(expectedPoints.length);
  for (const [index, expectedPoint] of expectedPoints.entries()) {
    expectPointNear(actualPoints[index], expectedPoint, tolerance);
  }
}

function expectPointNear(actual: unknown, expected: string, tolerance: number): void {
  const actualPoint = parsePointValue(actual);
  const expectedPoint = parsePointValue(expected);
  expect(Math.abs(actualPoint.x - expectedPoint.x)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actualPoint.y - expectedPoint.y)).toBeLessThanOrEqual(tolerance);
}

function parsePointValue(value: unknown): { x: number; y: number } {
  const [x, y] = String(value)
    .trim()
    .split(/\s+/)
    .map((coordinate) => Number(coordinate));
  expect(Number.isFinite(x)).toBe(true);
  expect(Number.isFinite(y)).toBe(true);
  return { x: x as number, y: y as number };
}

export async function clickAuthoredCoordinate(
  locator: Locator,
  x: number,
  y: number,
): Promise<void> {
  await locator.evaluate(
    (element, point) => {
      const rect = element.getBoundingClientRect();
      const image = element.querySelector("img");
      const authoredWidth = image?.naturalWidth || rect.width;
      const authoredHeight = image?.naturalHeight || rect.height;
      const clientX = Math.ceil(rect.left + ((point.x - 0.49) / authoredWidth) * rect.width);
      const clientY = Math.ceil(rect.top + ((point.y - 0.49) / authoredHeight) * rect.height);
      element.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          detail: 1,
          view: window,
        }),
      );
    },
    { x, y },
  );
}

async function reorderOrderItems(page: Page, response: string[]): Promise<void> {
  const orientation = await page.locator("qti-assessment-item-player").evaluate((element) => {
    const container =
      element.querySelector(".qti3-reorder-list") ?? element.querySelector(".qti3-order-sv-layout");
    return container?.getAttribute("data-qti-order-orientation") === "horizontal"
      ? "horizontal"
      : "vertical";
  });
  const { previous: previousDirection, next: nextDirection } =
    reorderMovementDirections(orientation);
  const current = await page.locator("qti-assessment-item-player").evaluate(() => {
    return [...document.querySelectorAll(".qti3-reorder-item")]
      .map((item) => (item as HTMLElement).dataset.choiceIdentifier)
      .filter((identifier): identifier is string => Boolean(identifier));
  });
  let moved = false;
  for (const [targetIndex, value] of response.entries()) {
    let currentIndex = current.indexOf(value);
    while (currentIndex > targetIndex) {
      await page
        .locator(
          `qti-assessment-item-player .qti3-reorder-item[data-choice-identifier="${value}"] [data-move-direction="${previousDirection}"]`,
        )
        .click();
      moved = true;
      current.splice(currentIndex, 1);
      current.splice(currentIndex - 1, 0, value);
      currentIndex -= 1;
    }
    while (currentIndex >= 0 && currentIndex < targetIndex) {
      await page
        .locator(
          `qti-assessment-item-player .qti3-reorder-item[data-choice-identifier="${value}"] [data-move-direction="${nextDirection}"]`,
        )
        .click();
      moved = true;
      current.splice(currentIndex, 1);
      current.splice(currentIndex + 1, 0, value);
      currentIndex += 1;
    }
  }
  if (!moved && current.length > 1) {
    const first = current[0];
    if (!first) return;
    const firstItem = page.locator(
      `qti-assessment-item-player .qti3-reorder-item[data-choice-identifier="${first}"]`,
    );
    await firstItem.locator(`[data-move-direction="${nextDirection}"]`).click();
    await firstItem.locator(`[data-move-direction="${previousDirection}"]`).click();
  }
}

export async function expectImageLoaded(locator: Locator): Promise<void> {
  await expect
    .poll(async () => {
      return locator.evaluate((image) => {
        const element = image as HTMLImageElement;
        return element.complete && element.naturalWidth > 0 && element.naturalHeight > 0;
      });
    })
    .toBe(true);
}

export async function assignGap(
  page: Page,
  interactionLabel: string,
  source: string,
  gapIdentifier: string,
): Promise<void> {
  const choices = page.locator(
    `qti-assessment-item-player [aria-label="${interactionLabel} choices"]`,
  );
  const sourceToken = choices.locator(`[data-choice-identifier="${source}"]`).first();
  if (await sourceToken.isVisible().catch(() => false)) {
    await sourceToken.click();
  } else {
    await choices.getByRole("button", { name: source }).click();
  }
  await page
    .locator(`qti-assessment-item-player [data-gap-identifier="${gapIdentifier}"]`)
    .getByRole("button")
    .first()
    .click();
}

export async function assignMatch(
  page: Page,
  sourceIdentifier: string,
  targetIdentifier: string,
): Promise<void> {
  const matrixCell = page.locator(
    `qti-assessment-item-player .qti3-match-table-cell[data-source-identifier="${sourceIdentifier}"][data-target-identifier="${targetIdentifier}"]`,
  );
  if (await matrixCell.isVisible().catch(() => false)) {
    await matrixCell.click();
    return;
  }

  await page
    .locator("qti-assessment-item-player .qti3-match-source-bank")
    .locator(`[data-choice-identifier="${sourceIdentifier}"]`)
    .click();
  await page
    .locator("qti-assessment-item-player .qti3-match-target-bank")
    .locator(`[data-choice-identifier="${targetIdentifier}"]`)
    .click();
}

async function clickToken(
  page: Page,
  regionSuffix: "sources" | "targets",
  identifierOrName: string | undefined,
): Promise<void> {
  if (!identifierOrName) return;
  const region = page.locator(`qti-assessment-item-player [aria-label$="${regionSuffix}"]`);
  await clickTokenInRegion(region, identifierOrName);
}

async function clickTokenInRegion(region: Locator, identifierOrName: string): Promise<void> {
  const byIdentifier = region.locator(`[data-choice-identifier="${identifierOrName}"]`).first();
  if (await byIdentifier.isVisible().catch(() => false)) {
    await byIdentifier.click();
    return;
  }
  await region.getByRole("button", { name: identifierOrName }).click();
}

export async function chooseInlineChoice(
  page: Page,
  responseIdentifier: string,
  value: string,
): Promise<void> {
  const interaction = page.locator(
    `qti-assessment-item-player [data-response-identifier="${responseIdentifier}"]`,
  );
  await interaction.locator(".qti3-inline-choice-trigger").click();
  await interaction.locator(`[role="option"][data-choice-identifier="${value}"]`).click();
}

export async function provideResponse(
  page: Page,
  interactionType: string,
  response: unknown,
  responseIdentifier = "RESPONSE",
): Promise<void> {
  if (interactionType === "inlineChoice") {
    await chooseInlineChoice(page, responseIdentifier, String(response));
    return;
  }

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

  if (interactionType === "selectPoint") {
    const [x, y] = String(response)
      .split(" ")
      .map((coordinate) => Number(coordinate));
    await clickAuthoredCoordinate(
      page.locator("qti-assessment-item-player .qti3-point-surface"),
      x,
      y,
    );
    return;
  }

  if (interactionType === "positionObject") {
    const [x, y] = String(response)
      .split(" ")
      .map((coordinate) => Number(coordinate));
    await page
      .locator("qti-assessment-item-player .qti3-position-object-stage")
      .click({ position: { x, y } });
    return;
  }

  if (interactionType === "drawing") {
    await page.locator("qti-assessment-item-player .qti3-drawing-surface").focus();
    await page.keyboard.press("Enter");
    return;
  }

  if (interactionType === "portableCustom") {
    await page
      .locator("qti-assessment-item-player .qti3-portable-custom-host")
      .evaluate((element, value) => {
        element.dispatchEvent(
          new CustomEvent("qti3-portable-custom-response", {
            detail: { value },
            bubbles: true,
          }),
        );
      }, response);
    return;
  }

  if (interactionType === "media") {
    await page
      .locator("qti-assessment-item-player audio, qti-assessment-item-player video")
      .evaluate((element) => {
        element.dispatchEvent(new Event("play"));
      });
    return;
  }

  if (interactionType === "endAttempt") {
    await page
      .locator('qti-assessment-item-player [data-interaction-type="endAttempt"]')
      .getByRole("button")
      .click();
    return;
  }

  if (interactionType === "hotspot") {
    await page
      .locator("qti-assessment-item-player .qti3-hotspot-surface")
      .getByRole("button", { name: String(response) })
      .click();
    return;
  }

  if (interactionType === "hottext") {
    await page
      .locator(
        `qti-assessment-item-player .qti3-hottext-token[data-choice-identifier="${String(response)}"]`,
      )
      .click();
    return;
  }

  if (
    Array.isArray(response) &&
    (interactionType === "gapMatch" || interactionType === "graphicGapMatch")
  ) {
    for (const pair of response) {
      const [source, target] = String(pair).split(" ");
      await assignGap(
        page,
        interactionType === "gapMatch" ? "Gap match" : "Graphic gap match",
        source,
        target,
      );
    }
    return;
  }

  if (Array.isArray(response) && interactionType === "match") {
    for (const pair of response) {
      const [source, target] = String(pair).split(" ");
      await assignMatch(page, source, target);
    }
    return;
  }

  if (Array.isArray(response) && interactionType === "graphicAssociate") {
    const surface = page.locator("qti-assessment-item-player .qti3-graphic-associate-surface");
    for (const pair of response) {
      const [source, target] = String(pair).split(" ");
      await surface.locator(`[data-choice-identifier="${source}"]`).click();
      await surface.locator(`[data-choice-identifier="${target}"]`).click();
    }
    return;
  }

  if (Array.isArray(response) && response.some((value) => String(value).includes(" "))) {
    for (const pair of response) {
      const [source, target] = String(pair).split(" ");
      await clickToken(page, "sources", source);
      await clickToken(page, "targets", target);
    }
    return;
  }

  if (Array.isArray(response) && interactionType === "graphicOrder") {
    const surface = page.locator("qti-assessment-item-player .qti3-graphic-order-surface");
    for (const identifier of response.map(String)) {
      await surface.locator(`[data-choice-identifier="${identifier}"]`).click();
    }
    return;
  }

  if (Array.isArray(response) && interactionType === "order") {
    const identifiers = response.map(String);
    const bank = page.locator("qti-assessment-item-player .qti3-order-choices-bank");
    if ((await bank.count()) > 0) {
      for (const identifier of identifiers) {
        const bankChoice = bank.locator(`[data-choice-identifier="${identifier}"]`).first();
        if (await bankChoice.isVisible().catch(() => false)) {
          await bankChoice.click();
        }
      }
    }
    await reorderOrderItems(page, identifiers);
    return;
  }

  const value = Array.isArray(response) ? String(response[0]) : String(response);
  const choiceInput = page
    .locator(`qti-assessment-item-player [data-choice-identifier="${value}"] input`)
    .first();
  if (await choiceInput.isVisible().catch(() => false)) {
    await choiceInput.check();
    return;
  }

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

export async function loadedItemIdentifier(player: Locator): Promise<string | undefined> {
  return player.evaluate((element) => {
    const qtiPlayer = element as HTMLElement & {
      serialize: () => { itemIdentifier?: string } | null;
    };
    return qtiPlayer.serialize()?.itemIdentifier;
  });
}

export async function expectDebugTemplateValues(
  page: Page,
  templateValues: Record<string, number>,
): Promise<void> {
  for (const [identifier, value] of Object.entries(templateValues)) {
    await expect(page.locator("#debug-template-values")).toContainText(
      `"${identifier}": ${JSON.stringify(value)}`,
    );
  }
}
