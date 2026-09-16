import { describe, expect, it } from "vitest";
import {
  createDefaultQti3PnpCapabilities,
  createPnpPlayerOptions,
  normalizeQti3Pnp,
  parseQti3PnpObject,
  resolveQti3Pnp,
  type Qti3PnpResolution,
} from "./index.js";

function resolve(preferences: unknown[]): Qti3PnpResolution {
  return resolveQti3Pnp(normalizeQti3Pnp(parseQti3PnpObject({ preferences })).profile, {
    capabilities: createDefaultQti3PnpCapabilities(),
    qti: {
      catalogSupports: [
        { catalogId: "term", support: "glossary-on-screen", language: "fr" },
        { catalogId: "other", support: "keyword-translation", language: "es" },
        { catalogId: "directions", support: "additional-directions", default: true },
      ],
    },
  });
}

describe("createPnpPlayerOptions", () => {
  it("preserves resolved catalog tuples without combining languages or losing initialization intent", () => {
    const resolution = resolve([
      { support: "keyword-emphasis" },
      {
        support: "glossary-on-screen",
        mode: "activate-at-initialization",
        params: { language: "fr" },
      },
      { support: "keyword-translation", params: { language: "es" } },
      { support: "additional-directions" },
    ]);
    const before = structuredClone(resolution);
    const mapping = createPnpPlayerOptions(resolution);
    expect(mapping.playerOptions).toEqual({
      keywordEmphasisEnabled: true,
      catalogRequestPolicy: {
        supports: ["glossary-on-screen", "keyword-translation", "additional-directions"],
        exactSelections: [
          { catalogId: "term", support: "glossary-on-screen", entryLanguage: "fr" },
          { catalogId: "other", support: "keyword-translation", entryLanguage: "es" },
          { catalogId: "directions", support: "additional-directions", entryLanguage: undefined },
        ],
      },
    });
    expect(mapping.hostRequired.catalogRequests[0]?.reason).toBe("pnp-initial");
    expect(mapping.hostRequired.display).not.toHaveProperty("keywordEmphasis");
    expect(resolution).toEqual(before);
    expect(createPnpPlayerOptions(resolution)).toEqual(mapping);
  });

  it("produces explicit reset values for empty and prohibited profiles", () => {
    for (const resolution of [
      resolve([]),
      resolve([{ support: "keyword-emphasis", mode: "prohibited" }]),
    ]) {
      expect(createPnpPlayerOptions(resolution).playerOptions).toEqual({
        keywordEmphasisEnabled: false,
        catalogRequestPolicy: { supports: [], exactSelections: [] },
      });
    }
  });

  it("retains unapplied settings, prohibitions, extensions and diagnostic outcomes for the host", () => {
    const resolution = resolve([
      { support: "text-appearance", params: { fontSize: 18 } },
      { support: "calculator-on-screen", params: { calculatorType: "scientific" } },
      { support: "captions" },
      { support: "additional-testing-time", params: { timeMultiplier: 2 } },
      { support: "keyword-emphasis", mode: "prohibited" },
      { support: "ext:host-tool" },
      { support: "braille" },
    ]);
    const { playerOptions, hostRequired } = createPnpPlayerOptions(resolution);
    expect(playerOptions.keywordEmphasisEnabled).toBe(false);
    expect(hostRequired.display).toEqual({ fontSize: 18 });
    expect(hostRequired.tools.calculator).toMatchObject({ enabled: true, type: "scientific" });
    expect(hostRequired.media.captions).toEqual({ enabled: true });
    expect(hostRequired.session.additionalTestingTime).toEqual({
      type: "time-multiplier",
      multiplier: 2,
    });
    expect(hostRequired.prohibited).toEqual(["keyword-emphasis"]);
    expect(hostRequired.extensions).toMatchObject([{ support: "ext:host-tool" }]);
    expect(hostRequired.unresolved).toMatchObject([{ reason: "content-missing" }]);
    expect(hostRequired.diagnostics).toMatchObject([{ code: "PNP_CATALOG_SUPPORT_MISSING" }]);
  });
});
