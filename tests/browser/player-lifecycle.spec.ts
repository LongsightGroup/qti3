import { expect, test } from "@playwright/test";
import { catalogFixtures, interactionFixtures } from "../../packages/fixtures/src/index.js";
import { UNSUPPORTED_INTERACTION_ITEM } from "./fixtures/dom-behavior-items.js";
import { sliderItem } from "./fixtures/slider-items.js";
import { loadFixture, pasteXml } from "./player-helpers.js";

const SEEDED_TEMPLATE_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="seeded-player-session" title="seeded-player-session" time-dependent="false">
  <qti-template-declaration identifier="VALUE" cardinality="single" base-type="integer"/>
  <qti-template-processing>
    <qti-set-template-value identifier="VALUE">
      <qti-random-integer min="1" max="1000000000"/>
    </qti-set-template-value>
  </qti-template-processing>
  <qti-item-body><p>Variant <qti-printed-variable identifier="VALUE"/></p></qti-item-body>
</qti-assessment-item>`;

const CUSTOM_OPERATOR_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="custom-operator-player-session" title="custom-operator-player-session" time-dependent="false">
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-item-body><p>Custom operator lifecycle test.</p></qti-item-body>
  <qti-response-processing>
    <qti-set-outcome-value identifier="SCORE">
      <qti-custom-operator definition="double">
        <qti-base-value base-type="integer">4</qti-base-value>
      </qti-custom-operator>
    </qti-set-outcome-value>
  </qti-response-processing>
</qti-assessment-item>`;

