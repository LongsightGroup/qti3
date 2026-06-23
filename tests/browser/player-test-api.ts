import type {
  QtiCatalogSupportResolution,
  QtiCatalogSupportResolutionOptions,
} from "../../packages/core/src/catalog.js";
import type {
  QtiCompanionMaterialsResolution,
  QtiCompanionMaterialsResolutionOptions,
} from "../../packages/core/src/companion-materials-resolution.js";
import type { QtiTextToSpeechTraversal } from "../../packages/core/src/tts.js";
import type { QtiAttemptStateV1, QtiScoreResult } from "../../packages/core/src/types.js";
import type { Locator, Page } from "@playwright/test";
import type {
  QtiPlayerLoadOptions,
  QtiScoreAttemptOptions,
} from "../../packages/player/src/player-types.js";

export const playerSelector = "qti-assessment-item-player";

export function playerLocator(page: Page): Locator {
  return page.locator(playerSelector);
}

export async function serializePlayer(page: Page): Promise<QtiAttemptStateV1 | undefined> {
  return playerLocator(page).evaluate((element) => element.serialize());
}

export async function restorePlayerState(page: Page, state: QtiAttemptStateV1): Promise<void> {
  await playerLocator(page).evaluate((element, attemptState) => {
    element.restore(attemptState);
  }, state);
}

export async function resetThenRestorePlayerState(
  page: Page,
  state: QtiAttemptStateV1,
): Promise<void> {
  await playerLocator(page).evaluate((element, attemptState) => {
    element.reset();
    element.restore(attemptState);
  }, state);
}

export async function scorePlayerAttempt(
  page: Page,
  options?: QtiScoreAttemptOptions,
): Promise<QtiScoreResult | undefined> {
  return playerLocator(page).evaluate((element, scoreOptions) => {
    return element.scoreAttempt(scoreOptions);
  }, options);
}

export async function loadPlayerXmlWithAssetPrefix(
  page: Page,
  xml: string,
  assetUrlPrefix: string,
): Promise<void> {
  await playerLocator(page).evaluate(
    async (element, payload) => {
      await element.loadXml(payload.xml, {
        resolveAsset: (url) => `${payload.assetUrlPrefix}${url}`,
      });
    },
    { xml, assetUrlPrefix },
  );
}

export async function loadPlayerUrlWithXml(
  page: Page,
  url: string,
  xml: string,
  options?: Omit<QtiPlayerLoadOptions, "fetchXml">,
): Promise<void> {
  await playerLocator(page).evaluate(
    async (element, payload) => {
      await element.loadUrl(payload.url, {
        ...payload.options,
        fetchXml: async (requestedUrl: string) => {
          if (requestedUrl !== payload.url) {
            throw new Error(`Unexpected URL ${requestedUrl}`);
          }
          return payload.xml;
        },
      });
    },
    { url, xml, options },
  );
}

export async function getCatalogSupportResolution(
  page: Page,
  options?: QtiCatalogSupportResolutionOptions,
): Promise<QtiCatalogSupportResolution | undefined> {
  return playerLocator(page).evaluate((element, resolutionOptions) => {
    return element.getCatalogSupportResolution(resolutionOptions);
  }, options);
}

export async function getCompanionMaterialsResolution(
  page: Page,
  options?: QtiCompanionMaterialsResolutionOptions,
): Promise<QtiCompanionMaterialsResolution | undefined> {
  return playerLocator(page).evaluate((element, resolutionOptions) => {
    return element.getCompanionMaterialsResolution(resolutionOptions);
  }, options);
}

export async function resolveCompanionMaterialsWithUrlPrefixes(
  page: Page,
  xml: string,
  loadUrlPrefix: string,
  resolutionUrlPrefix: string,
): Promise<QtiCompanionMaterialsResolution | undefined> {
  return playerLocator(page).evaluate(
    async (element, payload) => {
      await element.loadXml(payload.xml, {
        resolveAsset: (url) => `${payload.loadUrlPrefix}${url}`,
      });
      return element.getCompanionMaterialsResolution({
        resolveAsset: (url) => `${payload.resolutionUrlPrefix}${url}`,
      });
    },
    { xml, loadUrlPrefix, resolutionUrlPrefix },
  );
}

export async function getTextToSpeechTraversal(
  page: Page,
): Promise<QtiTextToSpeechTraversal | undefined> {
  return playerLocator(page).evaluate((element) => element.getTextToSpeechTraversal());
}
