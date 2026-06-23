import { expect, test } from "@playwright/test";
import { interactionFixtures } from "../../packages/fixtures/src/index.js";
import { loadedItemIdentifier, loadFixture, pasteXml } from "./player-helpers.js";

test.describe("manual harness", () => {
  test("does not render generic fieldset or legend wrappers around interactions", async ({
    page,
  }) => {
    await page.goto("/");

    for (const fixture of interactionFixtures) {
      await page.locator("#fixture").selectOption(fixture.id);
      await page.locator("#load-fixture").click();

      const player = page.locator("qti-assessment-item-player");
      await expect(player.locator("fieldset"), fixture.id).toHaveCount(0);
      await expect(player.locator("legend"), fixture.id).toHaveCount(0);
    }
  });
  test("does not render host scoring controls inside the item player", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "choice");

    const player = page.locator("qti-assessment-item-player");
    await expect(player.locator(".qti3-actions")).toHaveCount(0);
    await expect(player.getByRole("button", { name: "Score", exact: true })).toHaveCount(0);
    await expect(page.locator("#debug-score")).toHaveText("Score attempt");
  });
  test("shows dormant catalog metadata in the manual debugger", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="catalog-debug" title="catalog-debug" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
          <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
        </qti-response-declaration>
        <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
        <qti-item-body>
          <p data-catalog-idref="term-help">Select the accurate statement.</p>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-simple-choice identifier="A">QTI items may include dormant support-specific content.</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
        <qti-catalog-info>
          <qti-catalog id="term-help">
            <qti-card support="linguistic-guidance">
              <qti-html-content>Accurate means correct.</qti-html-content>
            </qti-card>
          </qti-catalog>
        </qti-catalog-info>
      </qti-assessment-item>
    `,
    );

    await expect(page.locator("#debug-catalogs")).toContainText('"id": "term-help"');
    await expect(page.locator("#debug-catalogs")).toContainText('"support": "linguistic-guidance"');
    await expect(page.locator("#debug-catalogs")).toContainText("Accurate means correct.");
  });
  test("exposes resolved catalog supports for media alternatives", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="media-catalog" title="media-catalog" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
        <qti-item-body>
          <p data-catalog-idref="audio-transcript">Listen to the recording.</p>
          <qti-media-interaction response-identifier="RESPONSE" data-catalog-idref="video-alternatives">
            <qti-prompt>Watch the clip.</qti-prompt>
            <video width="320" height="180">
              <source src="clips/presentation.mp4" type="video/mp4"/>
              <track kind="captions" src="captions/presentation.vtt" srclang="en" label="English"/>
            </video>
          </qti-media-interaction>
        </qti-item-body>
        <qti-catalog-info>
          <qti-catalog id="audio-transcript">
            <qti-card support="transcript">
              <qti-card-entry xml:lang="en" default="true">
                <qti-html-content><p>English transcript.</p></qti-html-content>
              </qti-card-entry>
              <qti-card-entry xml:lang="es">
                <qti-html-content><p>Transcripción en español.</p></qti-html-content>
              </qti-card-entry>
            </qti-card>
          </qti-catalog>
          <qti-catalog id="video-alternatives">
            <qti-card support="audio-description">
              <qti-card-entry default="true">
                <qti-file-href mime-type="audio/mpeg">audio/presentation-description.mp3</qti-file-href>
              </qti-card-entry>
            </qti-card>
            <qti-card support="sign-language">
              <qti-card-entry xml:lang="ase" default="true">
                <qti-html-content><p>ASL interpretation clip.</p></qti-html-content>
              </qti-card-entry>
            </qti-card>
          </qti-catalog>
        </qti-catalog-info>
      </qti-assessment-item>
    `,
    );

    const resolution = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return (
        element as HTMLElement & {
          getCatalogSupportResolution: (options?: { languages?: string[]; supports?: string[] }) =>
            | {
                references: Array<{
                  idref: string;
                  matches: Array<{
                    fileHrefs: Array<{ href: string; mimeType?: string }>;
                    htmlContent?: { text: string };
                    language?: string;
                    support: string;
                  }>;
                }>;
              }
            | undefined;
        }
      ).getCatalogSupportResolution({
        supports: ["transcript", "audio-description", "sign-language"],
        languages: ["es", "ase"],
      });
    });

    expect(resolution?.references.map((reference) => reference.idref)).toEqual([
      "audio-transcript",
      "video-alternatives",
    ]);
    expect(resolution?.references[0]?.matches).toEqual([
      expect.objectContaining({
        language: "es",
        support: "transcript",
        htmlContent: expect.objectContaining({ text: "Transcripción en español." }),
      }),
    ]);
    expect(resolution?.references[1]?.matches).toEqual([
      expect.objectContaining({
        support: "audio-description",
        fileHrefs: [
          expect.objectContaining({
            href: "audio/presentation-description.mp3",
            mimeType: "audio/mpeg",
          }),
        ],
      }),
      expect.objectContaining({
        language: "ase",
        support: "sign-language",
        htmlContent: expect.objectContaining({ text: "ASL interpretation clip." }),
      }),
    ]);
  });
  test("shows item stylesheet references in the manual debugger", async ({ page }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="stylesheet-debug" title="stylesheet-debug" time-dependent="false">
        <qti-stylesheet href="style/item.css" type="text/css" media="screen"/>
        <qti-item-body><p>Styled item body.</p></qti-item-body>
      </qti-assessment-item>
    `,
    );

    await expect(page.locator("#debug-stylesheets")).toContainText('"href": "style/item.css"');
    await expect(page.locator("#debug-stylesheets")).toContainText('"type": "text/css"');
    await expect(page.locator("#debug-stylesheets")).toContainText('"media": "screen"');
  });
  test("exposes resolved companion materials for host chrome", async ({ page }) => {
    await page.goto("/");
    const xml = `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="companion-materials-host" title="companion-materials-host" time-dependent="false">
        <qti-companion-materials-info>
          <qti-physical-material>Bring a ruler.</qti-physical-material>
          <qti-digital-material label="Reference card" mime-type="text/plain">
            <qti-file-href>materials/reference.txt</qti-file-href>
            <qti-resource-icon>materials/reference.svg</qti-resource-icon>
          </qti-digital-material>
        </qti-companion-materials-info>
        <qti-item-body><p>Use the companion materials.</p></qti-item-body>
      </qti-assessment-item>
    `;

    await page.locator("qti-assessment-item-player").evaluate(async (element, itemXml) => {
      await (
        element as HTMLElement & {
          loadXml: (
            xml: string,
            options?: { resolveAsset?: (url: string) => string },
          ) => Promise<void>;
        }
      ).loadXml(itemXml, {
        resolveAsset: (url) => `https://package.example/${url}`,
      });
    }, xml);

    const resolution = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return (
        element as HTMLElement & {
          getCompanionMaterialsResolution: () =>
            | {
                physicalMaterials: Array<{ text: string }>;
                digitalMaterials: Array<{
                  fileHref: string;
                  resolvedFileHref?: string;
                  label?: string;
                  mimeType?: string;
                  resourceIcon?: string;
                  resolvedResourceIcon?: string;
                }>;
              }
            | undefined;
        }
      ).getCompanionMaterialsResolution();
    });

    expect(resolution?.physicalMaterials).toEqual([
      expect.objectContaining({ text: "Bring a ruler." }),
    ]);
    expect(resolution?.digitalMaterials).toEqual([
      expect.objectContaining({
        fileHref: "materials/reference.txt",
        resolvedFileHref: "https://package.example/materials/reference.txt",
        label: "Reference card",
        mimeType: "text/plain",
        resourceIcon: "materials/reference.svg",
        resolvedResourceIcon: "https://package.example/materials/reference.svg",
      }),
    ]);
    await expect(page.locator("#debug-companion-materials")).toContainText(
      '"text": "Bring a ruler."',
    );
    await expect(page.locator("#debug-companion-materials")).toContainText(
      '"resolvedFileHref": "https://package.example/materials/reference.txt"',
    );
  });
  test("lets hosts override companion material asset resolution per call", async ({ page }) => {
    await page.goto("/");
    const xml = `
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="companion-materials-override" title="companion-materials-override" time-dependent="false">
        <qti-companion-materials-info>
          <qti-digital-material>
            <qti-file-href>materials/reference.txt</qti-file-href>
          </qti-digital-material>
        </qti-companion-materials-info>
        <qti-item-body><p>Use the companion materials.</p></qti-item-body>
      </qti-assessment-item>
    `;

    const resolution = await page
      .locator("qti-assessment-item-player")
      .evaluate(async (element, itemXml) => {
        const player = element as HTMLElement & {
          loadXml: (
            xml: string,
            options?: { resolveAsset?: (url: string) => string },
          ) => Promise<void>;
          getCompanionMaterialsResolution: (options?: {
            resolveAsset?: (url: string) => string;
          }) =>
            | {
                digitalMaterials: Array<{
                  resolvedFileHref?: string;
                }>;
              }
            | undefined;
        };

        await player.loadXml(itemXml, {
          resolveAsset: (url) => `https://load.example/${url}`,
        });

        return player.getCompanionMaterialsResolution({
          resolveAsset: (url) => `https://override.example/${url}`,
        });
      }, xml);

    expect(resolution?.digitalMaterials[0]?.resolvedFileHref).toBe(
      "https://override.example/materials/reference.txt",
    );
  });
  test("shows accessibility proof and manual assistive technology scripts", async ({ page }) => {
    await page.goto("/");
    await loadFixture(page, "associate");

    await expect(page.locator("#debug-a11y-proof")).toContainText(
      "associate accessibility contract",
    );
    await expect(page.locator("#debug-a11y-proof")).toContainText("Keyboard model");
    await expect(page.locator("#debug-a11y-proof")).toContainText(
      "Remove buttons delete selected pairs.",
    );
    await expect(page.locator("#debug-at-scripts")).toContainText("VoiceOver on macOS");
    await expect(page.locator("#debug-at-scripts")).toContainText("NVDA on Windows");
    await expect(page.locator("#debug-at-scripts")).toContainText("JAWS on Windows");
    await expect(page.locator("#debug-at-scripts ol li").first()).toContainText(
      "Navigate from the item body",
    );
  });
  test("does not render qti-assessment-item title metadata as candidate content", async ({
    page,
  }) => {
    await page.goto("/");
    await pasteXml(
      page,
      `
      <qti-assessment-item
        xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
        identifier="candidate-visible-item"
        title="Internal Item Bank Title" time-dependent="false">
        <qti-item-body>
          <p>Candidate-visible item body.</p>
        </qti-item-body>
      </qti-assessment-item>
    `,
    );

    const player = page.locator("qti-assessment-item-player");
    await expect(player).toContainText("Candidate-visible item body.");
    await expect(player).not.toContainText("Internal Item Bank Title");
    await expect(player.locator("#qti3-item-title")).toHaveCount(0);
  });
  test("keeps manual harness load options in a native exclusive disclosure group", async ({
    page,
  }) => {
    await page.goto("/");

    const reference = page.locator("details.load-option").filter({ hasText: "Reference fixture" });
    const packageLoader = page.locator("#package-loader");
    const xmlLoader = page.locator("#xml-loader");
    await expect(reference).toHaveAttribute("open", "");
    await expect(packageLoader).not.toHaveAttribute("open", "");
    await expect(xmlLoader).not.toHaveAttribute("open", "");

    await packageLoader.locator("summary").click();
    await expect(packageLoader).toHaveAttribute("open", "");
    await expect(reference).not.toHaveAttribute("open", "");

    await xmlLoader.locator("summary").click();
    await expect(xmlLoader).toHaveAttribute("open", "");
    await expect(packageLoader).not.toHaveAttribute("open", "");

    await pasteXml(page, "<qti-assessment-item/>");
    await expect(xmlLoader).toHaveAttribute("open", "");
  });
  test("loads adjacent reference fixtures from the manual harness arrows", async ({ page }) => {
    await page.goto("/");

    const fixtureIds = await page
      .locator("#fixture option")
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value).filter(Boolean),
      );
    const firstFixtureId = fixtureIds[0];
    const secondFixtureId = fixtureIds[1];
    const previousLastFixtureId = fixtureIds.at(-2);
    const lastFixtureId = fixtureIds.at(-1);
    if (!firstFixtureId || !secondFixtureId || !previousLastFixtureId || !lastFixtureId) {
      throw new Error("Missing selectable fixtures.");
    }

    const player = page.locator("qti-assessment-item-player");
    const previousFixture = page.getByRole("button", { name: "Load previous fixture" });
    const nextFixture = page.getByRole("button", { name: "Load next fixture" });

    await expect(page.locator("#fixture")).toHaveValue(firstFixtureId);
    await expect(previousFixture).toBeDisabled();

    await nextFixture.click();
    await expect(page.locator("#fixture")).toHaveValue(secondFixtureId);
    await expect.poll(() => loadedItemIdentifier(player)).toBe(secondFixtureId);
    await expect(previousFixture).toBeEnabled();

    await page.locator("#fixture").selectOption(lastFixtureId);
    await expect(nextFixture).toBeDisabled();

    await previousFixture.click();
    await expect(page.locator("#fixture")).toHaveValue(previousLastFixtureId);
    await expect.poll(() => loadedItemIdentifier(player)).toBe(previousLastFixtureId);
    await expect(nextFixture).toBeEnabled();
  });
  test("honors load session controls and injected XML fetchers", async ({ page }) => {
    const fixture =
      interactionFixtures.find((item) => item.interactionType === "choice") ??
      interactionFixtures[0];
    if (!fixture) throw new Error("Missing choice fixture.");

    await page.goto("/");
    await page.locator("qti-assessment-item-player").evaluate(async (element, xml) => {
      await element.loadUrl("/items/choice.xml", {
        status: "interacting",
        sessionControl: { validateResponses: false, showFeedback: false },
        fetchXml: async (url: string) => {
          if (url !== "/items/choice.xml") throw new Error(`Unexpected URL ${url}`);
          return xml;
        },
      });
    }, fixture.xml);

    const loadedState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(loadedState.status).toBe("interacting");

    await page.locator("#debug-score").click();
    const scoredState = await page.locator("qti-assessment-item-player").evaluate((element) => {
      return element.serialize();
    });
    expect(scoredState.validationMessages).toEqual([]);
    await expect(page.locator("#events")).not.toContainText("response.required");
  });
});
