import { expect, test, type Page } from "@playwright/test";
import { interactionFixtures } from "../../packages/fixtures/src/index.js";

const validItemXml = interactionFixtures.find((fixture) => fixture.id === "choice-reference")!.xml;

const adapterPages = [
  { name: "React", path: "/adapter-react-contract.html" },
  { name: "Preact", path: "/adapter-preact-contract.html" },
] as const;

type HarnessMethod =
  | "clearItemCallCount"
  | "dispatchReady"
  | "elementSnapshot"
  | "eventLogSnapshot"
  | "flush"
  | "handleSnapshot"
  | "installClearItemSpy"
  | "installLoadXmlMock"
  | "loadXmlCallSnapshot"
  | "mockCurrentElementSerialize"
  | "render"
  | "rerender"
  | "resetMocks"
  | "resolvePendingLoad"
  | "restoreLoadXml";

type BrowserHarness = Record<HarnessMethod, (...args: unknown[]) => unknown>;

for (const adapter of adapterPages) {
  test.describe(`QtiAssessmentItemPlayer ${adapter.name} adapter`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(adapter.path);
      await callHarness(page, "resetMocks");
    });

    test("renders one player element and forwards DOM props", async ({ page }) => {
      await callHarness(page, "render", {
        "aria-label": "Preview item",
        className: "preview",
        "data-item-id": "A",
      });

      await expectSnapshot(page, {
        ariaLabel: "Preview item",
        className: "preview",
        count: 1,
        dataItemId: "A",
        instanceOfPlayer: true,
      });
    });

    test("loads XML after synchronous diagnostics listeners are registered", async ({ page }) => {
      await callHarness(page, "installLoadXmlMock", "diagnostics");
      await callHarness(page, "render", { xml: "<item/>" });

      expect(await callHarness(page, "loadXmlCallSnapshot")).toEqual([
        { xml: "<item/>", options: undefined },
      ]);
      expect(await callHarness(page, "eventLogSnapshot")).toContainEqual({
        detail: { diagnostics: [{ code: "x" }] },
        label: "",
        type: "diagnostics",
      });
    });

    test("does not reload for equivalent inline load options but reloads for load-key changes", async ({
      page,
    }) => {
      await callHarness(page, "installLoadXmlMock", "resolve");
      await callHarness(page, "render", {
        loadOptions: { sessionControl: { showFeedback: false }, status: "interacting" },
        xml: "<item/>",
      });
      await callHarness(page, "rerender", {
        loadOptions: { sessionControl: { showFeedback: false }, status: "interacting" },
        xml: "<item/>",
      });
      await callHarness(page, "rerender", {
        loadOptions: { sessionControl: { showFeedback: false }, status: "completed" },
        xml: "<item/>",
      });

      expect(await callHarness<unknown[]>(page, "loadXmlCallSnapshot")).toHaveLength(2);
    });

    test("does not reload for equivalent restored state with a new object reference", async ({
      page,
    }) => {
      const state = {
        itemIdentifier: "ITEM-1",
        outcomes: {},
        responses: {},
        schema: "qti3.attempt-state.v1",
        status: "interacting",
        validationMessages: [],
      };
      await callHarness(page, "installLoadXmlMock", "resolve");
      await callHarness(page, "render", { loadOptions: { state }, xml: "<item/>" });
      await callHarness(page, "rerender", { loadOptions: { state: { ...state } }, xml: "<item/>" });

      expect(await callHarness<unknown[]>(page, "loadXmlCallSnapshot")).toHaveLength(1);
    });

    test("reports declarative load failures", async ({ page }) => {
      await callHarness(page, "installLoadXmlMock", "reject");
      await callHarness(page, "render", { xml: "<item/>" });
      await callHarness(page, "flush");

      expect(await callHarness(page, "eventLogSnapshot")).toContainEqual({
        label: "",
        message: "load failed",
        name: "Error",
        type: "loadError",
      });
    });

    test("syncs messageCatalog to the player element", async ({ page }) => {
      const messageCatalog = { locale: "sv-SE", strings: { remove: "Ta bort" } };
      await callHarness(page, "installLoadXmlMock", "resolve");
      await callHarness(page, "render", { messageCatalog, xml: "<item/>" });

      await expectSnapshot(page, { instanceOfPlayer: true, messageCatalog });
    });

    test("uses the latest event callback after rerender", async ({ page }) => {
      await callHarness(page, "installLoadXmlMock", "resolve");
      await callHarness(page, "render", { readyLabel: "first", xml: "<item/>" });
      await callHarness(page, "rerender", { readyLabel: "second", xml: "<item/>" });
      await callHarness(page, "dispatchReady", "ITEM-1");

      expect(await callHarness(page, "eventLogSnapshot")).toContainEqual({
        detail: { item: { identifier: "ITEM-1" } },
        label: "second",
        type: "ready",
      });
    });

    test("clears the player when xml becomes undefined", async ({ page }) => {
      await callHarness(page, "installLoadXmlMock", "resolve");
      await callHarness(page, "installClearItemSpy");
      await callHarness(page, "render", { xml: "<item/>" });
      await callHarness(page, "rerender", { xml: undefined });

      expect(await callHarness(page, "clearItemCallCount")).toBe(1);
    });

    test("ignores superseded async load completions", async ({ page }) => {
      await callHarness(page, "installLoadXmlMock", "pending");
      await callHarness(page, "render", { xml: "<first/>" });
      await callHarness(page, "restoreLoadXml");
      await callHarness(page, "rerender", { xml: validItemXml });
      await expect
        .poll(
          async () =>
            (await callHarness<ElementSnapshot>(page, "elementSnapshot")).childElementCount,
        )
        .toBeGreaterThan(0);

      await callHarness(page, "resolvePendingLoad", 0);
      await callHarness(page, "flush");

      const snapshot = await callHarness<ElementSnapshot>(page, "elementSnapshot");
      expect(snapshot.childElementCount).toBeGreaterThan(0);
      expect(snapshot.textContent).not.toContain("Unable to parse QTI item.");
      expect(snapshot.serializedItemIdentifier).toBeTruthy();
    });

    test("exposes an imperative handle", async ({ page }) => {
      await callHarness(page, "installLoadXmlMock", "resolve");
      await callHarness(page, "render");
      await callHarness(page, "mockCurrentElementSerialize", { schema: "qti3.attempt-state.v1" });

      expect(await callHarness(page, "handleSnapshot")).toEqual({
        hasElement: true,
        serializeCalls: 1,
        serialized: { schema: "qti3.attempt-state.v1" },
      });
    });
  });
}

interface ElementSnapshot {
  ariaLabel: string | null;
  childElementCount: number;
  className: string | null;
  count: number;
  dataItemId: string | null;
  instanceOfPlayer: boolean;
  messageCatalog?: unknown;
  serializedItemIdentifier?: string;
  textContent: string;
}

async function expectSnapshot(page: Page, expected: Partial<ElementSnapshot>): Promise<void> {
  expect(await callHarness<ElementSnapshot>(page, "elementSnapshot")).toMatchObject(expected);
}

async function callHarness<T = unknown>(
  page: Page,
  method: HarnessMethod,
  ...args: unknown[]
): Promise<T> {
  return page.evaluate(
    ({ method: methodName, args: methodArgs }) => {
      const harness = (window as Window & { qti3AdapterHarness: BrowserHarness })
        .qti3AdapterHarness;
      return harness[methodName](...methodArgs);
    },
    { args, method },
  ) as Promise<T>;
}