test.describe("player lifecycle", () => {
  test("ignores stale loadUrl completions after a newer load starts", async ({ page }) => {
    const choiceFixture = interactionFixtures.find((fixture) => fixture.id === "choice-reference");
    if (!choiceFixture) throw new Error("Missing choice-reference fixture.");

    await page.goto("/");
    await page.evaluate(() => customElements.whenDefined("qti-assessment-item-player"));
    const result = await page.evaluate(async (xml) => {
      const player = document.createElement("qti-assessment-item-player");
      document.body.append(player);

      let resolveFirstFetch: ((xml: string) => void) | undefined;
      const firstFetch = new Promise<string>((resolve) => {
        resolveFirstFetch = resolve;
      });
      let fetchCount = 0;
      const readyEvents: string[] = [];
      player.addEventListener("qti-ready", () => readyEvents.push("qti-ready"));

      const fetchXml = async () => {
        fetchCount += 1;
        return fetchCount === 1 ? firstFetch : xml;
      };

      const firstLoad = player.loadUrl("first.xml", { fetchXml });
      const secondLoad = player.loadUrl("second.xml", { fetchXml });
      await secondLoad;
      const readyAfterSecondLoad = readyEvents.length;
      resolveFirstFetch?.("<not-valid-qti/>");
      await firstLoad;

      const snapshot = {
        childElementCount: player.childElementCount,
        itemIdentifier: player.serialize()?.itemIdentifier,
        readyAfterSecondLoad,
        readyTotal: readyEvents.length,
        textContent: player.textContent ?? "",
      };
      player.remove();
      return snapshot;
    }, choiceFixture.xml);

    expect(result.readyAfterSecondLoad).toBe(1);
    expect(result.readyTotal).toBe(1);
    expect(result.childElementCount).toBeGreaterThan(0);
    expect(result.itemIdentifier).toBe(choiceFixture.id);
    expect(result.textContent).not.toContain("Unable to parse QTI item.");
  });

  test("clears rendered content when clearItem is called", async ({ page }) => {
    const choiceXml = interactionFixtures.find((fixture) => fixture.id === "choice-reference")!.xml;

    await page.goto("/");
    await page.evaluate(() => customElements.whenDefined("qti-assessment-item-player"));
    const result = await page.evaluate(async (xml) => {
      const player = document.createElement("qti-assessment-item-player");
      document.body.append(player);

      await player.loadXml(xml);
      const childCountAfterLoad = player.childElementCount;
      player.clearItem();
      const snapshot = {
        childCountAfterClear: player.childElementCount,
        childCountAfterLoad,
        serializedAfterClear: player.serialize(),
      };
      player.remove();
      return snapshot;
    }, choiceXml);

    expect(result.childCountAfterLoad).toBeGreaterThan(0);
    expect(result.childCountAfterClear).toBe(0);
    expect(result.serializedAfterClear).toBeUndefined();
  });

  test("unloads the current item when loadUrl fetch fails", async ({ page }) => {
    const catalogFixture = catalogFixtures.find(
      (fixture) => fixture.id === "catalog-glossary-inline",
    );
    if (!catalogFixture) throw new Error("Missing catalog-glossary-inline fixture.");

    await page.goto("/");
    await page.evaluate(() => customElements.whenDefined("qti-assessment-item-player"));
    const result = await page.evaluate(async (xml) => {
      const player = document.createElement("qti-assessment-item-player");
      document.body.append(player);
      await player.loadXml(xml);
      const renderedCatalogReferencesBeforeFailure = player.getRenderedCatalogReferences().length;

      const diagnostics: Array<{
        diagnostics: Array<{ code: string; message: string; severity: string }>;
      }> = [];
      let serializedInDiagnostic: ReturnType<typeof player.serialize>;
      let textContentInDiagnostic: string | undefined;
      player.addEventListener("qti-diagnostics", (event) => {
        serializedInDiagnostic = player.serialize();
        textContentInDiagnostic = player.textContent ?? "";
        diagnostics.push(
          (
            event as CustomEvent<{
              diagnostics: Array<{ code: string; message: string; severity: string }>;
            }>
          ).detail,
        );
      });

      await player.loadUrl("missing.xml", {
        fetchXml: async () => {
          throw new Error("network unavailable");
        },
      });

      const snapshot = {
        diagnostics,
        renderedCatalogReferences: player.getRenderedCatalogReferences().length,
        renderedCatalogReferencesBeforeFailure,
        score: player.scoreAttempt({ validateResponses: false }),
        serialized: player.serialize(),
        serializedInDiagnostic,
        textContent: player.textContent ?? "",
        textContentInDiagnostic,
        textToSpeechTraversal: player.getTextToSpeechTraversal(),
      };
      player.remove();
      return snapshot;
    }, catalogFixture.xml);

    expect(result.diagnostics.at(-1)).toEqual({
      diagnostics: [
        expect.objectContaining({
          code: "player.loadUrl",
          message: "network unavailable",
          severity: "error",
        }),
      ],
    });
    expect(result.serializedInDiagnostic).toBeUndefined();
    expect(result.textContentInDiagnostic).toContain("Unable to load QTI item.");
    expect(result.serialized).toBeUndefined();
    expect(result.score).toBeUndefined();
    expect(result.textToSpeechTraversal).toBeUndefined();
    expect(result.renderedCatalogReferencesBeforeFailure).toBe(1);
    expect(result.renderedCatalogReferences).toBe(0);
    expect(result.textContent).toContain("Unable to load QTI item.");
  });

  test("unloads the current item when loadXml cannot parse a document", async ({ page }) => {
    const choiceFixture = interactionFixtures.find((fixture) => fixture.id === "choice-reference");
    if (!choiceFixture) throw new Error("Missing choice-reference fixture.");

    await page.goto("/");
    await page.evaluate(() => customElements.whenDefined("qti-assessment-item-player"));
    const result = await page.evaluate(async (xml) => {
      const player = document.createElement("qti-assessment-item-player");
      document.body.append(player);
      await player.loadXml(xml);

      const diagnosticCodes: string[] = [];
      player.addEventListener("qti-diagnostics", (event) => {
        const detail = (event as CustomEvent<{ diagnostics: Array<{ code: string }> }>).detail;
        diagnosticCodes.push(...detail.diagnostics.map((diagnostic) => diagnostic.code));
      });

      await player.loadXml("<not-valid-qti/>");

      const snapshot = {
        diagnosticCodes,
        renderedCatalogReferences: player.getRenderedCatalogReferences().length,
        score: player.scoreAttempt({ validateResponses: false }),
        serialized: player.serialize(),
        textContent: player.textContent ?? "",
        textToSpeechTraversal: player.getTextToSpeechTraversal(),
      };
      player.remove();
      return snapshot;
    }, choiceFixture.xml);

    expect(result.diagnosticCodes).toContain("qti.root");
    expect(result.serialized).toBeUndefined();
    expect(result.score).toBeUndefined();
    expect(result.textToSpeechTraversal).toBeUndefined();
    expect(result.renderedCatalogReferences).toBe(0);
    expect(result.textContent).toContain("Unable to parse QTI item.");
  });

  test("reports restore misuse as diagnostics instead of throwing", async ({ page }) => {
    const choiceFixture = interactionFixtures.find((fixture) => fixture.id === "choice-reference");
    if (!choiceFixture) throw new Error("Missing choice-reference fixture.");

    await page.goto("/");
    await page.evaluate(() => customElements.whenDefined("qti-assessment-item-player"));
    const result = await page.evaluate(async (xml) => {
      const player = document.createElement("qti-assessment-item-player");
      document.body.append(player);
      const diagnostics: Array<{
        diagnostics: Array<{ code: string; message: string; severity: string }>;
      }> = [];
      let restoreEvents = 0;
      player.addEventListener("qti-diagnostics", (event) => {
        diagnostics.push(
          (
            event as CustomEvent<{
              diagnostics: Array<{ code: string; message: string; severity: string }>;
            }>
          ).detail,
        );
      });
      player.addEventListener("qti-restore", () => {
        restoreEvents += 1;
      });

      player.restore({
        itemIdentifier: "choice-reference",
        outcomes: {},
        responses: {},
        schema: "qti3.attempt-state.v1",
        status: "initialized",
        validationMessages: [],
      });
      const beforeLoadDiagnostic = diagnostics.at(-1);

      await player.loadXml(xml);
      const state = player.serialize();
      if (!state) throw new Error("Expected loaded player state.");
      player.restore({ ...state, itemIdentifier: "other-item" });

      const snapshot = {
        beforeLoadDiagnostic,
        incompatibleStateDiagnostic: diagnostics.at(-1),
        restoreEvents,
        serializedAfterIncompatibleRestore: player.serialize(),
      };
      player.remove();
      return snapshot;
    }, choiceFixture.xml);

    expect(result.beforeLoadDiagnostic).toEqual({
      diagnostics: [
        expect.objectContaining({
          code: "player.restoreState",
          message: "Cannot restore QTI state before loading an item.",
          severity: "error",
        }),
      ],
    });
    expect(result.incompatibleStateDiagnostic).toEqual({
      diagnostics: [
        expect.objectContaining({
          code: "player.restoreState",
          message: "Cannot restore state for other-item into choice-reference.",
          severity: "error",
        }),
      ],
    });
    expect(result.restoreEvents).toBe(0);
    expect(result.serializedAfterIncompatibleRestore?.itemIdentifier).toBe(choiceFixture.id);
  });

  test("rejects a restored response outside the authored slider domain", async ({ page }) => {
    const xml = sliderItem({
      identifier: "restored-slider-domain",
      attributes: 'lower-bound="0" upper-bound="10" step="3"',
    });

    await page.goto("/");
    await page.evaluate(() => customElements.whenDefined("qti-assessment-item-player"));
    const result = await page.evaluate(async (sliderXml) => {
      const player = document.createElement("qti-assessment-item-player");
      document.body.append(player);
      const diagnostics: Array<{
        diagnostics: Array<{ code: string; message: string; severity: string }>;
      }> = [];
      player.addEventListener("qti-diagnostics", (event) => {
        diagnostics.push(
          (
            event as CustomEvent<{
              diagnostics: Array<{ code: string; message: string; severity: string }>;
            }>
          ).detail,
        );
      });

      await player.loadXml(sliderXml);
      const state = player.serialize();
      if (!state) throw new Error("Expected loaded slider state.");
      player.restore({ ...state, responses: { RESPONSE: 4 } });
      const serialized = player.serialize();
      const snapshot = {
        diagnostic: diagnostics.at(-1),
        response: serialized?.responses.RESPONSE,
      };
      player.remove();
      return snapshot;
    }, xml);

    expect(result.diagnostic).toEqual({
      diagnostics: [
        expect.objectContaining({
          code: "player.restoreState",
          message:
            "Cannot restore response RESPONSE: value 4 is not in the authored slider domain.",
          severity: "error",
        }),
      ],
    });
    expect(result.response).toBeUndefined();
  });

  test("reports incompatible loadXml restored state as diagnostics instead of rejecting", async ({
    page,
  }) => {
    const choiceFixture = interactionFixtures.find((fixture) => fixture.id === "choice-reference");
    if (!choiceFixture) throw new Error("Missing choice-reference fixture.");

    await page.goto("/");
    await page.evaluate(() => customElements.whenDefined("qti-assessment-item-player"));
    const result = await page.evaluate(
      async ({ firstXml, secondXml }) => {
        const player = document.createElement("qti-assessment-item-player");
        document.body.append(player);
        await player.loadXml(firstXml);
        const state = player.serialize();
        if (!state) throw new Error("Expected loaded player state.");

        const diagnostics: Array<{
          diagnostics: Array<{ code: string; message: string; severity: string }>;
        }> = [];
        player.addEventListener("qti-diagnostics", (event) => {
          diagnostics.push(
            (
              event as CustomEvent<{
                diagnostics: Array<{ code: string; message: string; severity: string }>;
              }>
            ).detail,
          );
        });
        await player.loadXml(secondXml, { state });

        const snapshot = {
          diagnostics,
          serialized: player.serialize(),
          textContent: player.textContent ?? "",
          textToSpeechTraversal: player.getTextToSpeechTraversal(),
        };
        player.remove();
        return snapshot;
      },
      { firstXml: choiceFixture.xml, secondXml: UNSUPPORTED_INTERACTION_ITEM },
    );

    expect(result.diagnostics).toHaveLength(2);
    expect(result.diagnostics.at(0)).toEqual({
      diagnostics: expect.arrayContaining([
        expect.objectContaining({
          code: "interaction.unsupported",
          severity: "warning",
        }),
      ]),
    });
    expect(result.diagnostics.at(1)).toEqual({
      diagnostics: [
        expect.objectContaining({
          code: "player.restoreState",
          message: "Cannot restore state for choice-reference into unsupported-interaction.",
          severity: "error",
        }),
      ],
    });
    expect(result.serialized).toBeUndefined();
    expect(result.textToSpeechTraversal).toBeUndefined();
    expect(result.textContent).toContain("Unable to restore QTI state.");
  });

  test("supports host lifecycle methods for state restore and attempt control", async ({
    page,
  }) => {
    const fixture =
      interactionFixtures.find((item) => item.interactionType === "choice") ??
      interactionFixtures[0];
    if (!fixture) throw new Error("Missing choice fixture.");

    await page.goto("/");
    await pasteXml(page, fixture.xml);
    await page.locator('qti-assessment-item-player [data-choice-identifier="A"] input').check();

    const answeredState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(answeredState.responses.RESPONSE).toBe("A");
    expect(answeredState.status).toBe("interacting");

    const resetState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      element.reset();
      return element.serialize();
    });
    expect(resetState.responses.RESPONSE).toBeUndefined();
    expect(resetState.status).toBe("initialized");

    const lifecycle = await page
      .locator("qti-assessment-item-player")
      .evaluate((element, state) => {
        const events: string[] = [];
        for (const eventName of ["qti-restore", "qti-suspend", "qti-endattempt"]) {
          element.addEventListener(eventName, () => events.push(eventName));
        }
        element.restore(state);
        const restored = element.serialize();
        element.suspend();
        const suspended = element.serialize();
        element.endAttempt();
        const completed = element.serialize();
        return { events, restored, suspended, completed };
      }, answeredState);

    expect(lifecycle.events).toEqual(["qti-restore", "qti-suspend", "qti-endattempt"]);
    expect(lifecycle.restored.status).toBe("interacting");
    expect(lifecycle.suspended.status).toBe("suspended");
    expect(lifecycle.completed.status).toBe("completed");
    const restoredState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(restoredState.responses.RESPONSE).toBe("A");
    expect(restoredState.outcomes.SCORE).toBe(1);
  });

  test("preserves a seeded template variant across reset", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => customElements.whenDefined("qti-assessment-item-player"));

    const values = await page.evaluate(async (xml) => {
      const loadVariant = async (randomSeed: string) => {
        const player = document.createElement("qti-assessment-item-player");
        document.body.append(player);
        await player.loadXml(xml, { sessionOptions: { randomSeed } });
        const value = player.serialize()?.templateValues?.VALUE;
        return { player, value };
      };

      const seeded = await loadVariant("variant-a");
      const stateContainsCapabilities = Object.hasOwn(
        seeded.player.serialize() ?? {},
        "sessionOptions",
      );
      seeded.player.reset();
      const resetValue = seeded.player.serialize()?.templateValues?.VALUE;
      const other = await loadVariant("variant-b");
      seeded.player.remove();
      other.player.remove();
      return {
        initialValue: seeded.value,
        otherSeedValue: other.value,
        resetValue,
        stateContainsCapabilities,
      };
    }, SEEDED_TEMPLATE_ITEM);

    expect(values.initialValue).toBeDefined();
    expect(values.initialValue).toBe(737531934);
    expect(values.resetValue).toBe(values.initialValue);
    expect(values.otherSeedValue).toBe(358426569);
    expect(values.stateContainsCapabilities).toBe(false);
  });

  test("preserves custom operators across restore", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => customElements.whenDefined("qti-assessment-item-player"));

    const scores = await page.evaluate(async (xml) => {
      const player = document.createElement("qti-assessment-item-player");
      document.body.append(player);
      await player.loadXml(xml, {
        sessionOptions: {
          customOperators: {
            double: ({ values }) => Number(values[0]) * 2,
          },
        },
      });
      const initialState = player.serialize();
      if (!initialState) throw new Error("Expected initial player state.");
      const initialScore = player.scoreAttempt({ validateResponses: false })?.outcomes.SCORE;
      player.restore(initialState);
      const restoredScore = player.scoreAttempt({ validateResponses: false })?.outcomes.SCORE;
      player.remove();
      return { initialScore, restoredScore };
    }, CUSTOM_OPERATOR_ITEM);

    expect(scores.initialScore).toBe(8);
    expect(scores.restoredScore).toBe(8);
  });

  test("end-attempt interaction writes its boolean response and reveals adaptive feedback", async ({
    page,
  }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="hint-end" title="hint-end" adaptive="true" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-response-declaration identifier="HINTREQUEST" cardinality="single" base-type="boolean"/>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <p>Use the hint control to request adaptive feedback.</p>
    <qti-choice-interaction response-identifier="RESPONSE" min-choices="0">
      <qti-simple-choice identifier="A">Correct</qti-simple-choice>
      <qti-simple-choice identifier="B">Incorrect</qti-simple-choice>
    </qti-choice-interaction>
    <qti-end-attempt-interaction response-identifier="HINTREQUEST" title="Show Hint"/>
    <qti-feedback-block identifier="HINT" outcome-identifier="FEEDBACK" show-hide="show">
      <qti-content-body><p>Hint feedback is now visible.</p></qti-content-body>
    </qti-feedback-block>
  </qti-item-body>
  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-variable identifier="HINTREQUEST"/>
        <qti-set-outcome-value identifier="FEEDBACK">
          <qti-base-value base-type="identifier">HINT</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-if>
    </qti-response-condition>
    <qti-response-condition>
      <qti-response-if>
        <qti-match><qti-variable identifier="RESPONSE"/><qti-correct identifier="RESPONSE"/></qti-match>
        <qti-set-outcome-value identifier="SCORE">
          <qti-base-value base-type="float">1</qti-base-value>
        </qti-set-outcome-value>
        <qti-set-outcome-value identifier="completionStatus">
          <qti-base-value base-type="identifier">completed</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-if>
    </qti-response-condition>
  </qti-response-processing>
</qti-assessment-item>`;

    await page.goto("/");
    await pasteXml(page, xml);
    await page.getByRole("button", { name: "Show Hint" }).click();

    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(state.responses.HINTREQUEST).toBe(true);
    expect(state.outcomes.FEEDBACK).toBe("HINT");
    expect(state.status).toBe("interacting");
    await expect(page.locator("qti-assessment-item-player .qti3-feedback-block")).toContainText(
      "Hint feedback is now visible.",
    );

    await page.locator('qti-assessment-item-player [data-choice-identifier="A"] input').check();
    await page.locator("#debug-score").click();

    const completedState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(completedState.outcomes.completionStatus).toBe("completed");
    expect(completedState.status).toBe("completed");
  });

  test("endAttempt advances adaptive body branches without validating hidden responses", async ({
    page,
  }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="adaptive-body-branch" title="adaptive-body-branch" adaptive="true" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE1" cardinality="single" base-type="identifier"/>
  <qti-response-declaration identifier="RESPONSE21" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>OPTION210</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-response-declaration identifier="RESPONSE22" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>OPTION221</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier"/>
  <qti-outcome-declaration identifier="BODY" cardinality="multiple" base-type="identifier">
    <qti-default-value><qti-value>part1</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-item-body>
    <qti-feedback-block identifier="part1" outcome-identifier="BODY" show-hide="show">
      <qti-content-body>
        <p>Choose an input method.</p>
        <qti-choice-interaction response-identifier="RESPONSE1" max-choices="1">
          <qti-simple-choice identifier="OPTION1">Multiple choice</qti-simple-choice>
          <qti-simple-choice identifier="OPTION2">Drop-down menu</qti-simple-choice>
        </qti-choice-interaction>
      </qti-content-body>
    </qti-feedback-block>
    <qti-feedback-block identifier="part2" outcome-identifier="BODY" show-hide="show">
      <qti-content-body><p>Answer the second part.</p></qti-content-body>
    </qti-feedback-block>
    <qti-feedback-block identifier="option1" outcome-identifier="BODY" show-hide="show">
      <qti-content-body>
        <p>Choose the correct saying:</p>
        <qti-choice-interaction response-identifier="RESPONSE21" max-choices="1">
          <qti-simple-choice identifier="OPTION210">Too many cooks spoil the broth</qti-simple-choice>
          <qti-simple-choice identifier="OPTION211">Too many cooks burn the dinner</qti-simple-choice>
        </qti-choice-interaction>
      </qti-content-body>
    </qti-feedback-block>
    <qti-feedback-block identifier="option2" outcome-identifier="BODY" show-hide="show">
      <qti-content-body>
        <p>Complete the saying below by selecting from the list:</p>
        <qti-inline-choice-interaction response-identifier="RESPONSE22">
          <qti-inline-choice identifier="OPTION221">cooks</qti-inline-choice>
          <qti-inline-choice identifier="OPTION222">children</qti-inline-choice>
        </qti-inline-choice-interaction>
      </qti-content-body>
    </qti-feedback-block>
    <qti-feedback-inline identifier="CORRECT" outcome-identifier="FEEDBACK" show-hide="show">Correct.</qti-feedback-inline>
  </qti-item-body>
  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-member>
          <qti-base-value base-type="identifier">part1</qti-base-value>
          <qti-variable identifier="BODY"/>
        </qti-member>
        <qti-set-outcome-value identifier="BODY">
          <qti-multiple>
            <qti-base-value base-type="identifier">part2</qti-base-value>
          </qti-multiple>
        </qti-set-outcome-value>
        <qti-response-condition>
          <qti-response-if>
            <qti-match>
              <qti-variable identifier="RESPONSE1"/>
              <qti-base-value base-type="identifier">OPTION1</qti-base-value>
            </qti-match>
            <qti-set-outcome-value identifier="BODY">
              <qti-multiple>
                <qti-variable identifier="BODY"/>
                <qti-base-value base-type="identifier">option1</qti-base-value>
              </qti-multiple>
            </qti-set-outcome-value>
          </qti-response-if>
          <qti-response-else-if>
            <qti-match>
              <qti-variable identifier="RESPONSE1"/>
              <qti-base-value base-type="identifier">OPTION2</qti-base-value>
            </qti-match>
            <qti-set-outcome-value identifier="BODY">
              <qti-multiple>
                <qti-variable identifier="BODY"/>
                <qti-base-value base-type="identifier">option2</qti-base-value>
              </qti-multiple>
            </qti-set-outcome-value>
          </qti-response-else-if>
        </qti-response-condition>
      </qti-response-if>
      <qti-response-else-if>
        <qti-member>
          <qti-base-value base-type="identifier">part2</qti-base-value>
          <qti-variable identifier="BODY"/>
        </qti-member>
        <qti-response-condition>
          <qti-response-if>
            <qti-match>
              <qti-variable identifier="RESPONSE21"/>
              <qti-correct identifier="RESPONSE21"/>
            </qti-match>
            <qti-set-outcome-value identifier="FEEDBACK">
              <qti-base-value base-type="identifier">CORRECT</qti-base-value>
            </qti-set-outcome-value>
            <qti-set-outcome-value identifier="SCORE">
              <qti-base-value base-type="float">1</qti-base-value>
            </qti-set-outcome-value>
            <qti-set-outcome-value identifier="completionStatus">
              <qti-base-value base-type="identifier">completed</qti-base-value>
            </qti-set-outcome-value>
          </qti-response-if>
        </qti-response-condition>
      </qti-response-else-if>
    </qti-response-condition>
  </qti-response-processing>
</qti-assessment-item>`;

    await page.goto("/");
    await pasteXml(page, xml);
    const part1 = page.locator("qti-assessment-item-player .qti3-feedback-block", {
      hasText: "Choose an input method.",
    });
    const part2 = page.locator("qti-assessment-item-player .qti3-feedback-block", {
      hasText: "Answer the second part.",
    });
    const option1 = page.locator("qti-assessment-item-player .qti3-feedback-block", {
      hasText: "Choose the correct saying:",
    });
    const option2 = page.locator("qti-assessment-item-player .qti3-feedback-block", {
      hasText: "Complete the saying below by selecting from the list:",
    });

    await expect(part1).toBeVisible();
    await expect(part1).toContainText("Choose an input method.");
    await expect(part2).toBeHidden();
    await expect(option1).toBeHidden();
    await expect(option2).toBeHidden();

    await page
      .locator('qti-assessment-item-player [data-response-identifier="RESPONSE1"]')
      .getByLabel("Multiple choice")
      .check();
    await page.locator("#debug-end").click();

    await expect(part1).toBeHidden();
    await expect(part2).toBeVisible();
    await expect(option1).toBeVisible();
    await expect(option2).toBeHidden();

    const branchedState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(branchedState.outcomes.BODY).toEqual(["part2", "option1"]);
    expect(branchedState.status).toBe("interacting");
    expect(branchedState.validationMessages).toEqual([]);

    await page
      .locator('qti-assessment-item-player [data-response-identifier="RESPONSE21"]')
      .getByLabel("Too many cooks spoil the broth")
      .check();
    await page.locator("#debug-end").click();

    const completedState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(completedState.outcomes.SCORE).toBe(1);
    expect(completedState.outcomes.completionStatus).toBe("completed");
    expect(completedState.status).toBe("completed");
  });

  test("end-attempt does not complete an invalid attempt", async ({ page }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="blocked-end" title="blocked-end" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-response-declaration identifier="END" cardinality="single" base-type="boolean"/>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE">
      <qti-simple-choice identifier="A">Correct</qti-simple-choice>
      <qti-simple-choice identifier="B">Incorrect</qti-simple-choice>
    </qti-choice-interaction>
    <qti-end-attempt-interaction response-identifier="END" title="Finish"/>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`;

    await page.goto("/");
    await pasteXml(page, xml);
    await page.getByRole("button", { name: "Finish" }).click();

    const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(state.responses.END).toBe(true);
    expect(state.status).toBe("interacting");
    expect(state.validationMessages).toEqual([
      expect.objectContaining({ code: "response.required", path: "RESPONSE" }),
    ]);
    await expect(page.locator("#score-status")).toHaveText(
      "Score blocked by 1 validation message.",
    );

    const restoredState = await page
      .locator("qti-assessment-item-player")
      .evaluate((element, attemptState) => {
        element.reset();
        element.restore(attemptState);
        attemptState.validationMessages[0]!.message = "mutated after restore";
        return element.serialize();
      }, state);
    await expect(
      page.locator('qti-assessment-item-player [data-choice-identifier="A"] input'),
    ).toHaveAttribute("aria-invalid", "true");
    expect(restoredState.validationMessages).toEqual(state.validationMessages);
  });

  test("response state events preserve remaining restored validation messages", async ({
    page,
  }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="multi-validation" title="multi-validation" time-dependent="false">
  <qti-response-declaration identifier="FIRST" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-response-declaration identifier="SECOND" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>C</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <p>Answer both required choices.</p>
    <qti-choice-interaction response-identifier="FIRST">
      <qti-simple-choice identifier="A">First answer</qti-simple-choice>
      <qti-simple-choice identifier="B">Other first answer</qti-simple-choice>
    </qti-choice-interaction>
    <qti-choice-interaction response-identifier="SECOND">
      <qti-simple-choice identifier="C">Second answer</qti-simple-choice>
      <qti-simple-choice identifier="D">Other second answer</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`;

    await page.goto("/");
    await pasteXml(page, xml);
    await page.locator("#debug-score").click();

    const blockedState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(blockedState.validationMessages.map((message) => message.path)).toEqual([
      "FIRST",
      "SECOND",
    ]);

    const emittedState = await page
      .locator("qti-assessment-item-player")
      .evaluate(async (element, attemptState) => {
        element.reset();
        element.restore(attemptState);
        const nextState = new Promise((resolve) => {
          element.addEventListener("qti-statechange", (event) => resolve(event.detail.state), {
            once: true,
          });
        });
        const firstChoice = element.querySelector<HTMLInputElement>(
          '[data-response-identifier="FIRST"] [data-choice-identifier="A"] input',
        );
        if (!firstChoice) throw new Error("Missing first choice control.");
        firstChoice.click();
        return nextState;
      }, blockedState);

    expect(emittedState.responses.FIRST).toBe("A");
    expect(emittedState.validationMessages).toEqual([
      expect.objectContaining({ code: "response.required", path: "SECOND" }),
    ]);
  });

  test("completed attempts render as non-mutable review state", async ({ page }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="completed-review" title="completed-review" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-response-declaration identifier="END" cardinality="single" base-type="boolean"/>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE">
      <qti-simple-choice identifier="A">Correct</qti-simple-choice>
      <qti-simple-choice identifier="B">Incorrect</qti-simple-choice>
    </qti-choice-interaction>
    <qti-end-attempt-interaction response-identifier="END" title="Finish"/>
  </qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`;

    await page.goto("/");
    await pasteXml(page, xml);
    await page.locator('qti-assessment-item-player [data-choice-identifier="A"] input').check();
    await page.getByRole("button", { name: "Finish" }).click();

    await expect(page.locator("qti-assessment-item-player")).toHaveAttribute(
      "data-status",
      "completed",
    );
    await expect(
      page.locator('qti-assessment-item-player [data-choice-identifier="A"] input'),
    ).toBeDisabled();
    await expect(
      page.locator('qti-assessment-item-player [data-choice-identifier="B"] input'),
    ).toBeDisabled();
    await expect(
      page.locator('qti-assessment-item-player [data-interaction-type="endAttempt"] button'),
    ).toBeDisabled();
    await expect(page.locator("qti-assessment-item-player .qti3-actions")).toHaveCount(0);

    const completedState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(completedState.responses.RESPONSE).toBe("A");

    const restoredCompletedState = await page
      .locator("qti-assessment-item-player")
      .evaluate((element, state) => {
        element.reset();
        element.restore(state);
        const choice = element.querySelector<HTMLInputElement>(
          '[data-choice-identifier="B"] input',
        );
        choice?.click();
        return element.serialize();
      }, completedState);
    expect(restoredCompletedState.responses.RESPONSE).toBe("A");
    await expect(
      page.locator('qti-assessment-item-player [data-choice-identifier="A"] input'),
    ).toBeDisabled();
    await expect(
      page.locator('qti-assessment-item-player [data-choice-identifier="B"] input'),
    ).toBeDisabled();

    await page.locator("#debug-reset").click();
    await expect(page.locator("qti-assessment-item-player")).toHaveAttribute(
      "data-status",
      "initialized",
    );
    await expect(
      page.locator('qti-assessment-item-player [data-choice-identifier="B"] input'),
    ).toBeEnabled();
  });

  test("restores serialized responses into visible controls", async ({ page }) => {
    await page.goto("/");
    const restoreCurrentAttempt = async () => {
      const state = await page.locator("qti-assessment-item-player").evaluate((element) => {
        return element.serialize();
      });
      await page.locator("qti-assessment-item-player").evaluate((element, attemptState) => {
        element.reset();
        element.restore(attemptState);
      }, state);
    };

    await loadFixture(page, "choice");
    await page.locator('qti-assessment-item-player [data-choice-identifier="A"] input').check();
    await restoreCurrentAttempt();
    await expect(
      page.locator('qti-assessment-item-player [data-choice-identifier="A"] input'),
    ).toBeChecked();
    await expect(
      page.locator('qti-assessment-item-player .qti3-choice-option[data-choice-identifier="A"]'),
    ).toHaveAttribute("data-selected", "true");

    await loadFixture(page, "textEntry");
    await page
      .locator('qti-assessment-item-player input:not([type="file"]):not([type="range"])')
      .fill("estuary");
    await restoreCurrentAttempt();
    await expect(
      page.locator('qti-assessment-item-player input:not([type="file"]):not([type="range"])'),
    ).toHaveValue("estuary");
    await expect(page.locator("qti-assessment-item-player .qti3-inline-counter")).toHaveCount(0);

    await loadFixture(page, "order");
    await page
      .locator('qti-assessment-item-player .qti3-reorder-handle[data-choice-identifier="B"]')
      .focus();
    await page.keyboard.press("ArrowUp");
    await restoreCurrentAttempt();
    await expect(
      page.locator("qti-assessment-item-player .qti3-reorder-item").first(),
    ).toHaveAttribute("data-choice-identifier", "B");

    await loadFixture(page, "hotspot");
    await page
      .locator("qti-assessment-item-player .qti3-hotspot-surface")
      .getByRole("button", { name: "A" })
      .click();
    await restoreCurrentAttempt();
    await expect(
      page.locator("qti-assessment-item-player .qti3-hotspot-button[data-choice-identifier='A']"),
    ).toHaveAttribute("data-selected", "true");
    await expect(page.locator("qti-assessment-item-player .qti3-selection-summary")).toContainText(
      "Selected A",
    );
  });
});
