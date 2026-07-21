import { expect, test } from "@playwright/test";
import { catalogFixtures } from "../../packages/fixtures/src/index.js";

const inlineGlossaryXml = catalogFixtures.find(
  (fixture) => fixture.id === "catalog-glossary-inline",
)!.xml;
const fileGlossaryXml = catalogFixtures.find(
  (fixture) => fixture.id === "catalog-glossary-file",
)!.xml;
const multilingualCatalogXml = catalogFixtures.find(
  (fixture) => fixture.id === "catalog-multilingual-supports",
)!.xml;
const interactionCatalogXml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="interaction-catalog" title="interaction-catalog" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" data-catalog-idref="interaction-help">
      <qti-simple-choice identifier="A">Option A</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-catalog-info>
    <qti-catalog id="interaction-help">
      <qti-card support="glossary-on-screen"><qti-html-content><p>Interaction help.</p></qti-html-content></qti-card>
    </qti-catalog>
  </qti-catalog-info>
</qti-assessment-item>`;

test.describe("catalog host contract", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => customElements.whenDefined("qti-assessment-item-player"));
  });

  test("emits equivalent pointer, keyboard, and programmatic requests with safe content", async ({
    page,
  }) => {
    const player = page.locator("qti-assessment-item-player");
    const initial = await player.evaluate(async (element, xml) => {
      element.catalogRequestPolicy = {
        supports: "glossary-on-screen",
        languages: "en-US",
        includeDefaultFallback: true,
      };
      const events: unknown[] = [];
      element.addEventListener("qti-catalogrequest", (event) => {
        const { reference, delivery, activation } = event.detail;
        events.push({
          detail: { delivery, activation },
          originCatalogId: reference.element.getAttribute("data-catalog-idref"),
          originText: reference.element.textContent?.trim(),
        });
      });
      (window as Window & { catalogRequestEvents?: unknown[] }).catalogRequestEvents = events;
      await element.loadXml(xml, { resolveAsset: (url) => `/assets/${url}` });
      return {
        delivery: element.getCatalogDeliveryResolution({
          supports: "glossary-on-screen",
          languages: "en-US",
        }),
        references: element
          .getRenderedCatalogReferences()
          .map(({ element: origin, ...reference }) => ({
            ...reference,
            originCatalogId: origin.getAttribute("data-catalog-idref"),
          })),
      };
    }, inlineGlossaryXml);

    expect(initial.references).toEqual([
      expect.objectContaining({
        catalogId: "accurate",
        originCatalogId: "accurate",
        qtiName: "span",
        referenceId: expect.stringContaining("catalog-glossary-inline"),
      }),
    ]);
    expect(initial.delivery?.references[0]).toMatchObject({
      availableSupports: ["glossary-on-screen"],
      catalogId: "accurate",
      matches: [
        {
          language: "en",
          selectionReason: "primary-language",
          support: "glossary-on-screen",
        },
      ],
    });

    const button = player.locator(".qti3-catalog-request");
    await button.click();
    await button.focus();
    await button.press("Enter");
    await player.evaluate((element) => {
      const reference = element.getRenderedCatalogReferences()[0];
      if (!reference) throw new Error("Missing rendered catalog reference.");
      element.requestCatalog(reference.referenceId);
    });

    const events = await page.evaluate(
      () => (window as Window & { catalogRequestEvents?: unknown[] }).catalogRequestEvents,
    );
    expect(events).toEqual([
      expect.objectContaining({
        detail: expect.objectContaining({
          activation: "pointer",
          delivery: expect.objectContaining({ catalogId: "accurate" }),
        }),
        originCatalogId: "accurate",
        originText: "accurate",
      }),
      expect.objectContaining({
        detail: expect.objectContaining({
          activation: "keyboard",
          delivery: expect.objectContaining({ catalogId: "accurate" }),
        }),
      }),
      expect.objectContaining({
        detail: expect.objectContaining({
          activation: "programmatic",
          delivery: expect.objectContaining({ catalogId: "accurate" }),
        }),
      }),
    ]);
  });

  test("keeps reference identity across rerender and restores availability after suspension", async ({
    page,
  }) => {
    const player = page.locator("qti-assessment-item-player");
    const result = await player.evaluate(
      async (element, { firstXml, secondXml }) => {
        element.catalogRequestPolicy = { supports: "glossary-on-screen", languages: "en" };
        await element.loadXml(firstXml);
        const state = element.serialize();
        const first = element.getRenderedCatalogReferences()[0];
        if (!state || !first) throw new Error("Missing initial catalog state.");

        element.reset();
        const afterReset = element.getRenderedCatalogReferences()[0];
        element.suspend();
        const disabledWhileSuspended =
          element.querySelector<HTMLButtonElement>(".qti3-catalog-request")?.disabled;
        const requestedWhileSuspended = element.requestCatalog(first.referenceId);

        element.restore(state);
        const afterRestore = element.getRenderedCatalogReferences()[0];
        const disabledAfterRestore =
          element.querySelector<HTMLButtonElement>(".qti3-catalog-request")?.disabled;
        const requestedAfterRestore = element.requestCatalog(first.referenceId);

        await element.loadXml(secondXml);
        const second = element.getRenderedCatalogReferences()[0];
        return {
          disabledAfterRestore,
          disabledWhileSuspended,
          firstId: first.referenceId,
          resetElementChanged: first.element !== afterReset?.element,
          resetId: afterReset?.referenceId,
          requestedAfterRestore,
          requestedWhileSuspended,
          restoreId: afterRestore?.referenceId,
          secondId: second?.referenceId,
          staleRequestAfterItemChange: element.requestCatalog(first.referenceId),
        };
      },
      { firstXml: inlineGlossaryXml, secondXml: fileGlossaryXml },
    );

    expect(result).toMatchObject({
      disabledAfterRestore: false,
      disabledWhileSuspended: true,
      requestedAfterRestore: true,
      requestedWhileSuspended: false,
      resetElementChanged: true,
      resetId: result.firstId,
      restoreId: result.firstId,
      staleRequestAfterItemChange: false,
    });
    expect(result.secondId).not.toBe(result.firstId);
  });

  test("keeps catalogs dormant until the host provides a request policy", async ({ page }) => {
    const player = page.locator("qti-assessment-item-player");
    await player.evaluate((element, xml) => element.loadXml(xml), inlineGlossaryXml);

    await expect(player.locator(".qti3-catalog-request")).toHaveCount(0);
    expect(await player.evaluate((element) => element.getRenderedCatalogReferences().length)).toBe(
      1,
    );
  });

  test("binds catalog identity while transformed QTI interactions render", async ({ page }) => {
    const player = page.locator("qti-assessment-item-player");
    const snapshot = await player.evaluate(async (element, xml) => {
      element.catalogRequestPolicy = { supports: "glossary-on-screen" };
      await element.loadXml(xml);
      return element.getRenderedCatalogReferences().map(({ element: origin, ...reference }) => ({
        ...reference,
        renderedName: origin.localName,
      }));
    }, interactionCatalogXml);

    expect(snapshot).toEqual([
      expect.objectContaining({
        catalogId: "interaction-help",
        qtiName: "qti-choice-interaction",
        renderedName: "section",
      }),
    ]);
    await expect(player.locator(".qti3-catalog-request")).toHaveCount(1);
  });

  test("asset-resolves pointer event delivery through the same projection as the public API", async ({
    page,
  }) => {
    const player = page.locator("qti-assessment-item-player");
    await player.evaluate(async (element, xml) => {
      element.catalogRequestPolicy = { supports: "glossary-on-screen" };
      element.addEventListener("qti-catalogrequest", (event) => {
        (window as Window & { catalogEventFileHref?: string }).catalogEventFileHref =
          event.detail.delivery.matches[0]?.files[0]?.href;
      });
      await element.loadXml(xml, { resolveAsset: (url) => `/resolved/${url}` });
    }, fileGlossaryXml);

    await player.locator(".qti3-catalog-request").click();
    const result = await player.evaluate((element) => ({
      eventHref: (window as Window & { catalogEventFileHref?: string }).catalogEventFileHref,
      publicHref: element.getCatalogDeliveryResolution()?.references[0]?.matches[0]?.files[0]?.href,
    }));

    expect(result).toEqual({
      eventHref: "/resolved/glossary/grades5_9/harmonica.html",
      publicHref: "/resolved/glossary/grades5_9/harmonica.html",
    });
  });

  test("preserves host policy across clear and keeps no-option delivery independent from it", async ({
    page,
  }) => {
    const player = page.locator("qti-assessment-item-player");
    const result = await player.evaluate(
      async (element, { firstXml, secondXml }) => {
        const policy = { supports: "glossary-on-screen" } as const;
        element.catalogRequestPolicy = policy;
        await element.loadXml(firstXml);
        const deliveredSupports = element
          .getCatalogDeliveryResolution()
          ?.references[0]?.matches.map((match) => match.support);
        element.clearItem();
        const policyAfterClear = element.catalogRequestPolicy;
        await element.loadXml(secondXml);
        return {
          controlCountAfterReload: element.querySelectorAll(".qti3-catalog-request").length,
          deliveredSupports,
          policyAfterClear,
        };
      },
      { firstXml: multilingualCatalogXml, secondXml: inlineGlossaryXml },
    );

    expect(result).toEqual({
      controlCountAfterReload: 1,
      deliveredSupports: ["glossary-on-screen", "keyword-translation", "spoken"],
      policyAfterClear: { supports: "glossary-on-screen" },
    });
  });
});
