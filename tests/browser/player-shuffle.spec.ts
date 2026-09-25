import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { buildQti3OrderItem } from "../../packages/writer/src/index.js";
import { expectNoAxeViolationsOnPlayer } from "./axe-helpers.js";
import {
  playerLocator,
  serializePlayer,
  restorePlayerState,
  scorePlayerAttempt,
} from "./player-test-api.js";

const cases = [
  { type: "choice", region: "choice", expected: ["D", "B", "E", "A", "C"] },
  { type: "order", region: "choice", expected: ["C", "B", "D", "A"] },
  { type: "inlineChoice", region: "choice", expected: ["C", "B", "A", "D"] },
  { type: "associate", region: "source", expected: ["C", "B", "A", "E", "D"] },
  { type: "match", region: "source", expected: ["C", "B", "A", "D"] },
  { type: "gapMatch", region: "source", expected: ["C", "A", "D", "B"] },
];
const choiceId = "data-qti-player-choice-identifier";
function fixture(type: string): string {
  return readFileSync(
    new URL(`../../packages/fixtures/xml/shuffle/${type}.xml`, import.meta.url),
    "utf8",
  );
}
async function load(page: Page, xml: string, seed: string | number = 31): Promise<void> {
  await playerLocator(page).evaluate(
    async (element, input) => {
      await element.loadXml(input.xml, { sessionOptions: { presentationSeed: input.seed } });
    },
    { xml, seed },
  );
}
function regions(page: Page, kind: string) {
  return playerLocator(page)
    .locator(".qti3-interaction")
    .first()
    .locator(`[data-qti-player-region-kind="${kind}"]`);
}
async function order(page: Page, kind: string): Promise<(string | null)[]> {
  return regions(page, kind).evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-qti-player-choice-identifier")),
  );
}
async function activate(page: Page, kind: string, identifier: string): Promise<void> {
  await playerLocator(page)
    .locator(".qti3-interaction")
    .first()
    .locator(`[data-qti-player-region-kind="${kind}"][${choiceId}="${identifier}"]`)
    .press("Enter");
}

for (const entry of cases) {
  test(`shuffle ${entry.type}: stable DOM order, unanswered restore, keyboard response and scoring`, async ({
    page,
  }) => {
    await page.goto("/");
    await load(page, fixture(entry.type));
    expect(await order(page, entry.region)).toEqual(entry.expected);
    const initial = await serializePlayer(page);
    expect(initial?.responses).toEqual({});
    expect(initial?.builtInVariables?.numAttempts).toBe(0);
    if (!initial) throw new Error("Expected state");
    if (entry.type === "match")
      expect(await order(page, "target")).toEqual(["G1", "G3", "G2", "G4"]);
    if (entry.type === "associate") expect(await order(page, "target")).toEqual(entry.expected);
    if (entry.type === "gapMatch") expect(await order(page, "target")).toEqual(["G1", "G2"]);
    // A fresh player load and a different seed must reproduce the saved presentation.
    await playerLocator(page).evaluate(
      async (element, input) => {
        await element.loadXml(input.xml, {
          state: input.state,
          sessionOptions: { presentationSeed: 999 },
        });
      },
      { xml: fixture(entry.type), state: initial },
    );
    expect(await order(page, entry.region)).toEqual(entry.expected);
    await playerLocator(page).evaluate((element) => {
      element.locale = "en";
    });
    expect(await order(page, entry.region)).toEqual(entry.expected);
    await expectNoAxeViolationsOnPlayer(page, `${entry.type} shuffled`);

    if (entry.type === "choice") {
      const input = playerLocator(page).locator('input[value="A"]');
      await input.press("Space");
      await expect(input).toBeChecked();
      expect((await serializePlayer(page))?.responses.RESPONSE).toBe("A");
    } else if (entry.type === "order") {
      for (const identifier of ["D", "C", "B", "A"]) {
        const handle = playerLocator(page).locator(
          `.qti3-reorder-handle[data-choice-identifier="${identifier}"]`,
        );
        for (let step = 0; step < 3; step++) await handle.press("ArrowUp");
        await expect(handle).toBeFocused();
      }
      expect((await serializePlayer(page))?.responses.RESPONSE).toEqual(["A", "B", "C", "D"]);
      // fixed prevents initial shuffling, not learner movement.
      await expect(
        playerLocator(page).locator('.qti3-reorder-handle[data-choice-identifier="B"]'),
      ).toHaveAttribute("aria-label", /2/);
    } else if (entry.type === "inlineChoice") {
      for (const [index, steps] of [3, 2].entries()) {
        const interaction = playerLocator(page).locator(".qti3-inlineChoice").nth(index);
        await interaction.locator(".qti3-inline-choice-trigger").press("ArrowDown");
        await page.keyboard.press("Home");
        for (let step = 0; step < steps; step++) await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
        await expect(interaction.locator(".qti3-inline-choice-trigger")).toBeFocused();
      }
      expect((await serializePlayer(page))?.responses).toEqual({
        RESPONSE_DECLARATION: "A",
        RESPONSE_OUTCOME: "B",
      });
    } else {
      const pairs =
        entry.type === "associate"
          ? [["A", "B"]]
          : entry.type === "gapMatch"
            ? [
                ["A", "G1"],
                ["B", "G2"],
              ]
            : [
                ["A", "G1"],
                ["B", "G2"],
                ["C", "G3"],
                ["D", "G4"],
              ];
      for (const [source, target] of pairs) {
        if (!source || !target) throw new Error("Expected pair");
        await activate(page, "source", source);
        if (entry.type === "gapMatch") {
          await regions(page, "target")
            .locator(`:scope[${choiceId}="${target}"] button`)
            .press("Enter");
        } else await activate(page, "target", target);
      }
      expect((await serializePlayer(page))?.responses.RESPONSE).toEqual(
        pairs.map((pair) => pair.join(" ")),
      );
    }
    const scored = await scorePlayerAttempt(page);
    expect(scored?.outcomes.SCORE).toBe(entry.type === "inlineChoice" ? 2 : 1);
    expect(scored?.state.presentation).toEqual(initial.presentation);
    if (!scored) throw new Error("Expected scoring result");
    const answeredOrder = await order(page, entry.region);
    await playerLocator(page).evaluate((element) => element.reset());
    await restorePlayerState(page, scored.state);
    expect(await order(page, entry.region)).toEqual(answeredOrder);
    expect((await serializePlayer(page))?.responses).toEqual(scored.state.responses);
  });
}

