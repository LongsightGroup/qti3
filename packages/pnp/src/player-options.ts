import type { Qti3PnpCatalogSupportRequest, Qti3PnpResolution } from "./types.js";

/** Complete replacement values for the default player's PNP-controlled properties. */
export interface Qti3PnpPlayerOptions {
  readonly keywordEmphasisEnabled: boolean;
  readonly catalogRequestPolicy: {
    readonly supports: readonly string[];
    readonly exactSelections: readonly Pick<
      Qti3PnpCatalogSupportRequest,
      "catalogId" | "support" | "entryLanguage"
    >[];
  };
}

/** Resolution data requiring host handling or review; catalog presentation remains host-owned. */
export type Qti3PnpPlayerHostRequirements = Readonly<Omit<Qti3PnpResolution, "display">> & {
  readonly display: Omit<Qti3PnpResolution["display"], "keywordEmphasis">;
};

/** Player settings and the remaining host responsibilities for one resolved profile. */
export interface Qti3PnpPlayerMapping {
  readonly playerOptions: Qti3PnpPlayerOptions;
  readonly hostRequired: Qti3PnpPlayerHostRequirements;
}

/**
 * Maps an already resolved profile without DOM access, I/O, or policy decisions.
 * Assign both player properties on every application, including an empty resolution,
 * to remove previous settings. Catalog requests enable controls, never presentation.
 * Host requirements retain the input's records by reference; treat them as read-only.
 */
export function createPnpPlayerOptions(resolution: Qti3PnpResolution): Qti3PnpPlayerMapping {
  const { display, ...hostRequired } = resolution;
  const { keywordEmphasis, ...hostDisplay } = display;
  return {
    playerOptions: {
      keywordEmphasisEnabled: keywordEmphasis === true,
      catalogRequestPolicy: {
        supports: [...new Set(resolution.catalogRequests.map((request) => request.support))],
        exactSelections: resolution.catalogRequests.map((request) => ({
          catalogId: request.catalogId,
          support: request.support,
          entryLanguage: request.entryLanguage,
        })),
      },
    },
    hostRequired: { ...hostRequired, display: hostDisplay },
  };
}