test("writer order item is shuffled, reset is reproducible, and restoration errors are atomic", async ({
  page,
}) => {
  await page.goto("/");
  const xml = buildQti3OrderItem({
    identifier: "issue-31",
    title: "Order the steps",
    shuffle: true,
    choices: [
      { identifier: "A", text: "First" },
      { identifier: "B", text: "Second", fixed: true },
      { identifier: "C", text: "Third" },
      { identifier: "D", text: "Fourth" },
    ],
    correctOrder: ["A", "B", "C", "D"],
  });
  await load(page, xml);
  expect(await order(page, "choice")).toEqual(["C", "B", "D", "A"]);
  await playerLocator(page).evaluate((element) => element.reset());
  expect(await order(page, "choice")).toEqual(["C", "B", "D", "A"]);
  const saved = await serializePlayer(page);
  if (!saved) throw new Error("Expected saved attempt");
  const errors = await playerLocator(page).evaluate((element, state) => {
    const codes: string[] = [];
    element.addEventListener("qti-diagnostics", (event) => {
      codes.push(...event.detail.diagnostics.map((diagnostic) => diagnostic.code));
    });
    element.restore({ ...state, presentation: { schema: "qti3.presentation.v1", orders: {} } });
    return { state: element.serialize(), codes };
  }, saved);
  expect(errors.state?.presentation).toEqual(saved.presentation);
  expect(errors.codes).toContain("presentation.order.invalid");
  expect(await order(page, "choice")).toEqual(["C", "B", "D", "A"]);
});

test("unseeded load and reset save a valid unanswered presentation", async ({ page }) => {
  await page.goto("/");
  const states = await playerLocator(page).evaluate(async (element, xml) => {
    await element.loadXml(xml);
    const first = element.serialize();
    element.reset();
    return [first, element.serialize()];
  }, fixture("associate"));
  for (const state of states) {
    expect(state?.presentation?.schema).toBe("qti3.presentation.v1");
    expect(Object.values(state?.presentation?.orders ?? {})[0]?.toSorted()).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
    ]);
    expect(state?.responses).toEqual({});
  }
});

test("shared-vocabulary order bank and tabular match use the same presentation", async ({
  page,
}) => {
  await page.goto("/");
  await load(
    page,
    fixture("order").replace(
      'shuffle="true"',
      'shuffle="true" class="qti-choices-top qti-labels-decimal"',
    ),
  );
  expect(await order(page, "source")).toEqual(["C", "B", "D", "A"]);
  expect((await serializePlayer(page))?.responses).toEqual({});
  await expectNoAxeViolationsOnPlayer(page);
  await load(
    page,
    fixture("match").replace(
      'shuffle="true"',
      'shuffle="true" class="qti-match-tabular" data-first-column-header="Observations"',
    ),
  );
  expect(
    await playerLocator(page)
      .locator("tbody tr")
      .evaluateAll((rows) =>
        rows.map((row) => row.querySelector("button")?.dataset.sourceIdentifier),
      ),
  ).toEqual(["C", "B", "A", "D"]);
  expect(
    await playerLocator(page)
      .locator("tbody tr")
      .first()
      .locator("button")
      .evaluateAll((buttons) => buttons.map((button) => button.dataset.targetIdentifier)),
  ).toEqual(["G1", "G3", "G2", "G4"]);
  await expectNoAxeViolationsOnPlayer(page);
});

test("effective order default takes precedence over the shuffled initial list", async ({
  page,
}) => {
  await page.goto("/");
  const xml = fixture("order").replace(
    "<qti-correct-response>",
    "<qti-default-value><qti-value>D</qti-value><qti-value>C</qti-value><qti-value>B</qti-value><qti-value>A</qti-value></qti-default-value><qti-correct-response>",
  );
  await load(page, xml);
  expect(await order(page, "choice")).toEqual(["D", "C", "B", "A"]);
  expect((await serializePlayer(page))?.responses).toEqual({});
});
